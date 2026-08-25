import Stripe from "stripe";
import { isProductionDeployment } from "./runtime-mode";

declare global {
  var clickStripeClient: Stripe | undefined;
}

// Opt-in escape hatch for pointing the production deployment at a Stripe
// sandbox (UAT on the real domain, before we take real money). Unset - the
// default, and the launch state - leaves the live-only refusal below exactly as
// it was, so forgetting this var can never silently arm test mode.
//
// Setting it is NOT sufficient on its own. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
// is inlined at build, so the browser keeps whatever key the last build baked
// in until you redeploy - and a split pair (test secret, live publishable)
// fails at the payment step with a client_secret mode mismatch. Merchants'
// stripe_connect_account_id values are live-mode objects too: they 404 under a
// test key until each host re-runs /merchant/onboarding.
function isStripeTestModeAllowed() {
  return process.env.STRIPE_ALLOW_TEST_MODE === "true";
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (
    isProductionDeployment() &&
    !isStripeTestModeAllowed() &&
    !secretKey.startsWith("sk_live_")
  ) {
    console.error("[stripe] Refusing to initialize a non-live Stripe key in production.");
    return null;
  }

  if (!globalThis.clickStripeClient) {
    globalThis.clickStripeClient = new Stripe(secretKey, {
      apiVersion: "2026-05-27.dahlia",
      typescript: true,
    });
  }

  return globalThis.clickStripeClient;
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

// Stripe splits v1 (snapshot payload) and v2 (thin payload) events across two
// separate event destinations, each with its own signing secret. Both post to
// /api/webhooks/stripe; the route picks the secret by payload shape. Unset →
// v2 notifications are rejected, and Connect status only refreshes when the
// host revisits /merchant/onboarding/payouts.
export function getStripeWebhookSecretV2() {
  return process.env.STRIPE_WEBHOOK_SECRET_V2 ?? null;
}

export function getAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  // Stripe redirects (checkout success_url/return_url, Connect onboarding return)
  // must land on the canonical www host. The bare apex letsclick.app only
  // 307-redirects to www — and that extra hop times out behind strict corporate
  // proxies (e.g. hospital/clinical networks), surfacing as ERR_TIMED_OUT on the
  // post-payment return page even though the charge succeeded. Force www so the
  // browser never touches the apex. Idempotent + scoped to this one domain; any
  // other host (localhost, previews) is left untouched. See CLAUDE.md (apex note).
  return raw.replace("://letsclick.app", "://www.letsclick.app");
}
