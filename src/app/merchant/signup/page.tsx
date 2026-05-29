import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StepAuthCard } from "@/components/merchant-signup-wizard";

// Entry point for /merchant/signup. Logged-in users are forwarded to the
// first wizard step; logged-out visitors get the OAuth/email auth gate.
// The "already a merchant" redirect (→ /merchant) lives in the layout, so it
// fires uniformly for every step page too.
export default async function MerchantSignupPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/merchant/signup/business");
  }

  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);

  return <StepAuthCard googleConfigured={googleConfigured} metaConfigured={metaConfigured} />;
}
