"use server";

import { redirect } from "next/navigation";
import { sendTransactionalEmail } from "@/lib/email";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function requestPasswordReset(formData: FormData) {
  const email = getFormValue(formData, "email").trim().toLowerCase();

  if (isValidEmail(email)) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const loginUrl = `${appUrl}/login?${new URLSearchParams({ email }).toString()}`;

    await sendTransactionalEmail({
      to: email,
      subject: "Continue to Click",
      text: [
        "You asked for help getting back into Click.",
        "Click currently uses email sign-in for the MVP. Use this link, enter your email, and continue into your account:",
        loginUrl,
        "If you did not request this, you can ignore this email.",
      ].join("\n\n"),
    });
  }

  redirect("/forgot-password?sent=1");
}
