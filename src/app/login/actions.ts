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
