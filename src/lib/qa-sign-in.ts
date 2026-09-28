import "server-only";
import { auth, isAdminEmail, signIn } from "@/auth";
import { accountSwitchActor } from "@/lib/account-switch-policy";
import { nameFromEmail } from "@/lib/display-name";
import { ensureProfileForSession } from "@/lib/event-repository";
import { findQaPersona } from "@/lib/qa-personas";

/**
 * Sign this browser in as a QA persona. Callers have already checked the QA
 * unlock and provisioned the persona - this only decides HOW to sign in.
 *
 * A real admin goes through the audited `admin-account-switch` provider, so the
 * new session still names them as the actor: "Return to my admin account" keeps
 * working however many test people they hop through. Everyone else - a tester
 * on TEST_SWITCHER_KEY, or a QA persona's own session - has no admin account to
 * go back to and uses `test-login`.
 *
 * Neither path lets Auth.js navigate (`redirect: false`). Callers redirect with a
 * relative path so the browser stays on the origin it submitted from.
 */
export async function signInAsQaPersona(email: string) {
  const persona = findQaPersona(email);
  // ensureProfileForSession below creates a profile for whatever address it is
  // given, so nothing outside the seeded roster may get this far.
  if (!persona) throw new Error("Not a QA persona.");

  if (!accountSwitchActor(await auth(), isAdminEmail)) {
    await signIn("test-login", { email: persona.email, redirect: false });
    return;
  }

  // The admin provider opens an existing profile by id, but a blank persona
  // (New customer) has no row until its first sign-in creates one. Create it
  // the way that first request would, welcome email included.
  const profile = await ensureProfileForSession({
    user: { email: persona.email, name: nameFromEmail(persona.email) || persona.email },
    expires: "",
  });
  await signIn("admin-account-switch", { targetId: profile.id, redirect: false });
}
