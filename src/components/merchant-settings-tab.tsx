import { auth } from "@/auth";
import { SUPPORT_EMAIL_DEFAULT } from "@/lib/email-templates/tokens";
import {
  getMerchantContactDetails,
  getProfileStatus,
  type MerchantProfileRow,
} from "@/lib/event-repository";
import { MerchantBusinessDetailsForm } from "@/components/merchant-business-details-form";
import { TagRequestForm } from "@/components/tag-request-form";
import { ButtonLink, Icon } from "@/components/ds";
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
  const session = await auth();
  const merchant = (await getProfileStatus(session)).merchantProfile;
  const payouts = describePayouts(merchant);
  const details = await getMerchantContactDetails(session);
  const suburbLine = details
    ? [details.addressSuburb, details.addressState, details.addressPostcode]
        .filter(Boolean)
        .join(" ")
    : "";

  // This used to answer "How long does merchant verification take?" with "1
  // business day" - but anyone reading this tab is already approved, and inside
  // the Sydney pilot there is no application to wait on: a new host is in on
  // submit and their FIRST event is the review (trustHostAfterFirstEventReview
  // turns on auto_approve_events when it is approved). So the question a host
  // here actually has is whether their next event goes live on publish.
  // auto_approve_events is false both for a new host and for one an admin put
  // on "Review every event", which this row cannot tell apart - hence "usually".
  const eventsAreReviewed = merchant?.auto_approve_events !== true;
  const faqs = [
    {
      q: "Do my events need approval?",
      a: eventsAreReviewed
        ? "For now, yes - a new event gets a quick check from our team before it goes live. For a new host, approving the first event is usually all it takes, and the events after it go live as soon as you publish them."
        : "No - your events go live as soon as you publish them. A paid event waits until your Stripe payout setup is finished.",
    },
    {
      q: "Can I run free + paid events under the same profile?",
      a: "Yes. Free events skip Stripe entirely; paid events route via Stripe Connect - set up under Finances.",
    },
    {
      q: "What happens if I cancel an event?",
      a: "Every confirmed attendee is refunded in full on a paid event, and everyone booked is emailed. The takings for that event leave your account, so cancel late and you are out the whole night's revenue.",
    },
    {
      // Fix 31: hosts refund from the door list now.
      q: "Can I refund one booking?",
      a: "Yes - open the event and use Part refund or Cancel + refund beside the guest. A part refund keeps their seat; cancelling gives it back. You can do it until a couple of days after the event, while the money is still held for you. After that, email support.",
    },
  ];

  return (
    <div className="space-y-7 py-8">
      <TabHeader
        eyebrow="Settings"
        title="Profile, payouts & support."
        body="Your business details, your payout account, and answers when you need them."
      />

      <section className="space-y-3 rise-soft rise-d1">
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
            <ButtonLink
              href={`/merchant/onboarding/payouts?returnTo=${encodeURIComponent("/merchant?tab=settings")}`}
              variant="secondary"
              size="sm"
            >
              {payouts.cta}
            </ButtonLink>
          </div>
        ) : null}
        {details ? (
          <MerchantBusinessDetailsForm
            initialContactEmail={details.contactEmail}
            initialPhone={details.phone}
            initialWebsiteUrl={details.websiteUrl}
            initialAddressStreet={details.addressStreet}
            initialSocials={details.socials}
            suburbLine={suburbLine}
          />
        ) : null}

        {/* This note used to say self-service "ships" later and to email support
            "to update details" - all of them. It is now true of the identity
            fields only, and it says WHY they are different rather than reading
            as an unfinished feature: they are what an admin verified. */}
        <InfoNote icon="lock">
          Your business name{details?.abn ? ", ABN" : ""} and the suburb your
          venue is in are part of what we verified when we approved you, so
          changing them needs a human. Email{" "}
          <b className="font-semibold text-[color:var(--purple-700)]">{SUPPORT_EMAIL_DEFAULT}</b>{" "}
          and we&apos;ll sort it.
        </InfoNote>
      </section>

      {/* Bug board #315: a host can ask for a tag here as well as from the event
          wizard's tag picker - the same request, reviewed on /admin/tags. */}
      <section className="space-y-3 rise-soft rise-d2">
        <SectionLabel>Tags</SectionLabel>
        <div className={`${mCard} grid gap-2.5 p-4`}>
          <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
            Tags are how members find your events. Missing one that fits? Ask for it here and an
            admin will review it.
          </p>
          <TagRequestForm context="settings" />
        </div>
      </section>

      <section className="space-y-3 rise-soft rise-d3">
        <SectionLabel>Support</SectionLabel>
        <p className="text-[13.5px] leading-relaxed text-[color:var(--slate)]">
          Need a human? Email{" "}
          <b className="font-semibold text-[color:var(--purple-700)]">{SUPPORT_EMAIL_DEFAULT}</b>{" "}
          - we usually reply within one business day.
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
  // BOTH capabilities, matching PayoutStatusCard on the Finances tab. Payouts
  // enabled with charges disabled is a real Stripe state, and it used to read
  // "Connected / Live" here while Finances read "Verification pending" - with
  // no CTA on this screen, because `live: true` hides it.
  if (merchant?.payouts_enabled && merchant?.charges_enabled) {
    return { value: "Connected", status: "live", label: "Live", cta: "", live: true };
  }
  if (merchant?.payouts_enabled) {
    return {
      value: "Verifying",
      status: "pending",
      label: "Pending",
      cta: "View payout setup",
      live: false,
    };
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
