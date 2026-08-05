"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { profileExistsByEmail } from "@/lib/event-repository";
import { assertTestSwitcherUnlocked } from "@/lib/test-switcher";
import { provisionQaPersona, resetQaData } from "@/lib/qa-provision";
import {
  TOKEN_TTL_MINUTES,
  issueMagicLink,
  revokeMagicLink,
} from "@/lib/auth-magic-link";
import { renderTemplate, sendTransactionalEmail } from "@/lib/email";

const SUPPORT_EMAIL = "hello@letsclick.app";

// Only reached when the .html template can't be read - the real subject and
// copy live in /emails and src/lib/email.ts. Kept so a filesystem problem
// degrades the look of the mail instead of locking everyone out of sign-in.
const FALLBACK_SUBJECT = {
  "signin-link": "Your Click sign-in link",
  "signup-link": "Finish creating your Click account",
  "signin-no-account": "No Click account on this address yet",
} as const;

const FALLBACK_LEAD = {
  "signin-link": "Continue signing in to Click.",
  "signup-link": "Finish creating your Click account.",
  "signin-no-account":
    "There is no Click account on this address yet. This link creates one.",
} as const;

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

  // Signing in on an address with no account is not an error and must not look
  // like one: answering "no such account" hands out a user-enumeration oracle.
  // So the token is issued either way and only the template that lands in that
  // inbox differs - the browser response is identical, and so is the rate
  // limiting. (It did NOT used to be: this branch returned early without
  // touching issueMagicLink, so a known address started returning RateLimited
  // after 5 tries while an unknown one never did. Six posts told you whether an
  // account existed.) Issuing it as a signup is what makes the link in that
  // email actually work - one tap creates the account.
  const noAccount =
    purpose === "login" && !(await profileExistsByEmail(input.email));
  const tokenPurpose = noAccount ? "signup" : purpose;

  let token: string;
  try {
    token = await issueMagicLink({
      email: input.email,
      redirectTo: input.callbackUrl,
      purpose: tokenPurpose,
      clientIp: await clientIp(),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitError") {
      return { error: "RateLimited", sent: false };
    }
    return { error: "EmailUnavailable", sent: false };
  }

  const verifyUrl = `${publicAppUrl()}/auth/email/verify?${new URLSearchParams({ token })}`;
  const expiryWindowLabel = `${TOKEN_TTL_MINUTES} minutes`;

  // Deliberately NOT logEmailEvent, unlike every other templated email. Two
  // reasons: this is the one send whose result gates a side effect (a failed
  // delivery must revoke the token below, and logEmailEvent is void +
  // fire-and-forget), and an email_events row would park a live one-time
  // sign-in URL in a queryable table that the retry cron could re-deliver
  // after the token was already revoked.
  // Falls back to the plain-text auto-HTML if the template can't be read, so a
  // missing /emails file degrades the look of the mail instead of locking
  // everyone out of sign-in.
  const template = noAccount
    ? "signin-no-account"
    : tokenPurpose === "signup"
      ? "signup-link"
      : "signin-link";

  const rendered = await renderTemplate(template, {
    verifyUrl,
    expiryWindowLabel,
    attemptedEmail: input.email,
    supportEmail: SUPPORT_EMAIL,
  }).catch((error) => {
    console.warn("magic-link template render failed", { template, error });
    return null;
  });

  const delivery = await sendTransactionalEmail({
    to: input.email,
    subject: rendered?.subject ?? FALLBACK_SUBJECT[template],
    html: rendered?.html,
    text: [
      FALLBACK_LEAD[template],
      verifyUrl,
      `This link expires in ${expiryWindowLabel} and can only be used once.`,
      "If you did not request it, you can ignore this email.",
    ].join("\n\n"),
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

// Clear the session from the persona switcher so you can exercise the
// signed-out ("Not signed in") state without leaving wherever you're testing.
// `redirectTo` is constrained to a local path and defaults to "/".
//
// SECURITY: local dev, or a deployed environment where this browser holds the
// TEST_SWITCHER_KEY unlock cookie. See src/lib/test-switcher.ts.
export async function signOutOfTestAccount(formData: FormData) {
  await assertTestSwitcherUnlocked("QA persona sign-out");
  const next = getFormValue(formData, "redirectTo");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  await signOut({ redirectTo: dest });
}

// Instant sign-in as one of the seeded QA personas so you can hop between
// attendee / merchant / admin without the login/logout dance. Funnels through
// /post-login like every other sign-in, so the destination is decided by the
// same admin/merchant/onboarding gates - the persona is a real session, not a
// bypass of the routing you are trying to test.
//
// SECURITY: unlocked QA session only, and only the @click.local namespace that
// 032_clear_seed_data.sql sweeps. The provider itself re-checks the same gate.
export async function signInAsTestAccount(formData: FormData) {
  await assertTestSwitcherUnlocked("QA persona sign-in");
  const email = getFormValue(formData, "email").toLowerCase();
  if (!email.endsWith("@click.local")) return;

  // Make the persona real before minting the session, so there is no seed
  // script to run first and no half-provisioned state to explain. Deliberately
  // NOT caught: signing you in as a persona whose rows failed to write would
  // put you in a state you'd then report as a bug.
  await provisionQaPersona(email);

  await signIn("test-login", { email, redirectTo: "/post-login" });
}

// Delete every QA persona and their events so the sign-up journeys start from
// zero again - the merchant application in particular is one-way, so without
// this you can only walk it once. Signs you out, since the session's own
// profile is one of the rows being removed.
export async function resetTestAccounts() {
  await assertTestSwitcherUnlocked("QA data reset");
  await resetQaData();
  await signOut({ redirectTo: "/" });
}

// Kick off a /test journey as the persona's seeded account. Unlike
// signInAsTestAccount, this lands directly on the journey's first step (`next`)
// instead of funneling through /post-login, so you walk the journey from where
// it actually begins rather than being re-routed by the role gates. `next` is
// constrained to a local path.
//
// SECURITY: same unlock and @click.local restrictions as the switcher.
export async function startTestJourney(formData: FormData) {
  await assertTestSwitcherUnlocked("Test journeys");
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
