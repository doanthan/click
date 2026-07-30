"use server";

import { signInWithEmail } from "@/app/login/actions";

// Passwords are no longer stored. Keep the legacy route as a friendly entry
// point, but send the same expiring, single-use magic link as the login form.
export async function requestPasswordReset(formData: FormData) {
  await signInWithEmail(formData);
}
