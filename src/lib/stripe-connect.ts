import type Stripe from "stripe";
import { getStripeClient } from "./stripe";
import type { StoredRequirement } from "./stripe-requirements";

// Stripe Connect helpers for the post-approval merchant onboarding flow
// (/merchant/onboarding). Sibling to src/lib/stripe.ts - reuses its singleton
// client (callers build return/refresh URLs with getAppUrl()).
//
// We use the Accounts v2 API (POST /v2/core/accounts) with `controller`-style
// responsibilities rather than the legacy `type: 'express'` accounts. The
// platform pays Stripe fees and is liable for losses (fees_collector /
// losses_collector = 'application'), and connected accounts get a lightweight
// Express dashboard. Funds move via destination charges with `on_behalf_of`
// (the checkout route), which makes the HOST the merchant of record: their name
// is on the buyer's card statement. Click still carries fees, refunds and
// chargebacks through the platform balance. Here we only create the account and
// drive Stripe's hosted onboarding so the merchant submits their bank details +
// KYC.

export type ConnectAccountStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  // What Stripe still wants and by when (fix 4) - stored on merchant_profiles
  // so the payouts page can say it in plain words.
  requirements: StoredRequirement[];
  requirementsDueAt: string | null;
};

// Everything signup already collected, so Stripe's form does not ask again
// (fix 5). Only business-level fields: the street address is the venue's, never
// a sole trader's home address, so it is only sent for a company.
export type MerchantForConnect = {
  contactEmail: string;
  businessName: string;
  tradingName?: string | null;
  businessType?: string | null;
  country?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  abn?: string | null;
  acn?: string | null;
  addressStreet?: string | null;
  addressSuburb?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  categories?: string[];
};

export function isStripeConnectConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// True only for ids that name a real Stripe Connect account. The DB seed
// (database/002_seed.sql) plants placeholder ids like `acct_seed_theo` so the
// fixtures look onboarded; those don't exist in Stripe, so reusing one makes
// accountLinks.create 404 ("resource cannot be found"). Treat any placeholder
// as "no account" so the onboarding flow creates a real one instead.
export function isRealConnectAccountId(
  accountId: string | null | undefined,
): accountId is string {
  return Boolean(accountId) && /^acct_[A-Za-z0-9]+$/.test(accountId!) && !accountId!.startsWith("acct_seed_");
}

// Platform take rate, in basis points (100 = 1%). Default 0 - we route the
// full charge to the merchant. Flip via env when we turn on platform fees;
// `calculateApplicationFee` then returns the cut Stripe will retain from each
// destination charge before transferring to the merchant.
export function getPlatformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS;
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Cap at 50% to avoid an obviously-wrong env value reaching Stripe.
  return Math.min(n, 5000);
}

export function calculateApplicationFee(
  priceCents: number,
  feeBps = getPlatformFeeBps(),
): number {
  if (priceCents <= 0) return 0;
  const bps = Math.max(0, Math.min(Math.round(feeBps), 5000));
  if (bps === 0) return 0;
  // floor - round in the platform's favour would surprise merchants; round
  // down so the merchant sees a clean number.
  return Math.floor((priceCents * bps) / 10000);
}

// merchant_profiles.business_type → v2 identity.entity_type. Only the two we
// can map without guessing: a sole trader onboards as an individual, a company
// as a company. A partnership or a trust is left unset so Stripe's own form
// asks - sending either as "company" put them through a company flow asking
// for a registered company they may not have (fix 6).
function toEntityType(
  businessType: string | null | undefined,
): "company" | "individual" | undefined {
  if (businessType === "sole_trader") return "individual";
  if (businessType === "company") return "company";
  return undefined;
}

// AU national number (normalizeAuPhone's output) → E.164, which is what Stripe
// takes. 13/1300/1800 lines and bare local numbers have no E.164 form we can
// be sure of, so they are left for Stripe's form.
function toE164(phone: string | null | undefined): string | undefined {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (/^0[23478]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^61[23478]\d{8}$/.test(digits)) return `+${digits}`;
  return undefined;
}

function digitsOfLength(value: string | null | undefined, length: number): string | undefined {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  return digits.length === length ? digits : undefined;
}

function httpsUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

type AccountCreateParams = Stripe.V2.Core.AccountCreateParams;

// The prefill half of the create call. Every field is optional and checked
// here, so a value Stripe would refuse is dropped rather than sent.
function prefillFor(merchant: MerchantForConnect): {
  identity: NonNullable<AccountCreateParams["identity"]>;
  profile: NonNullable<NonNullable<AccountCreateParams["defaults"]>["profile"]>;
} {
  const entityType = toEntityType(merchant.businessType);
  const phone = toE164(merchant.phone);
  const identity: NonNullable<AccountCreateParams["identity"]> = {
    country: (merchant.country ?? "AU").toUpperCase(),
    ...(entityType ? { entity_type: entityType } : {}),
  };
  if (entityType === "company") {
    const abn = digitsOfLength(merchant.abn, 11);
    const acn = digitsOfLength(merchant.acn, 9);
    const idNumbers = [
      ...(abn ? [{ type: "au_abn" as const, value: abn }] : []),
      ...(acn ? [{ type: "au_acn" as const, value: acn }] : []),
    ];
    const hasAddress = merchant.addressStreet && merchant.addressPostcode;
    identity.business_details = {
      // No registered_name: signup asks for "Business or host name" and says
      // your own name works, so it is not a legal name (fix 6). Stripe asks.
      ...(phone ? { phone } : {}),
      ...(idNumbers.length > 0 ? { id_numbers: idNumbers } : {}),
      ...(hasAddress
        ? {
            address: {
              country: identity.country!,
              line1: merchant.addressStreet!,
              city: merchant.addressSuburb ?? undefined,
              state: merchant.addressState ?? undefined,
              postal_code: merchant.addressPostcode!,
            },
          }
        : {}),
    };
  } else if (entityType === "individual" && phone) {
    identity.individual = { phone };
  }

  const categories = (merchant.categories ?? []).filter(Boolean);
  const website = httpsUrl(merchant.websiteUrl);
  return {
    identity,
    profile: {
      doing_business_as: (merchant.tradingName || merchant.businessName).trim(),
      ...(website ? { business_url: website } : {}),
      product_description:
        categories.length > 0
          ? `Tickets to social events hosted on Click (${categories.join(", ")}).`
          : "Tickets to social events hosted on Click.",
    },
  };
}

function requireClient(): Stripe {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  }
  return stripe;
}

// Creates a connected account. Prefills what signup already collected so the
// hosted flow has less to ask for (fix 5).
//
// One account per host (fix 3): ensureMerchantConnectAccount holds the merchant
// row lock across this call, so a second tap waits and then finds the saved id.
// The idempotency key covers the other gap - Stripe created the account and our
// save then failed. It is keyed on the saved attempt, whose details are reused
// as-is on the retry, so the retry sends the same body under the same key and
// Stripe returns the same account.
//
// `payoutsHeld` reports whether manual payouts took. It is no longer swallowed:
// the caller records it, and a paid event cannot publish until it has (fix 3b).
export async function createConnectedAccount(
  merchant: MerchantForConnect,
  options: { merchantProfileId: string; attemptId: string },
): Promise<{ accountId: string; payoutsHeld: boolean }> {
  const stripe = requireClient();
  const { identity, profile } = prefillFor(merchant);
  const params: AccountCreateParams = {
    dashboard: "express",
    contact_email: merchant.contactEmail,
    display_name: merchant.businessName,
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
      profile,
    },
    identity,
    configuration: {
      // card_payments: accept event payments. stripe_transfers: receive the
      // platform's destination transfers. Requesting either also requests
      // stripe_balance.payouts, the capability that pays out to their bank.
      merchant: { capabilities: { card_payments: { requested: true } } },
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
    },
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "identity",
      "requirements",
    ],
    // The merchant id makes any orphan traceable from the Stripe dashboard.
    metadata: { app: "click", merchant_profile_id: options.merchantProfileId },
  };
  const key = `click-connect-${options.merchantProfileId}-${options.attemptId}`;

  let account: Stripe.V2.Core.Account;
  try {
    account = await stripe.v2.core.accounts.create(params, { idempotencyKey: key });
  } catch (error) {
    // A prefilled value Stripe refuses must not stop a host connecting at all.
    // Retry once with the bare minimum - a 400 created nothing, and the bare
    // body gets its own key. Not an idempotency refusal, though: that means
    // this key already created something.
    const refusal = error as { statusCode?: number; type?: string };
    if (refusal?.statusCode !== 400 || refusal.type === "StripeIdempotencyError") throw error;
    console.warn("[stripe-connect] prefilled account refused, retrying bare:", error);
    const bare: AccountCreateParams = {
      ...params,
      identity: {
        country: identity.country,
        ...(identity.entity_type ? { entity_type: identity.entity_type } : {}),
      },
      defaults: { responsibilities: params.defaults!.responsibilities },
    };
    account = await stripe.v2.core.accounts.create(bare, { idempotencyKey: `${key}-bare` });
  }

  const payoutsHeld = await holdPayouts(account.id).then(
    () => true,
    (error) => {
      console.warn("[stripe-connect] could not set manual payouts:", error);
      return false;
    },
  );
  return { accountId: account.id, payoutsHeld };
}

// Hosts are paid after their event, so their payouts are manual: Stripe keeps
// the money in their balance until releaseHeldPayouts (stripe-sync.ts) pays out
// what's no longer held (src/lib/payout-release.ts). v2 accounts take payout
// settings through the Balance Settings API, not the account object.
// Idempotent - the cron re-asserts it every run.
export async function holdPayouts(accountId: string): Promise<void> {
  const stripe = requireClient();
  await stripe.balanceSettings.update(
    { payments: { payouts: { schedule: { interval: "manual" } } } },
    { stripeAccount: accountId },
  );
}

// Single-use, ~5-min hosted onboarding URL. The merchant submits bank details
// + identity directly to Stripe; we never see raw bank data.
export async function createAccountOnboardingLink(
  accountId: string,
  opts: { returnUrl: string; refreshUrl: string },
): Promise<string> {
  const stripe = requireClient();
  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant", "recipient"],
        return_url: opts.returnUrl,
        refresh_url: opts.refreshUrl,
      },
    },
  });
  return link.url;
}

// Maps a retrieved v2 account to what we cache. Stripe remains the source of
// truth; merchant_profiles just caches this for gating + UI.
export function mapAccountStatus(
  account: Stripe.V2.Core.Account,
): ConnectAccountStatus {
  const merchant = account.configuration?.merchant;
  const recipient = account.configuration?.recipient;
  // Taking payments on Click is a destination charge, which needs BOTH the
  // card_payments capability and the transfers that move the host's share to
  // them. card_payments alone let a checkout start that Stripe then refused.
  const chargesEnabled =
    merchant?.capabilities?.card_payments?.status === "active" &&
    recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
  // Paying out to their bank is stripe_balance.payouts - not stripe_transfers,
  // which only means money can arrive in their Stripe balance (fix 8). Stripe
  // requests it on both configurations and calls the two identical.
  const payoutsEnabled =
    merchant?.capabilities?.stripe_balance?.payouts?.status === "active" ||
    recipient?.capabilities?.stripe_balance?.payouts?.status === "active";
  // No outstanding requirement is waiting on the merchant → they've submitted
  // everything Stripe currently needs. Fall back to capability state when the
  // requirements list isn't expanded.
  //
  // "Currently needs" is the operative word. Hosted onboarding collects what is
  // due now and leaves `eventually_due` entries on the account - still awaiting
  // the user, but not blocking anything today. Counting those told a host who
  // had just finished Stripe's form to "Continue on Stripe" (bug board #269),
  // and it also skipped the payouts page's hand-back to where they started.
  const entries = account.requirements?.entries ?? [];
  const awaitingUser = entries.some(
    (entry) =>
      entry.awaiting_action_from === "user" &&
      entry.minimum_deadline?.status !== "eventually_due",
  );
  const detailsSubmitted =
    entries.length === 0 ? chargesEnabled || payoutsEnabled : !awaitingUser;
  const requirements: StoredRequirement[] = entries.map((entry) => ({
    description: entry.description,
    awaiting: entry.awaiting_action_from,
    status: entry.minimum_deadline?.status ?? "currently_due",
    errors: (entry.errors ?? []).map((error) => error.description).filter(Boolean),
  }));
  // Only a deadline the host can act on: a date on something only Stripe is
  // checking, or on something not due yet, is not theirs to meet.
  const requirementsDueAt = awaitingUser
    ? account.requirements?.summary?.minimum_deadline?.time ?? null
    : null;
  return { chargesEnabled, payoutsEnabled, detailsSubmitted, requirements, requirementsDueAt };
}

// Single-use URL that drops the merchant into their Express dashboard so they
// can see payout history + bank details. Express dashboards are Stripe-hosted
// and don't require a Stripe account login of their own. The URL expires in
// ~5 minutes; never cache or persist it.
export async function createDashboardLoginUrl(accountId: string): Promise<string> {
  const stripe = requireClient();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export async function getConnectedAccountStatus(
  accountId: string,
): Promise<ConnectAccountStatus> {
  const stripe = requireClient();
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "requirements",
    ],
  });
  return mapAccountStatus(account);
}
