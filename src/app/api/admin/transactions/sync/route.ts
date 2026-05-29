import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, isAdminEmail } from "@/auth";
import {
  syncAllConnectAccounts,
  syncPayoutsForAllMerchants,
  syncRecentCharges,
} from "@/lib/stripe-sync";
import { writeAuditLog } from "@/utils/admin/audit-logger";
import { getAdminProfileIdForSession } from "@/lib/event-repository";

// Admin-triggered backfill from Stripe → local mirror tables. Used to recover
// from missed webhook deliveries and to seed enrichment columns for older
// rows. Idempotent; safe to re-run.

type Scope = "charges" | "payouts" | "accounts" | "all";

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown sync error." }, { status: 500 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    sinceDays?: number;
    scope?: Scope;
  };
  const sinceDays = Number.isFinite(body.sinceDays)
    ? Math.min(Math.max(Number(body.sinceDays), 1), 365)
    : 7;
  const scope: Scope = body.scope ?? "all";

  try {
    const counts = {
      chargesSeen: 0,
      transactionsUpdated: 0,
      refundsUpserted: 0,
      payoutsUpserted: 0,
      accountsUpdated: 0,
      accountsScanned: 0,
    };

    if (scope === "charges" || scope === "all") {
      const r = await syncRecentCharges({ sinceDays });
      counts.chargesSeen = r.chargesSeen;
      counts.transactionsUpdated = r.transactionsUpdated;
      counts.refundsUpserted += r.refundsUpserted;
    }
    if (scope === "payouts" || scope === "all") {
      const r = await syncPayoutsForAllMerchants({ sinceDays });
      counts.payoutsUpserted = r.payoutsUpserted;
      counts.accountsScanned = r.accountsScanned;
    }
    if (scope === "accounts" || scope === "all") {
      const r = await syncAllConnectAccounts();
      counts.accountsUpdated = r.accountsUpdated;
      // Don't double-write accountsScanned if both ran; payouts version is fine.
      if (counts.accountsScanned === 0) counts.accountsScanned = r.accountsScanned;
    }

    const adminProfileId = await getAdminProfileIdForSession(session);
    await writeAuditLog({
      actorProfileId: adminProfileId,
      action: "stripe.sync",
      entityTable: "payment_transactions",
      entityId: null,
      metadata: { scope, since_days: sinceDays, ...counts },
    });

    revalidatePath("/admin/transactions");
    return NextResponse.json({ ok: true, counts, scope, sinceDays });
  } catch (error) {
    return errorResponse(error);
  }
}
