import { LegalPage, Pending } from "@/components/legal-page";

export const metadata = {
  title: "Refund & Cancellation Policy | Click",
  description: "When and how refunds are issued for Click event bookings.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      lastUpdated="29 May 2026"
      intro="This policy explains when you can cancel a booking, when you are entitled to a refund, and how refunds are processed. It operates alongside your rights under the Australian Consumer Law, which cannot be excluded."
      sections={[
        {
          heading: "Cancelling your booking",
          body: (
            <Pending>
              Define the attendee cancellation window (e.g. full refund if cancelled more than 48
              hours before the event; no refund within 24 hours) and how it varies by event type.
            </Pending>
          ),
        },
        {
          heading: "If a merchant cancels or changes an event",
          body: (
            <p>
              If a host cancels an event, or materially changes its time, location, or nature, you
              are entitled to a full refund of the ticket price. We will notify you by email and
              process the refund to your original payment method.
            </p>
          ),
        },
        {
          heading: "Booking fees",
          body: (
            <Pending>
              State whether the Click booking/service fee is refundable. Confirm consistency with the
              fee disclosed at checkout.
            </Pending>
          ),
        },
        {
          heading: "How refunds are processed",
          body: (
            <p>
              Approved refunds are issued via Stripe to your original payment method. Processing
              times depend on your bank, but typically take 5–10 business days. You will receive an
              email confirmation when a refund is issued.
            </p>
          ),
        },
        {
          heading: "Your consumer guarantees",
          body: (
            <p>
              Nothing in this policy limits your rights under the Australian Consumer Law. If an
              event is not provided with due care and skill, or is materially different from what was
              promised, you may be entitled to a remedy regardless of the timeframes above.
            </p>
          ),
        },
        {
          heading: "Requesting a refund",
          body: (
            <p>
              To request a refund, contact us at{" "}
              <a href="mailto:hello@click.com.au" className="font-bold underline">hello@click.com.au</a>{" "}
              with your booking details. Refund decisions are reviewed by our team and, where
              relevant, the event host.
            </p>
          ),
        },
      ]}
    />
  );
}
