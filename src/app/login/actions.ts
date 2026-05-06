"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeCallbackUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
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
      password: getFormValue(formData, "password"),
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
