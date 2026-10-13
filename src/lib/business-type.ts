// How a host's business is legally set up: the four values the
// merchant_profiles.business_type check constraint allows
// (database/009_merchant_full_signup.sql), in the order they are offered.
//
// Only Stripe reads it - it picks the Connect account's entity type
// (toEntityType in stripe-connect.ts), and a sole trader sent through the
// company flow is asked for a company name and ACN they do not have. So it is
// asked at the payout step, the first time a host connects, not at signup:
// a host who only runs free events never sees the question.
//
// No imports on purpose - the payout button (client) and the connect route
// (server) both read this one list.
export const BUSINESS_TYPES = [
  { value: "sole_trader", label: "Sole trader" },
  { value: "company", label: "Company" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export function isBusinessType(value: unknown): value is BusinessType {
  return BUSINESS_TYPES.some((type) => type.value === value);
}
