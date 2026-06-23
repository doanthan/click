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
      a: "Most ABN-verified merchants are approved within 24 business hours. We may ask for a venue photo or insurance certificate for risky categories.",
    },
    {
      q: "Can I run free + paid events under the same profile?",
      a: "Yes. Free events skip Stripe entirely. Paid events route via Stripe Connect — set up under Finances.",
    },
    {
      q: "What happens if I cancel an event?",
      a: "All confirmed attendees are refunded automatically (paid events) and notified. Cancellations show on your profile to deter spam.",
    },
  ];

  return (
    <div className="space-y-10 py-10">
      <TabHeader
        eyebrow="Settings"
        title="Profile, discounts & support."
        body="Update business details and payout account, issue promo codes, and find answers."
      />

      <section>
        <p className="eyebrow">Profile + payouts</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Field label="Business name" value={businessName} />
          <Field label="Verification" value={verification} />
        </div>
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Editing business name / website / ABN ships with the
          merchant-self-service migration. Today, email{" "}
          <span className="font-mono">support@click.local</span> to update details.
        </div>
      </section>

      <section>
        <p className="eyebrow">Discounts</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Promo codes & comp tickets.
        </p>
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-5 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Discount code generator coming with the next migration. For now, share a
          unique paid-event link directly with comp guests and you can issue a full
          refund from Finances.
        </div>
      </section>

      <section>
        <p className="eyebrow">Support</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          If you need a human, email support@click.local — we reply same business day.
        </p>
        <ul className="mt-6 space-y-4">
          {faqs.map((f) => (
            <li
              key={f.q}
              className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm"
            >
              <p className="font-display text-xl font-light leading-tight">
                {f.q}
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                {f.a}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm">
      <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-[color:var(--ink)] break-all">
        {value}
      </dd>
    </div>
  );
}
