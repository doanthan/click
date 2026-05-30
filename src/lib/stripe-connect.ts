import type Stripe from "stripe";
import { getStripeClient } from "./stripe";

// Stripe Connect helpers for the post-approval merchant onboarding flow
// (/merchant/onboarding). Sibling to src/lib/stripe.ts — reuses its singleton
// client (callers build return/refresh URLs with getAppUrl()).
//
// We use the Accounts v2 API (POST /v2/core/accounts) with `controller`-style
// responsibilities rather than the legacy `type: 'express'` accounts. The shape
// matches Stripe's marketplace quickstart: the platform is merchant of record,
// pays Stripe fees, is liable for losses (fees_collector/losses_collector =
// 'application'), and connected accounts get a lightweight Express dashboard.
// Funds move later via destination charges (out of scope for this task) — here
// we only create the account and drive Stripe's hosted onboarding so the
// merchant submits their bank details + KYC.

export type ConnectAccountStatus = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export type MerchantForConnect = {
  contactEmail: string;
  businessName: string;
  businessType?: string | null;
  country?: string | null;
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

// Platform take rate, in basis points (100 = 1%). Default 0 — we route the
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

export function calculateApplicationFee(priceCents: number): number {
  if (priceCents <= 0) return 0;
  const bps = getPlatformFeeBps();
  if (bps === 0) return 0;
  // floor — round in the platform's favour would surprise merchants; round
  // down so the merchant sees a clean number.
  return Math.floor((priceCents * bps) / 10000);
}

// merchant_profiles.business_type → v2 identity.entity_type. AU sole traders
// onboard as individuals; everything else as a company entity.
function toEntityType(
  businessType: string | null | undefined,
): "company" | "individual" {
  return businessType === "sole_trader" ? "individual" : "company";
}

function requireClient(): Stripe {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  }
  return stripe;
}

// Creates a connected account and returns its id. Prefills what we already
// collected during merchant signup so the hosted flow has less to ask for.
export async function createConnectedAccount(
  merchant: MerchantForConnect,
): Promise<string> {
  const stripe = requireClient();
  const account = await stripe.v2.core.accounts.create({
    dashboard: "express",
    contact_email: merchant.contactEmail,
    display_name: merchant.businessName,
    defaults: {
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    identity: {
      country: (merchant.country ?? "AU").toUpperCase(),
      entity_type: toEntityType(merchant.businessType),
      business_details: { registered_name: merchant.businessName },
    },
    configuration: {
      // card_payments: accept event payments. stripe_transfers: receive the
      // platform's destination transfers / payouts to their bank.
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
    metadata: { app: "click" },
  });
  return account.id;
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

// Maps a retrieved v2 account to our three tracked booleans. Stripe remains the
// source of truth; merchant_profiles just caches this for gating + UI.
export function mapAccountStatus(
  account: Stripe.V2.Core.Account,
): ConnectAccountStatus {
  const merchant = account.configuration?.merchant;
  const recipient = account.configuration?.recipient;
  const chargesEnabled =
    merchant?.capabilities?.card_payments?.status === "active";
  const stripeBalance = recipient?.capabilities?.stripe_balance;
  const payoutsEnabled =
    stripeBalance?.payouts?.status === "active" ||
    stripeBalance?.stripe_transfers?.status === "active";
  // No outstanding requirement is waiting on the merchant → they've submitted
  // everything Stripe currently needs. Fall back to capability state when the
  // requirements list isn't expanded.
  const entries = account.requirements?.entries ?? [];
  const awaitingUser = entries.some(
    (entry) => entry.awaiting_action_from === "user",
  );
  const detailsSubmitted =
    entries.length === 0 ? chargesEnabled || payoutsEnabled : !awaitingUser;
  return { chargesEnabled, payoutsEnabled, detailsSubmitted };
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
