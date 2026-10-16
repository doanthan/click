"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { requireAdminProfile } from "@/lib/event-repository";
import {
  SCHEDULED_JOBS,
  runNowGate,
  runScheduledJob,
  type ScheduledJob,
} from "@/lib/scheduled-jobs";
import {
  TEST_SWITCHER_COOKIE,
  mintAdminUnlockCookie,
  testSwitcherCookieOptions,
} from "@/lib/test-switcher";

export type AdminQaAccessState = {
  ok: boolean;
  enabled: boolean;
  message: string;
} | null;

/**
 * Enable or disable this browser's QA persona switcher without navigating away
 * from /admin/system. The System page also contains a settings draft, so the
 * old /qa-unlock Link collided with its unsaved-work guard even though these
 * two controls do not share data.
 *
 * The grant remains bound to a live, non-QA ADMIN_EMAILS session. This is the
 * same signed value and cookie contract as /qa-unlock; changing the transport
 * from a redirect to a server action does not weaken the gate.
 */
export async function setAdminQaAccessAction(
  _previous: AdminQaAccessState,
  formData: FormData,
): Promise<AdminQaAccessState> {
  const enabled = formData.get("enabled") === "true";
  const session = await auth();
  if (session?.impersonation) {
    return { ok: false, enabled: !enabled, message: "Return to your own admin account to change testing access." };
  }
  const email = session?.user?.email ?? "";

  if (!email) {
    return {
      ok: false,
      enabled: !enabled,
      message: "Sign in as an admin to change test-account access.",
    };
  }

  const jar = await cookies();

  if (enabled) {
    const grant = mintAdminUnlockCookie(email);
    if (!grant) {
      return {
        ok: false,
        enabled: false,
        message: "A configured real admin account is required to turn on test accounts.",
      };
    }
    jar.set(TEST_SWITCHER_COOKIE, grant, testSwitcherCookieOptions());
  } else {
    jar.delete(TEST_SWITCHER_COOKIE);
  }

  // Refresh the card, header and account menu against the new cookie. App
  // Router merges this payload without discarding client state, so an unsaved
  // fee or banner draft on this page stays exactly as the operator left it.
  revalidatePath("/admin/system");

  return {
    ok: true,
    enabled,
    message: enabled
      ? "Test accounts are available from your avatar menu for 12 hours."
      : "Test accounts are hidden on this browser.",
  };
}

export type RunNowState = { ok: boolean; message: string } | null;

/**
 * 03 §10 Run-now: "Rebuild suggestion scores now" and "Build today's
 * suggestions now". Admin only (a real admin's own session - never while
 * viewing someone), audited, held to once per 2 minutes, refused with "already
 * running" while the job (or its cron) runs, and the SAME entry the cron calls.
 */
export async function runScheduledJobNowAction(
  _previous: RunNowState,
  formData: FormData,
): Promise<RunNowState> {
  const job = formData.get("job");
  if (typeof job !== "string" || !(job in SCHEDULED_JOBS)) {
    return { ok: false, message: "Unknown job." };
  }
  const session = await auth();
  if (session?.impersonation) {
    return { ok: false, message: "Return to your own admin account to run jobs." };
  }
  let actorId: string;
  try {
    actorId = (await requireAdminProfile(session)).id;
  } catch {
    return { ok: false, message: "Admin access is required." };
  }
  const key = job as ScheduledJob;
  try {
    const run = await runScheduledJob(key, runNowGate(key, actorId));
    if (!run.ran) return { ok: false, message: run.reason };
    const summary = Object.entries(run.result)
      .map(([name, value]) => `${name} ${value}`)
      .join(", ");
    return { ok: true, message: `${SCHEDULED_JOBS[key].label}: done (${summary}).` };
  } catch (error) {
    console.error("[run-now] job failed", { job: key, error });
    return { ok: false, message: `${SCHEDULED_JOBS[key].label} failed - see the server log.` };
  }
}
