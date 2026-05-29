import { LegalPage, Pending } from "@/components/legal-page";

export const metadata = {
  title: "Terms of Service | Click",
  description: "The terms that govern your use of Click.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      lastUpdated="29 May 2026"
      intro="These Terms govern your access to and use of Click, an event-first social connection platform operated in Sydney, Australia. By creating an account or using Click you agree to these Terms."
      sections={[
        {
          heading: "Who we are",
          body: (
            <Pending>
              Insert the operating entity (Pty Ltd name + ABN once incorporated), registered address,
              and contact details. Confirm governing law is New South Wales, Australia.
            </Pending>
          ),
        },
        {
          heading: "Eligibility",
          body: (
            <>
              <p>
                You must be at least 18 years old to use Click. By using the platform you confirm
                you meet this requirement and that the information in your profile is accurate.
              </p>
              <Pending>
                Confirm age-gating requirements and any identity-verification obligations,
                particularly for dating mode.
              </Pending>
            </>
          ),
        },
        {
          heading: "Your account and conduct",
          body: (
            <>
              <p>
                You are responsible for activity under your account. You agree not to harass, abuse,
                impersonate, or endanger other users, and to follow our{" "}
                <a href="/safety" className="font-bold underline">Safety Policy</a> and Community
                Guidelines at all times. We may suspend or remove accounts that breach these Terms.
              </p>
              <p>
                Click has no direct-messaging feature by design. Connection happens through shared
                events and mutual interest — never through unsolicited messages.
              </p>
            </>
          ),
        },
        {
          heading: "Events, bookings and payments",
          body: (
            <>
              <p>
                Events are hosted by independent merchants. When you book a paid event, payment is
                processed via Stripe and a booking fee may apply. Refunds are governed by our{" "}
                <a href="/refund-policy" className="font-bold underline">Refund &amp; Cancellation Policy</a>.
              </p>
              <Pending>
                Define the contractual relationship between Click, the merchant, and the attendee
                (agent vs. principal), GST treatment, and merchant payout terms via Stripe Connect.
              </Pending>
            </>
          ),
        },
        {
          heading: "Merchant terms",
          body: (
            <Pending>
              Insert the merchant agreement summary: commission rate, subscription tiers, payout
              schedule, content ownership, and the merchant&apos;s obligations for event accuracy,
              safety, and liquor/insurance compliance.
            </Pending>
          ),
        },
        {
          heading: "Liability and disclaimers",
          body: (
            <Pending>
              Insert limitation-of-liability, indemnity, and disclaimer clauses consistent with the
              Australian Consumer Law (which cannot be excluded). Address Click&apos;s role as a
              platform connecting users and merchants at in-person events.
            </Pending>
          ),
        },
        {
          heading: "Changes to these Terms",
          body: (
            <p>
              We may update these Terms from time to time. Material changes will be notified in-app
              or by email. Continued use after a change constitutes acceptance.
            </p>
          ),
        },
      ]}
    />
  );
}
