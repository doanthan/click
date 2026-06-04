"use server";

import { auth } from "@/auth";
import { updateAccountSetting, type AccountSettingKey } from "@/lib/event-repository";

// Persist one Notifications/Privacy toggle from /account-settings. Returns the
// stored value so the client toggle can confirm (and revert on failure).
export async function setAccountSetting(key: AccountSettingKey, value: boolean) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("You need to be signed in to change settings.");
  }
  const stored = await updateAccountSetting(session, key, value);
  return { ok: true as const, value: stored };
}
