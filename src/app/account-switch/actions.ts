"use server";

import { auth, isAdminEmail, signIn, signOut } from "@/auth";
import { accountSwitchActor } from "@/lib/account-switch-policy";
import type { AccountSwitchResult } from "@/lib/account-switch-result";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";
import { findQaPersona } from "@/lib/qa-personas";
import { provisionQaPersona } from "@/lib/qa-provision";
import { getPostgresPool } from "@/lib/postgres";

export async function switchAdminAccount(
  _previous: AccountSwitchResult, data: FormData,
): Promise<AccountSwitchResult> {
  const session = await auth();
  if (!accountSwitchActor(session, isAdminEmail)) {
    return { error: "Sign in with your own admin account to switch accounts." };
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
    return { error: "Couldn’t switch accounts. Your current session is unchanged. Refresh the list and try again." };
  }
}

export async function switchQaAccount(
  _previous: AccountSwitchResult, data: FormData,
): Promise<AccountSwitchResult> {
  if (!(await isTestSwitcherUnlocked())) return { error: "Testing access has expired. Sign in as an admin to enable it again." };
  const session = await auth();
  if (session?.impersonation) return { error: "Use Switch account in the viewing banner so you can return to your admin account." };
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  try {
    if (email === "signed-out") {
      await signOut({ redirect: false });
      return { destination: data.get("redirectTo") === "/test" ? "/test" : "/" };
    }
    const persona = findQaPersona(email);
    if (!persona) return { error: "Choose one of the listed test accounts." };
    await provisionQaPersona(persona.email);
    if (accountSwitchActor(session, isAdminEmail)) {
      const result = await getPostgresPool()?.query<{ id: string }>(
        "select id::text from profiles where email = $1::citext", [persona.email],
      );
      if (!result?.rows[0]) return { error: "This persona has no profile yet. Start it from the testing workspace first." };
      await signIn("admin-account-switch", { targetId: result.rows[0].id, redirect: false });
    } else {
      await signIn("test-login", { email: persona.email, redirect: false });
    }
    return { destination: "/post-login" };
  } catch {
    return { error: "Couldn’t open this test account. Your current session is unchanged. Please try again." };
  }
}
