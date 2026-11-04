// The v1 Stripe events /api/webhooks/stripe acts on, which the live webhook
// endpoint must be subscribed to (fix 2). A route handling an event Stripe was
// never told to send is the same as no handler: the 2 Oct check found no
// payout.* events at all, which is why host payout statuses never moved.
// `npm run launch:check` reads this list and compares it with the endpoints
// Stripe has on file; tests/merchant-stripe-audit.test.mjs keeps it in step
// with the route's switch. Import-free so the release script can load it.
//
// Payout and account events happen ON connected accounts, so they only arrive
// at an endpoint with "Events from connected accounts" on. Stripe's API does
// not report that flag, so the launch check can only remind you to look.
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

/** The required events an endpoint set is missing ('*' covers everything). */
export function missingWebhookEvents(enabledEvents: string[]): string[] {
  if (enabledEvents.includes("*")) return [];
  const enabled = new Set(enabledEvents);
  return REQUIRED_STRIPE_WEBHOOK_EVENTS.filter((event) => !enabled.has(event));
}
