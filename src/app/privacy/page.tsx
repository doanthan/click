import { LegalPage, Fill } from "@/components/legal-page";

export const metadata = {
  title: "Privacy Policy | Click",
  description: "How Click collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="18 June 2026"
      intro="This Privacy Policy explains how Click collects, uses, discloses, and protects your personal information in accordance with the Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth). By using Click you consent to the handling of your personal information as described here."
      sections={[
        {
          heading: "Who we are",
          body: (
            <p>
              Click is operated by <Fill>[ENTITY NAME] Pty Ltd</Fill> (ABN{" "}
              <Fill>[ABN]</Fill>), based in Sydney, Australia. We are the entity responsible for the
              personal information we collect through the Platform. For any privacy question or
              request, contact our Privacy Officer at{" "}
              <a href="mailto:privacy@letsclick.app" className="font-bold underline">privacy@letsclick.app</a>.
            </p>
          ),
        },
        {
          heading: "Information we collect",
          body: (
            <>
              <p>We collect the following categories of personal information:</p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li><strong>Account &amp; profile:</strong> name, email, date of birth (to confirm you are 18+), suburb/postcode, profile photo and gallery photos, profile prompts, social handles, and (via Google/Facebook sign-in) the basic profile details those providers share.</li>
                <li><strong>Preferences &amp; matching:</strong> your connection intent, interest tags, quiz responses (life stage, availability, event style, energy, personality), and derived matching features used to suggest people and events.</li>
                <li><strong>Activity &amp; connection signals:</strong> the events you view, save, and book; your private &quot;clicks&quot; (interest signals) and mutual matches; proposals; and notifications.</li>
                <li><strong>Bookings &amp; payments:</strong> your bookings, guest seats, waitlist offers, and payment metadata returned by Stripe. Click never receives or stores your full card number — card details are entered directly with Stripe.</li>
                <li><strong>Location &amp; technical data:</strong> location and place data used for proximity and discovery (via Mapbox and Google Maps), plus device, browser, IP, and usage information collected automatically as you use the Platform.</li>
                <li><strong>Support &amp; safety:</strong> bug reports you file (which may include a screenshot of your screen and recent console/network logs, with secrets redacted before they leave your device), and any safety reports or content you submit.</li>
                <li><strong>Merchant information:</strong> if you host events, your business details and identity/bank-verification documents (KYC), some of which are held by Stripe and some in a private, access-controlled store.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "How we collect it",
          body: (
            <p>
              We collect information directly from you (when you sign up, complete your profile or
              quiz, book events, or contact us); automatically as you use the Platform (device and
              usage data); from sign-in providers (Google, Facebook) when you choose social login;
              and from merchants and payment partners in connection with bookings. Where it is
              reasonable and practicable, we collect personal information directly from you.
            </p>
          ),
        },
        {
          heading: "How we use your information",
          body: (
            <p>
              We use your information to: create and manage your account; match you to relevant
              events and people; process bookings, payments, refunds, and merchant payouts; surface
              mutual connections; send transactional messages and (where you consent) marketing; keep
              the Platform safe and investigate reports; improve our matching and product; and meet
              our legal obligations. We do not sell your personal information.
            </p>
          ),
        },
        {
          heading: "The click mechanic and your privacy",
          body: (
            <p>
              When you &quot;click&quot; another attendee, that signal is private. The other person is
              only notified if they click you back (a mutual click). We never reveal one-way interest
              to anyone. This is a core privacy and safety commitment of the product, reflected in how
              we store and surface this data.
            </p>
          ),
        },
        {
          heading: "Marketing and communications",
          body: (
            <p>
              We send transactional communications (such as booking confirmations, receipts, safety
              notices, and account messages) that are necessary to provide the service and which you
              cannot opt out of while you hold an account. We send marketing only where permitted, and
              you can opt out at any time using the unsubscribe link in those emails or by contacting
              us. Email is delivered through our email provider (Resend).
            </p>
          ),
        },
        {
          heading: "Who we share it with",
          body: (
            <>
              <p>
                We share limited personal information with service providers who help us run the
                Platform, only as needed to perform their function:
              </p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li><strong>Stripe</strong> — payment processing, tax receipts, and merchant payouts (Stripe Connect).</li>
                <li><strong>Supabase</strong> — our database and file storage (profile data, photos, documents).</li>
                <li><strong>Vercel</strong> — application hosting and delivery.</li>
                <li><strong>Mapbox &amp; Google Maps</strong> — location, mapping, and proximity features.</li>
                <li><strong>Google &amp; Facebook</strong> — optional social sign-in.</li>
                <li><strong>Resend</strong> — transactional and marketing email delivery.</li>
                <li><strong>Google Sheets</strong> — internal triage of bug reports you submit.</li>
              </ul>
              <p>
                We also share attendee details that a <strong>host</strong> needs to run an event you
                book (such as your name and booking, and a door/guest list). We may disclose
                information where required by law, to enforce our terms, or to protect the safety of
                our community. We do not sell your personal information.
              </p>
            </>
          ),
        },
        {
          heading: "Overseas disclosure",
          body: (
            <p>
              Some of our service providers store or process data outside Australia (for example, in
              the United States or European Union). Where we disclose personal information overseas we
              take reasonable steps, consistent with APP 8, to ensure it is handled in line with the
              Australian Privacy Principles, including relying on the provider&apos;s contractual data
              protection commitments.
            </p>
          ),
        },
        {
          heading: "Cookies and analytics",
          body: (
            <p>
              We use cookies and similar technologies to keep you signed in, remember your
              preferences, secure the Platform, and understand how it is used so we can improve it.
              You can control cookies through your browser settings, though some features may not work
              without them.
            </p>
          ),
        },
        {
          heading: "Data security",
          body: (
            <p>
              We take reasonable steps to protect your personal information from misuse, loss, and
              unauthorised access — including encryption in transit, access controls, a private,
              signed-URL store for sensitive merchant documents, and delegating card handling to
              Stripe. For more detail see our{" "}
              <a href="/security" className="font-bold underline">Security Policy</a>. No system is
              perfectly secure, so we cannot guarantee absolute security.
            </p>
          ),
        },
        {
          heading: "Data retention",
          body: (
            <p>
              We keep personal information only for as long as needed for the purposes described
              above, to comply with legal, tax, and accounting obligations (for example, payment and
              booking records), and to resolve disputes and enforce our agreements. When information is
              no longer needed, we delete or de-identify it. Some records, such as financial
              transactions, must be retained for the period required by Australian law.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p>
              You may access, correct, or request deletion of your personal information, and opt out
              of marketing at any time. To make a request, contact{" "}
              <a href="mailto:privacy@letsclick.app" className="font-bold underline">privacy@letsclick.app</a>.
              We will respond within a reasonable period. If you are not satisfied with how we handle
              your request or a privacy concern, you may complain to the Office of the Australian
              Information Commissioner (OAIC) at oaic.gov.au.
            </p>
          ),
        },
        {
          heading: "Children",
          body: (
            <p>
              Click is for adults aged 18 and over. We do not knowingly collect personal information
              from anyone under 18. If you believe a minor has provided us information, contact us and
              we will delete it.
            </p>
          ),
        },
        {
          heading: "Changes to this policy",
          body: (
            <p>
              We may update this Privacy Policy from time to time. The &quot;last updated&quot; date
              above shows the current version, and we will notify you of material changes in-app or by
              email. Continued use after a change takes effect constitutes acceptance.
            </p>
          ),
        },
      ]}
    />
  );
}
