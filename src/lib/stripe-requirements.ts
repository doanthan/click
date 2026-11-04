// What Stripe still wants from a host's connected account, in words a host can
// act on. Stripe's requirement `description` is a machine-readable field path
// (e.g. "individual.verification.document"); the payouts page used to collapse
// all of it into one "payouts connected" flag, so a host whose charges Stripe
// had paused for a missing ID was told they were ready (audit fix 4).
//
// Kept import-free so node --test can load it directly.

export type StoredRequirement = {
  // Stripe's field path, kept so a new kind of requirement still reads as
  // something rather than vanishing.
  description: string;
  // Who has to act: the host ('user'), or Stripe itself ('stripe') - e.g. a
  // document already sent that Stripe is checking.
  awaiting: "user" | "stripe";
  // Stripe's deadline status for it.
  status: "currently_due" | "eventually_due" | "past_due";
  // Stripe's own human-readable reasons a submitted value was refused.
  errors: string[];
};

// Most specific first: the first match wins.
const PLAIN_WORDS: Array<[RegExp, string]> = [
  [/additional_document|proof_of_address/, "a document that shows your address"],
  [/verification\.document|identity_document|\.document\b|passport|drivers?_licen[cs]e/, "a photo of your ID"],
  [/selfie/, "a selfie to match your ID"],
  [/external_account|bank_account|payout_method/, "your bank account"],
  [/date_of_birth|\bdob\b/, "your date of birth"],
  [/id_number|tax_id|\babn\b|\bacn\b/, "your ABN or ID number"],
  [/owners|directors|executives|representative|persons?\b|relationship/, "details of the people who own or run the business"],
  [/terms_of_service|tos_acceptance|\btos\b|attestation/, "to accept Stripe's terms"],
  [/business_url|\burl\b|product_description|business_profile|mcc/, "a short description of what you sell, or your website"],
  [/phone/, "a phone number"],
  [/address/, "an address"],
  [/registered_name|legal_name|company\.name|business_details\.name/, "your business's legal name"],
  [/given_name|surname|first_name|last_name|\bname\b/, "your full name"],
];

/** One requirement as a short noun phrase: "a photo of your ID". */
export function requirementInPlainWords(description: string): string {
  const path = description.toLowerCase();
  for (const [pattern, words] of PLAIN_WORDS) {
    if (pattern.test(path)) return words;
  }
  return "a few more details";
}

/**
 * The distinct things the host has to do, in plain words, soonest first.
 * `eventually_due` items are left out: they block nothing today, and showing
 * them is what told hosts who had just finished Stripe's form to go back
 * (bug board #269).
 */
export function hostRequirementPhrases(requirements: StoredRequirement[]): string[] {
  const rank = { past_due: 0, currently_due: 1, eventually_due: 2 } as const;
  const due = requirements
    .filter((entry) => entry.awaiting === "user" && entry.status !== "eventually_due")
    .sort((a, b) => rank[a.status] - rank[b.status]);
  return Array.from(new Set(due.map((entry) => requirementInPlainWords(entry.description))));
}

/** True when the only thing left is Stripe checking what it already has. */
export function onlyStripeIsReviewing(requirements: StoredRequirement[]): boolean {
  return (
    hostRequirementPhrases(requirements).length === 0 &&
    requirements.some((entry) => entry.awaiting === "stripe" && entry.status !== "eventually_due")
  );
}

/** "a, b and c" - for one sentence of what Stripe needs. */
export function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases[0] ?? "";
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}
