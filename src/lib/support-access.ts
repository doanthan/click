import { auth, isAdminEmail } from "@/auth";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";

// Who may READ and TRIAGE the bug queue.
//
// Reporting a bug stays open to everyone - that is deliberate, so a visitor can
// report a broken signed-out surface (login, register, discover) without an
// account. Reading the queue is a different thing entirely: a ticket carries the
// reporter's name and their free-text description of what went wrong, which is
// whatever they happened to type. Those were being served to anonymous callers,
// and the same tab let anyone mark a bug fixed or reopen it.
//
// Operators are admins, plus a browser holding the QA unlock cookie (how the
// team triages on a deployed environment) - the same boundary the persona
// switcher uses. Local dev is unlocked, so nothing changes while developing.
export async function canTriageSupportTickets() {
  if (await isTestSwitcherUnlocked()) return true;
  const session = await auth();
  return isAdminEmail(session?.user?.email);
}
