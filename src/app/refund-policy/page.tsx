import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Refund & Cancellation Policy | Click",
  description: "When and how refunds are issued for Click event bookings.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      lastUpdated="18 June 2026"
      intro="This policy explains when you can cancel a booking, when you are entitled to a refund, and how refunds are processed. It operates alongside your rights under the Australian Consumer Law, which cannot be excluded. Events are run by independent hosts, who may set their own cancellation terms - these are shown on the event before you book."
      sections={[
        {
          heading: "Cancelling your booking",
          body: (
            <>
              <p>
                You can cancel a booking from your dashboard. Unless the host has set different terms
                shown at checkout, our standard timeframes for paid events are:
              </p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li><strong>More than 48 hours before the event start:</strong> full refund of the ticket price.</li>
                <li><strong>Within 48 hours of the event start:</strong> the ticket price is generally non-refundable, because the host has committed resources - though we and the host may still offer a refund or credit at our discretion.</li>
              </ul>
              <p>
                Free events can be cancelled at any time at no cost - please do cancel so your spot can
                be offered to someone on the waitlist.
              </p>
            </>
          ),
        },
        {
          heading: "Guest seats",
          body: (
            <p>
              If you booked and paid for additional guest seats, you are the purchaser and can cancel
              individual seats. Any refund for a cancelled guest seat is calculated on the same
              timeframes above and is returned to the purchaser&apos;s original payment method.
            </p>
          ),
        },
        {
          heading: "If a merchant cancels or changes an event",
          body: (
            <p>
              If a host cancels an event, or materially changes its time, location, or nature, you are
              entitled to a full refund of the ticket price regardless of the timeframes above. We will
              notify you by email and process the refund to your original payment method.
            </p>
          ),
        },
        {
          heading: "Waitlist offers",
          body: (
            <p>
              If a seat frees up and you are offered it from the waitlist, the offer is time-limited
              (currently 30 minutes). For paid events you are only charged if you accept the offer and
              complete checkout within that window; if you do nothing, the offer lapses and is passed to
              the next person - you are not charged.
            </p>
          ),
        },
        {
          heading: "Booking fees",
          body: (
            <p>
              The Click booking/service fee, where it applies, is disclosed at checkout. It covers the
              cost of running the platform and is non-refundable on a standard attendee-initiated
              cancellation. It is refunded in full if the host cancels or materially changes the event,
              or where a refund of the fee is required by law.
            </p>
          ),
        },
        {
          heading: "How refunds are processed",
          body: (
            <p>
              Approved refunds are issued via Stripe to your original payment method. Processing times
              depend on your bank but typically take 5–10 business days. You will receive an email
              confirmation when a refund is issued.
            </p>
          ),
        },
        {
          heading: "Your consumer guarantees",
          body: (
            <p>
              Nothing in this policy limits your rights under the Australian Consumer Law. If an event
              is not provided with due care and skill, or is materially different from what was
              promised, you may be entitled to a remedy regardless of the timeframes above.
            </p>
          ),
        },
        {
          heading: "Requesting a refund",
          body: (
            <p>
              Most cancellations can be made directly from your dashboard. If you need help, contact us
              at{" "}
              <a href="mailto:hello@letsclick.app" className="font-bold underline">hello@letsclick.app</a>{" "}
              with your booking details. Refund decisions are reviewed by our team and, where relevant,
              the event host.
            </p>
          ),
        },
      ]}
    />
  );
}
