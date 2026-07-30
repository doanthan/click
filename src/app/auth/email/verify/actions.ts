"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getMagicLinkDestination } from "@/lib/auth-magic-link";

export async function confirmEmailSignIn(formData: FormData) {
  const tokenValue = formData.get("token");
  const token = typeof tokenValue === "string" ? tokenValue : "";
  const redirectTo = await getMagicLinkDestination(token);
  if (!redirectTo) redirect("/login?error=InvalidMagicLink");

  await signIn("email-magic-link", { token, redirectTo });
}
