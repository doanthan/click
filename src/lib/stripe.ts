import Stripe from "stripe";
import { isProductionDeployment } from "./runtime-mode";

declare global {
  var clickStripeClient: Stripe | undefined;
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (isProductionDeployment() && !secretKey.startsWith("sk_live_")) {
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
