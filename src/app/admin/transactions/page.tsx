import { AdminTransactionsTable } from "@/components/admin-transactions-table";
import {
  getAdminTransactionDetail,
  listAdminConnectAccounts,
  listAdminDisputes,
  listAdminPayouts,
  listAdminRefundFailures,
  listAdminTransactions,
} from "@/lib/event-repository";
import type { AdminTransactionRefund } from "@/lib/event-repository";
import { auth, isAdminEmail } from "@/auth";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Transactions Management | Admin",
};

// ISO timestamps so the table's date filters can default to the last 30 days
// without re-rendering on every state change.
function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// One page of the ledger. The console used to load exactly this many rows and
// never mention it, so a busy window looked like a quiet one - and because the
// refund control only exists inside a loaded row, a charge that fell past the
// cap (or off the 30-day edge) could not be refunded from here at all.
const PAGE_SIZE = 200;

// Ask for one row more than we show. That extra row is the whole "is there
// more" signal - we get it without a second count query, and it never reaches
// the table.
async function fetchLedgerPage(filter: {
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
}) {
  const rows = await listAdminTransactions({ ...filter, limit: PAGE_SIZE + 1 });
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

// The date inputs hand back an instant the browser built in the admin's own
// timezone; anything unparseable means "no bound" rather than a Postgres error
// that listAdminTransactions would swallow into an empty ledger.
function isoOrUndefined(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

/**
 * Re-query the ledger for the window the admin picked, and for Load more.
 *
 * A server action is its own public endpoint - requireAdminPage() below runs
 * for the page render, NOT for this - so the live payment ledger is re-gated on
 * every call, the same way /api/admin/transactions/* gates itself.
 */
async function loadLedgerPage(input: {
  dateFrom: string;
  dateTo: string;
  offset: number;
}) {
  "use server";
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    throw new Error("Admin access is required.");
  }
  return fetchLedgerPage({
    dateFrom: isoOrUndefined(input.dateFrom),
    dateTo: isoOrUndefined(input.dateTo),
    offset: Number.isFinite(input.offset) ? Math.max(Math.floor(input.offset), 0) : 0,
  });
}

/**
 * Refund history for one charge, loaded when its drawer opens.
 *
 * `payment_transactions.refunded_amount_cents` only ever counts refunds that
 * SUCCEEDED, so a refund that failed at Stripe leaves the ledger row reading
 * "paid" with nothing refunded - identical to a charge nobody ever tried to
 * refund. The `payment_refunds` rows are the only record that the attempt
 * happened and that someone is still out of pocket, and until now nothing on
 * this screen read them: getAdminTransactionDetail had no callers at all.
 *
 * Per-row rather than joined into the ledger on purpose - a 200-row window
 * would otherwise carry 200 rows of refund history nobody opened.
 *
 * A server action is its own public endpoint, so this re-gates admin the same
 * way loadLedgerPage above does.
 */
async function loadTransactionRefunds(
  transactionId: string,
): Promise<AdminTransactionRefund[]> {
  "use server";
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    throw new Error("Admin access is required.");
  }
  const detail = await getAdminTransactionDetail(transactionId);
  return detail?.refunds ?? [];
}

export default async function AdminTransactionsPage() {
  await requireAdminPage();

  const dateFrom = isoDaysAgo(30);
  // The two attention queues are deliberately NOT date-windowed the way the
  // ledger is. A refund that failed two months ago is still owed, and a dispute
  // does not stop mattering because it fell out of the last 30 days.
  const [ledger, payouts, connectAccounts, refundFailures, disputes] =
    await Promise.all([
      fetchLedgerPage({ dateFrom }),
      listAdminPayouts({ limit: 50 }),
      listAdminConnectAccounts(),
      listAdminRefundFailures(),
      listAdminDisputes(),
    ]);

  return (
    <div className="space-y-8 py-10">
      <AdminTransactionsTable
        initialTransactions={ledger.rows}
        initialHasMore={ledger.hasMore}
        initialPayouts={payouts}
        connectAccounts={connectAccounts}
        refundFailures={refundFailures}
        disputes={disputes}
        defaultDateFrom={dateFrom}
        loadPage={loadLedgerPage}
        loadRefunds={loadTransactionRefunds}
      />
    </div>
  );
}
