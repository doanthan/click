"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  REPORT_REASONS,
  blockUser,
  muteUser,
  reportUser,
  unblockUser,
  unmuteUser,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function targetFrom(formData: FormData): string | null {
  const id = formData.get("profile_id");
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

// Never fall out quietly. Every one of these runs from a form whose dialog
// closes and whose page refreshes the moment the action resolves, so a bare
// `return` is indistinguishable from success - and block and mute are the two
// controls someone reaches for when they have stopped feeling safe. An expired
// session used to leave them believing a block was in place when nothing had
// been written. Throwing surfaces it; the report path already worked this way.
async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Your session has expired. Sign in again and retry that.");
  }
  return session;
}

function requireTarget(formData: FormData) {
  const id = targetFrom(formData);
  if (!id) {
    throw new Error("We could not tell which profile that was. Reload the page and try again.");
  }
  return id;
}

export async function blockUserAction(formData: FormData) {
  const session = await requireSession();
  const id = requireTarget(formData);
  await blockUser(session, id);
  revalidatePath(`/profile/${id}`);
  revalidatePath("/people");
}

export async function unblockUserAction(formData: FormData) {
  const session = await requireSession();
  const id = requireTarget(formData);
  await unblockUser(session, id);
  revalidatePath(`/profile/${id}`);
  revalidatePath("/people");
}

export async function muteUserAction(formData: FormData) {
  const session = await requireSession();
  const id = requireTarget(formData);
  await muteUser(session, id);
  revalidatePath(`/profile/${id}`);
}

export async function unmuteUserAction(formData: FormData) {
  const session = await requireSession();
  const id = requireTarget(formData);
  await unmuteUser(session, id);
  revalidatePath(`/profile/${id}`);
}

export async function reportUserAction(formData: FormData) {
  const session = await requireSession();
  const id = requireTarget(formData);

  // Narrow instead of asserting: REPORT_REASONS is the `as const` tuple, so
  // `find` hands back a real ReportReason and nothing has to be cast through.
  const raw = formData.get("reason");
  const reason = REPORT_REASONS.find((candidate) => candidate === raw);

  // Do NOT fall out quietly here. This used to `return` on an unrecognised
  // reason, so the form visibly submitted, showed no error, and filed nothing -
  // the reporter walked away believing our safety team had their complaint. On
  // a safety surface a rejected report that looks exactly like a filed one is
  // the worst available outcome, so make it loud instead: an uncaught server
  // action error surfaces through the root boundary at src/app/error.tsx, which
  // is recoverable via its "Try again" and unmistakably not a success.
  //
  // The <select> is `required` over a fixed option set (profile-safety-
  // controls.tsx), so a real reporter never reaches this branch even with
  // scripting off - only a tampered or malformed post does.
  if (!reason) {
    throw new Error("Pick a reason so our safety team knows what to look for.");
  }

  const details = formData.get("details");

  await reportUser(session, {
    reportedProfileId: id,
    reason,
    details: typeof details === "string" ? details : undefined,
  });
  revalidatePath(`/profile/${id}`);
}
