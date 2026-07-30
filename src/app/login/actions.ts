"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { profileExistsByEmail } from "@/lib/event-repository";
import { assertLocalDevelopment } from "@/lib/runtime-mode";
import { issueMagicLink, revokeMagicLink } from "@/lib/auth-magic-link";
import { sendTransactionalEmail } from "@/lib/email";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Basic deliverable-shape check: one @, a dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailSignInGate(email: string): string | null {
  if (!EMAIL_RE.test(email)) return "InvalidEmail";
  return null;
}

function publicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured.replace("://letsclick.app", "://www.letsclick.app");
  return "http://localhost:3000";
}

async function clientIp() {
  const incoming = await headers();
  return incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip");
}

async function requestEmailSignIn(input: {
  email: string;
  mode: string;
  callbackUrl: string;
}) {
  const gateError = emailSignInGate(input.email);
  if (gateError) return { error: gateError, sent: false };

  const purpose = input.mode === "login" ? "login" : "signup";
  // Never reveal account existence on a login surface. Unknown addresses get
  // the same success state, but no token is created or email sent.
  if (purpose === "login" && !(await profileExistsByEmail(input.email))) {
    return { error: null, sent: true };
  }

  let token: string;
  try {
    token = await issueMagicLink({
      email: input.email,
      redirectTo: input.callbackUrl,
      purpose,
      clientIp: await clientIp(),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitError") {
      return { error: "RateLimited", sent: false };
    }
    return { error: "EmailUnavailable", sent: false };
  }

  const verifyUrl = `${publicAppUrl()}/auth/email/verify?${new URLSearchParams({ token })}`;
  const delivery = await sendTransactionalEmail({
    to: input.email,
    subject: purpose === "signup" ? "Finish creating your Click account" : "Your Click sign-in link",
    text: [
      purpose === "signup" ? "Finish creating your Click account." : "Continue signing in to Click.",
      verifyUrl,
      "This link expires in 15 minutes and can only be used once.",
      "If you did not request it, you can ignore this email.",
    ].join("\n\n"),
    html: `<p>${purpose === "signup" ? "Finish creating your Click account." : "Continue signing in to Click."}</p><p><a href="${verifyUrl}">Continue to Click</a></p><p>This link expires in 15 minutes and can only be used once.</p><p>If you did not request it, you can ignore this email.</p>`,
  });
  if (!delivery.sent) {
    await revokeMagicLink(token).catch(() => undefined);
    return { error: "EmailUnavailable", sent: false };
  }

  return { error: null, sent: true };
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
  const rawCallback = getFormValue(formData, "callbackUrl");
  const callbackUrl = safeCallbackUrl(rawCallback);
  const email = getFormValue(formData, "email").trim().toLowerCase();
  const mode = getFormValue(formData, "mode");

  const result = await requestEmailSignIn({ email, mode, callbackUrl });
  if (result.error) {
    redirect(
      `/login?${new URLSearchParams({ error: result.error, callbackUrl: rawCallback }).toString()}`,
    );
  }
  redirect(`/login?${new URLSearchParams({ emailSent: "1", callbackUrl: rawCallback }).toString()}`);
}

export async function signOutOfClick() {
  await signOut({ redirectTo: "/" });
}

// Clear the session from the test-account switcher so you can exercise the
// signed-out ("Not signed in") state without leaving wherever you're testing.
// `redirectTo` is constrained to a local path and defaults to "/".
//
// SECURITY: this action is hard-gated to the local Next.js dev server.
export async function signOutOfTestAccount(formData: FormData) {
  assertLocalDevelopment("Test-account sign-out");
  const next = getFormValue(formData, "redirectTo");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  await signOut({ redirectTo: dest });
}

// Instant sign-in as one of the seeded test accounts so you can hop between
// Attendee / Merchant / Admin without the login/logout dance. Funnels through
// /post-login like every other sign-in, so the destination is decided by the
// same admin/merchant/onboarding gates.
//
// SECURITY: this action is hard-gated to the local Next.js dev server and only
// accepts the seeded @click.local namespace.
export async function signInAsTestAccount(formData: FormData) {
  assertLocalDevelopment("Test-account sign-in");
  const email = getFormValue(formData, "email").toLowerCase();
  if (!email.endsWith("@click.local")) return;

  await signIn("test-login", { email, redirectTo: "/post-login" });
}

// Kick off a /test journey as the persona's seeded account. Unlike
// signInAsTestAccount, this lands directly on the journey's first step (`next`)
// instead of funneling through /post-login, so you walk the journey from where
// it actually begins rather than being re-routed by the role gates. `next` is
// constrained to a local path.
//
// SECURITY: same local-only and @click.local restrictions as the switcher.
export async function startTestJourney(formData: FormData) {
  assertLocalDevelopment("Test journeys");
  const email = getFormValue(formData, "email").toLowerCase();
  if (!email.endsWith("@click.local")) return;

  const next = getFormValue(formData, "next");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/post-login";

  await signIn("test-login", { email, redirectTo: dest });
}

export type EmailLoginFormState = { error: string | null; sent: boolean };

const errorCopyByType: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  Configuration: "Authentication is missing provider or secret configuration.",
  InvalidEmail: "Enter a valid email address to continue.",
  EmailNotFound: "No account found for that email. Check the spelling, or sign up.",
  RateLimited: "Too many sign-in emails were requested. Try again in an hour.",
  EmailUnavailable: "We could not send a sign-in email right now. Try Google or try again later.",
};

export async function signInWithEmailFromModal(
  _prev: EmailLoginFormState,
  formData: FormData,
): Promise<EmailLoginFormState> {
  const callbackUrl = safeCallbackUrl(getFormValue(formData, "callbackUrl"));
  const email = getFormValue(formData, "email").trim().toLowerCase();
  const mode = getFormValue(formData, "mode");

  const result = await requestEmailSignIn({ email, mode, callbackUrl });
  return {
    error: result.error ? errorCopyByType[result.error] ?? "Login failed." : null,
    sent: result.sent,
  };
}
