// The v1 Stripe events /api/webhooks/stripe acts on, which the live webhook
// endpoint must be subscribed to (fix 2). A route handling an event Stripe was
// never told to send is the same as no handler: the 2 Oct check found no
// payout.* events at all, which is why host payout statuses never moved.
// `npm run launch:check` reads this list and compares it with the endpoints
// Stripe has on file; tests/merchant-stripe-audit.test.mjs keeps it in step
// with the route's switch. Import-free so the release script can load it.
//
// Payout and account events happen ON connected accounts, so they only arrive
// at an endpoint listening to connected accounts (CONNECTED_ACCOUNT_WEBHOOK_EVENTS),
// which signs with STRIPE_WEBHOOK_SECRET_CONNECT. The v1 endpoint list does not
// say which accounts an endpoint listens to; the v2 event destinations list
// does (`events_from: ["@accounts"]`), and launch:check reads it.
export const REQUIRED_STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.canceled",
  "charge.refunded",
  "charge.refund.updated",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "account.updated",
] as const;

/** The required events that only fire on hosts' connected accounts. */
export const CONNECTED_ACCOUNT_WEBHOOK_EVENTS = [
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "account.updated",
] as const;

/** The connected-account events no connected-accounts destination covers. */
export function missingConnectedAccountEvents(
  destinations: { events_from?: string[] | null; enabled_events?: string[] | null; status?: string }[],
): string[] {
  const enabled = new Set(
    destinations
      .filter(
        (d) =>
          d.status === "enabled" &&
          (d.events_from ?? []).some((scope) => scope.endsWith("@accounts")),
      )
      .flatMap((d) => d.enabled_events ?? []),
  );
  if (enabled.has("*")) return [];
  return CONNECTED_ACCOUNT_WEBHOOK_EVENTS.filter((event) => !enabled.has(event));
}

/** The required events an endpoint set is missing ('*' covers everything). */
export function missingWebhookEvents(enabledEvents: string[]): string[] {
  if (enabledEvents.includes("*")) return [];
  const enabled = new Set(enabledEvents);
  return REQUIRED_STRIPE_WEBHOOK_EVENTS.filter((event) => !enabled.has(event));
}
