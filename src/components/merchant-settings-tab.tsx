import { auth } from "@/auth";
import { getProfileStatus, type MerchantProfileRow } from "@/lib/event-repository";
import { Button, ButtonLink, Icon } from "@/components/ds";
import { InfoNote, SectionLabel, StatusPill, mCard } from "@/components/merchant-ds";
import { TabHeader } from "./merchant-portal-shared";

// Read-only settings surface, and it stays one - the dominant journey here is
// "check or change one thing", which a wizard would tax on every visit to
// flatter the rare one.
//
// Async only to read the payout columns. getProfileStatus is memoised per
// request (event-repository.ts:1392), and /merchant already called it to gate
// this page, so this is a memo hit rather than a second query - cheaper than
// drilling two more props through the tab switch.
export async function SettingsTab({
  businessName,
  verification,
}: {
  businessName: string;
  verification: string;
}) {
  const merchant = (await getProfileStatus(await auth())).merchantProfile;
  const payouts = describePayouts(merchant);

  const faqs = [
    {
      q: "How long does merchant verification take?",
      a: "Most ABN-verified merchants are approved within 24 business hours. We may ask for a venue photo or insurance certificate for higher-risk categories.",
    },
    {
      q: "Can I run free + paid events under the same profile?",
      a: "Yes. Free events skip Stripe entirely; paid events route via Stripe Connect - set up under Finances.",
    },
    {
      q: "What happens if I cancel an event?",
      a: "All confirmed attendees are refunded automatically (paid events) and notified. Repeated cancellations show on your profile.",
    },
  ];

  return (
    <div className="space-y-7 py-8">
      <TabHeader
        eyebrow="Settings"
        title="Profile, discounts & support."
        body="Business details and payout account, promo codes, and answers when you need them."
      />

      <section className="space-y-3">
        <SectionLabel>Profile + payouts</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="Business name" value={businessName} />
          <InfoField
            label="Verification"
            value={verification}
            badge={<StatusPill status={verification === "approved" ? "live" : verification} />}
          />
          {/* The section label and the tab header both promise a payout
              account, and the last onboarding step sends skippers here to find
              it - so it has to actually be here. It used to be two fields and
              no payout state at all. */}
          <InfoField
            label="Payouts"
            value={payouts.value}
            badge={<StatusPill status={payouts.status} label={payouts.label} />}
          />
        </div>
        {!payouts.live ? (
          // Links to the payout step rather than embedding the Stripe POST:
          // that page is where Stripe's hosted flow returns to (the return_url
          // in api/merchant/stripe/connect), and it's the same hand-off the
          // dashboard's setup bar already uses.
          <div>
            <ButtonLink href="/merchant/onboarding/payouts" variant="secondary" size="sm">
              {payouts.cta}
            </ButtonLink>
          </div>
        ) : null}
        <InfoNote>
          Editing business name / website / ABN ships with merchant self-service. For now, email{" "}
          <b className="font-semibold text-[color:var(--purple-700)]">merchants@click.au</b> to
          update details.
        </InfoNote>
      </section>

      <section className="space-y-3">
        <SectionLabel>Discounts</SectionLabel>
        <div className={`${mCard} flex flex-wrap items-center gap-3.5 p-4`}>
          <span className="flex size-[38px] flex-none items-center justify-center rounded-xl bg-[color:var(--lavender-100)] text-[color:var(--purple)]">
            <Icon name="ticket" size={18} />
          </span>
          <div className="min-w-[180px] flex-1">
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              Promo codes & comp tickets
            </p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[color:var(--slate)]">
              The code generator ships next. For now, share a paid-event link with comp guests and
              refund from Finances.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled>
            Coming soon
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Support</SectionLabel>
        <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
          Need a human? Email{" "}
          <b className="font-semibold text-[color:var(--purple-700)]">merchants@click.au</b> - we
          reply the same business day.
        </p>
        {/* Native <details> is the accordion: no client bundle, keyboard-accessible
            for free, and it degrades with JS off. */}
        <ul className="space-y-2.5">
          {faqs.map((f) => (
            <li key={f.q} className={`${mCard} overflow-hidden`}>
              <details className="group">
                <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14.5px] font-semibold text-[color:var(--ink)] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex text-[color:var(--slate)] transition-transform group-open:rotate-180">
                    <Icon name="chevD" size={16} />
                  </span>
                </summary>
                <p className="px-4 pb-4 text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]">
                  {f.a}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * The four payout states, in the order they actually occur. Mirrors the
 * branching on /merchant/onboarding/payouts so a merchant never sees one
 * screen say "verifying" and the other say "not connected".
 *
 * `details_submitted && !payouts_enabled` is the state that reads worst if you
 * get it wrong: the merchant has finished their side and Stripe is verifying
 * asynchronously, so it is Pending, never a prompt to do more (bug board #206).
 *
 * `value` stays one word on purpose - InfoField's <dd> carries `capitalize`,
 * which title-cases every word it is given.
 */
function describePayouts(merchant: MerchantProfileRow | null): {
  value: string;
  status: string;
  label: string;
  cta: string;
  live: boolean;
} {
  if (merchant?.payouts_enabled) {
    return { value: "Connected", status: "live", label: "Live", cta: "", live: true };
  }
  if (merchant?.details_submitted) {
    return {
      value: "Verifying",
      status: "pending",
      label: "Pending",
      cta: "View payout setup",
      live: false,
    };
  }
  if (merchant?.stripe_connect_account_id) {
    return {
      value: "Unfinished",
      status: "pending",
      label: "Pending",
      cta: "Finish payout setup",
      live: false,
    };
  }
  return {
    value: "Off",
    status: "draft",
    label: "Not set up",
    cta: "Connect payouts",
    live: false,
  };
}

function InfoField({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className={`${mCard} flex min-w-0 flex-col gap-1 px-4 py-3.5`}>
      <dt className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-[color:var(--ink-faint)]">
        {label}
      </dt>
      <dd className="flex items-center gap-2 text-[14.5px] font-semibold capitalize text-[color:var(--ink)]">
        <span className="min-w-0 truncate">{value}</span>
        {badge}
      </dd>
    </div>
  );
}
