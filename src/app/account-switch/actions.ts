"use server";

import { auth, isAdminEmail, signIn, signOut } from "@/auth";
import { accountSwitchActor } from "@/lib/account-switch-policy";
import type { AccountSwitchResult } from "@/lib/account-switch-result";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";
import { findQaPersona } from "@/lib/qa-personas";
import { provisionQaPersona } from "@/lib/qa-provision";
import { signInAsQaPersona } from "@/lib/qa-sign-in";

export async function switchAdminAccount(
  _previous: AccountSwitchResult, data: FormData,
): Promise<AccountSwitchResult> {
  const session = await auth();
  if (!accountSwitchActor(session, isAdminEmail)) {
    // A page left open past the viewing window still shows Return (auth.ts has
    // already ended that session), so it needs the same way out.
    return { error: "Sign in with your own admin account to switch accounts.", offerSignOut: data.get("intent") === "return" };
  }
  const returning = data.get("intent") === "return";
  try {
    await signIn("admin-account-switch", {
      targetId: String(data.get("targetId") ?? ""),
      intent: returning ? "return" : "switch",
      redirect: false,
    });
    return { destination: returning ? "/admin" : "/post-login" };
  } catch {
    // Return is the only exit a viewing admin is shown, so when it fails they
    // need another one, or they are stuck in the account they were viewing.
    if (returning) {
      return { error: "Couldn’t return you to your admin account. Sign out, then sign in again as yourself.", offerSignOut: true };
    }
    return { error: "Couldn’t switch accounts. Your current session is unchanged. Refresh the list and try again." };
  }
}

// Works while an admin is viewing another account too: signInAsQaPersona sends a
// real admin through the admin switch, which keeps them as the actor.
export async function switchQaAccount(
  _previous: AccountSwitchResult, data: FormData,
): Promise<AccountSwitchResult> {
  if (!(await isTestSwitcherUnlocked())) {
    // /qa-unlock and the Admin → System toggle both refuse a viewing session.
    const viewing = (await auth())?.impersonation;
    return { error: viewing
      ? "Testing access has expired. Return to your admin account to turn it on again."
      : "Testing access has expired. Sign in as an admin to enable it again." };
  }
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  try {
    if (email === "signed-out") {
      await signOut({ redirect: false });
      return { destination: data.get("redirectTo") === "/test" ? "/test" : "/" };
    }
    const persona = findQaPersona(email);
    if (!persona) return { error: "Choose one of the listed test accounts." };
    await provisionQaPersona(persona.email);
    await signInAsQaPersona(persona.email);
    return { destination: "/post-login" };
  } catch {
    return { error: "Couldn’t open this test account. Your current session is unchanged. Please try again." };
  }
}
