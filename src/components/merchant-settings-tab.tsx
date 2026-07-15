import { Button, Icon } from "@/components/ds";
import { InfoNote, SectionLabel, StatusPill, mCard } from "@/components/merchant-ds";
import { TabHeader } from "./merchant-portal-shared";

export function SettingsTab({
  businessName,
  verification,
}: {
  businessName: string;
  verification: string;
}) {
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
        </div>
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
