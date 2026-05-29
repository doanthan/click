import { LegalPage, Pending } from "@/components/legal-page";

export const metadata = {
  title: "Privacy Policy | Click",
  description: "How Click collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="29 May 2026"
      intro="This Privacy Policy explains how Click collects, uses, discloses, and protects your personal information in accordance with the Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth)."
      sections={[
        {
          heading: "Information we collect",
          body: (
            <>
              <p>
                We collect information you provide directly — your name, email, date of birth,
                suburb, connection intent, interest tags, quiz responses, profile photo, and any
                content you submit. We also collect event bookings, clicks (interest signals), and
                payment metadata processed via Stripe.
              </p>
              <Pending>
                Confirm the complete list of collected data, including any device/location data from
                Mapbox-based proximity features, and analytics tooling.
              </Pending>
            </>
          ),
        },
        {
          heading: "How we use your information",
          body: (
            <p>
              We use your information to match you to relevant events and people, process bookings
              and payments, surface mutual connections, send transactional and (where you consent)
              marketing emails, keep the platform safe, and meet legal obligations.
            </p>
          ),
        },
        {
          heading: "The Click mechanic and your privacy",
          body: (
            <p>
              When you &quot;click&quot; another attendee, that signal is private. The other person
              is only notified if they click you back (a mutual click). We never reveal one-way
              interest. This is a core privacy and safety commitment of the product.
            </p>
          ),
        },
        {
          heading: "Who we share it with",
          body: (
            <>
              <p>
                We share limited data with service providers that operate the platform — Stripe
                (payments), Supabase (database and storage), and our email provider. Merchants
                receive attendee information necessary to run their events.
              </p>
              <Pending>
                List all third-party processors and whether any data is stored or processed
                overseas, as required by APP 8.
              </Pending>
            </>
          ),
        },
        {
          heading: "Data retention and security",
          body: (
            <Pending>
              Specify retention periods (e.g. how long clicks, bookings, and KYC documents are kept)
              and the security measures protecting them. KYC documents are stored in a private,
              access-controlled bucket.
            </Pending>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              You may access, correct, or request deletion of your personal information, and opt out
              of marketing at any time. Contact us to exercise these rights. You may also complain to
              the Office of the Australian Information Commissioner (OAIC).
            </p>
          ),
        },
      ]}
    />
  );
}
