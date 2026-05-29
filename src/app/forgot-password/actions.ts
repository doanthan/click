"use server";

import { redirect } from "next/navigation";
import { logEmailEvent, sendTransactionalEmail } from "@/lib/email";

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

    // Mirror to email_events so the dev log captures the reset/sign-in link.
    // Fire-and-forget — never blocks the redirect or leaks whether the email
    // exists (we log on any well-formed address, same as the send above).
    void logEmailEvent({
      template: "password-reset",
      toEmail: email,
      vars: {
        resetUrl: loginUrl,
        expiryWindowLabel: "60 minutes",
        requestIpLabel: "",
        supportEmail: "hello@click.app",
      },
    });
  }

  redirect("/forgot-password?sent=1");
}
