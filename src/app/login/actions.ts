"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Every sign-in is funneled through /post-login so the admin gate there can
// override the requested destination (admins always land on /admin). For
// non-admins, the original target is preserved as ?next=<value> and applied by
// /post-login after its admin/onboarding/merchant checks.
function safeCallbackUrl(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/post-login";
  if (value === "/post-login" || value.startsWith("/post-login?")) return value;
  return `/post-login?next=${encodeURIComponent(value)}`;
}

function redirectWithAuthError(error: AuthError, callbackUrl: string) {
  const params = new URLSearchParams({
    error: error.type,
    callbackUrl,
  });

  redirect(`/login?${params.toString()}`);
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", {
    redirectTo: safeCallbackUrl(getFormValue(formData, "callbackUrl")),
  });
}

export async function signInWithMeta(formData: FormData) {
  await signIn("facebook", {
    redirectTo: safeCallbackUrl(getFormValue(formData, "callbackUrl")),
  });
}

export async function signInWithEmail(formData: FormData) {
  const callbackUrl = safeCallbackUrl(getFormValue(formData, "callbackUrl"));

  try {
    await signIn("email-login", {
      email: getFormValue(formData, "email"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirectWithAuthError(error, callbackUrl);
    }

    throw error;
  }
}

export async function signOutOfClick() {
  await signOut({ redirectTo: "/" });
}

// Clear the session from the test-account switcher so you can exercise the
// signed-out ("Not signed in") state without leaving wherever you're testing.
// `redirectTo` is constrained to a local path and defaults to "/".
//
// SECURITY: previously gated to DEVELOPMENT. The gate has been removed so the
// switcher works on a private/staging deploy — meaning anyone who can reach the
// site can sign in (passwordless) as any seeded account, including admin. Do
// NOT expose this deployment to the public internet.
export async function signOutOfTestAccount(formData: FormData) {
  const next = getFormValue(formData, "redirectTo");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  await signOut({ redirectTo: dest });
}

// Instant sign-in as one of the seeded test accounts so you can hop between
// Attendee / Merchant / Admin without the login/logout dance. Funnels through
// /post-login like every other sign-in, so the destination is decided by the
// same admin/merchant/onboarding gates.
//
// SECURITY: the DEVELOPMENT gate has been removed at the owner's request so this
// works on a private/staging deploy. It now impersonates ANY seeded account
// (including admin) by email alone, with no password. Keep this deployment
// private — do NOT expose it to the public internet.
export async function signInAsTestAccount(formData: FormData) {
  const email = getFormValue(formData, "email").toLowerCase();
  if (!email.includes("@")) return;

  await signIn("email-login", { email, redirectTo: "/post-login" });
}

// Kick off a /test journey as the persona's seeded account. Unlike
// signInAsTestAccount, this lands directly on the journey's first step (`next`)
// instead of funneling through /post-login, so you walk the journey from where
// it actually begins rather than being re-routed by the role gates. `next` is
// constrained to a local path.
//
// SECURITY: same caveat as signInAsTestAccount — the DEVELOPMENT gate is gone,
// so this is passwordless impersonation by email. Keep the deployment private.
export async function startTestJourney(formData: FormData) {
  const email = getFormValue(formData, "email").toLowerCase();
  if (!email.includes("@")) return;

  const next = getFormValue(formData, "next");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/post-login";

  await signIn("email-login", { email, redirectTo: dest });
}

export type EmailLoginFormState = { error: string | null };

const errorCopyByType: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  Configuration: "Authentication is missing provider or secret configuration.",
};

export async function signInWithEmailFromModal(
  _prev: EmailLoginFormState,
  formData: FormData,
): Promise<EmailLoginFormState> {
  const callbackUrl = safeCallbackUrl(getFormValue(formData, "callbackUrl"));

  try {
    await signIn("email-login", {
      email: getFormValue(formData, "email"),
      redirectTo: callbackUrl,
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: errorCopyByType[error.type] ?? "Login failed." };
    }
    throw error;
  }
}
