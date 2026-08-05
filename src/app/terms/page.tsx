import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Click.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      lastUpdated="18 June 2026"
      intro="These Terms of Service ('Terms') govern your access to and use of Click - an event-first social connection platform operated in Sydney, Australia (the 'Platform'). By creating an account, booking an event, or otherwise using Click, you agree to these Terms. If you do not agree, do not use the Platform."
      sections={[
        {
          heading: "Who we are",
          body: (
            <>
              <p>
                Click is operated by Cindy Kim, an individual trading as &quot;Click&quot; (ABN
                68 308 567 670), based in Sydney, New South Wales (&quot;Click&quot;, &quot;we&quot;,
                &quot;us&quot;, &quot;our&quot;). You can reach us at{" "}
                <a href="mailto:hello@letsclick.app" className="font-bold underline">hello@letsclick.app</a>.
              </p>
              <p>
                These Terms are governed by the laws of New South Wales, Australia. Click connects
                people through shared real-world events. We are a technology platform - we are not
                the host, organiser, or insurer of the events listed, except where an event is
                expressly marked as run by Click.
              </p>
            </>
          ),
        },
        {
          heading: "Eligibility",
          body: (
            <>
              <p>
                You must be at least 18 years old to use Click. By using the Platform you confirm
                that you are 18 or over, that you have the legal capacity to enter into these Terms,
                and that the information in your profile is accurate and kept up to date.
              </p>
              <p>
                Click is intended for personal, non-commercial use by individuals, and for
                approved merchants who host events. We may ask you to verify your identity, age, or
                profile photo (for example before certain features such as dating mode are enabled),
                and we may decline or revoke access where we cannot reasonably confirm eligibility.
              </p>
            </>
          ),
        },
        {
          heading: "Your account",
          body: (
            <>
              <p>
                You can sign in with Google, Facebook, or your email address. You are responsible for
                all activity that occurs under your account, for keeping your sign-in method secure,
                and for promptly notifying us of any unauthorised use. You may hold only one personal
                account, and you must not share it or impersonate another person.
              </p>
              <p>
                When you sign in with a social provider, that provider authenticates you and we
                receive basic profile details (such as your name, email, and photo). We never receive
                or store your Google or Facebook password. See our{" "}
                <Link href="/privacy" className="font-bold underline">Privacy Policy</Link> for what we
                collect and how it is handled.
              </p>
            </>
          ),
        },
        {
          heading: "How Click works - connection by design",
          body: (
            <>
              <p>
                Click has <strong>no direct-messaging inbox</strong>. Nobody can send you unsolicited
                messages. Connection happens through shared events and mutual interest. After an
                event you may privately &quot;click&quot; another attendee to signal interest - that
                signal stays private and the other person is only ever notified if they click you
                back (a mutual click). We never reveal one-way interest.
              </p>
              <p>
                Once two people click each other, Click offers structured coordination tools (such as
                proposing to meet again) that do not include open-ended free-text messaging. You
                agree to use these features respectfully and in line with our{" "}
                <Link href="/safety" className="font-bold underline">Safety Policy</Link>.
              </p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <>
              <p>You agree that you will not:</p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li>harass, abuse, threaten, stalk, impersonate, or endanger any other person;</li>
                <li>post content that is unlawful, hateful, defamatory, sexually exploitative, or that infringes another&apos;s rights;</li>
                <li>collect, scrape, or misuse other members&apos; personal information, or use Click to send spam or solicitations;</li>
                <li>use Click for any commercial purpose other than hosting events as an approved merchant;</li>
                <li>attempt to circumvent the click mechanic, safety controls, payment flow, or any technical or access restriction; or</li>
                <li>upload malware, attempt to gain unauthorised access, or otherwise interfere with the Platform&apos;s integrity or security.</li>
              </ul>
              <p>
                We may remove content, restrict features, or suspend or terminate accounts that
                breach these Terms or our policies, and we report serious safety concerns to
                authorities where appropriate.
              </p>
            </>
          ),
        },
        {
          heading: "Content you provide",
          body: (
            <>
              <p>
                You retain ownership of the content you submit - your profile details, photos,
                prompts, quiz responses, and event submissions (&quot;Your Content&quot;). You grant
                Click a worldwide, non-exclusive, royalty-free licence to host, store, reproduce,
                adapt, and display Your Content for the purpose of operating, improving, and
                promoting the Platform, including showing your profile and event listings to other
                users and (for matching) processing your data.
              </p>
              <p>
                You are responsible for Your Content and confirm you have the rights to share it. We
                may remove content that breaches these Terms or the law, and you may request removal
                of your own content at any time.
              </p>
            </>
          ),
        },
        {
          heading: "Events, bookings and payments",
          body: (
            <>
              <p>
                Events are listed and run by independent merchants, except where expressly marked as
                run by Click. The contract for attending a paid event is between you and the host;
                Click acts as a limited payment-collection agent for the host and as the technology
                platform that facilitates discovery, booking, and ticketing.
              </p>
              <p>
                When you book a paid event, payment is processed by Stripe. A Click booking/service
                fee may be added and is disclosed at checkout before you pay. Prices are shown in
                Australian dollars, and a payment confirmation is emailed to you after a successful
                payment. Click is not currently registered for GST and does not charge GST on its
                booking/service fee; where a host is separately registered for GST, any GST on the
                ticket price is the host&apos;s responsibility. You are responsible for arriving at
                the event and meeting any conditions the host sets (such as age, dress, or venue
                rules).
              </p>
              <p>
                Where an event supports guest seats, the person who books and pays is responsible for
                that booking and for any guests they add. Waitlist offers are time-limited - if you
                are offered a freed seat you must accept (and, for paid events, complete payment)
                within the stated window or the offer lapses and is passed to the next person.
              </p>
            </>
          ),
        },
        {
          heading: "Refunds and cancellations",
          body: (
            <p>
              Cancellations and refunds are governed by our{" "}
              <Link href="/refund-policy" className="font-bold underline">Refund &amp; Cancellation Policy</Link>,
              which operates alongside your rights under the Australian Consumer Law (which cannot be
              excluded). If a host cancels or materially changes an event, you are entitled to a full
              refund of the ticket price.
            </p>
          ),
        },
        {
          heading: "Merchant terms",
          body: (
            <>
              <p>
                If you host events, additional terms apply. You must provide accurate event details;
                hold any licences, permits, and insurance required (including liquor and venue
                compliance); run events safely and lawfully; and honour bookings made through Click.
                You authorise Click to collect payments on your behalf and to deduct applicable fees
                and our commission before payout.
              </p>
              <p>
                Merchant payouts are made through Stripe Connect. You must complete Stripe&apos;s
                identity and bank-account verification (KYC) before funds are released; payouts and
                their timing are subject to Stripe&apos;s terms. You remain responsible for the tax
                treatment of your own takings. We may withhold payouts, suspend listings, or close a
                merchant account for breach of these Terms, suspected fraud, or repeated attendee
                complaints.
              </p>
            </>
          ),
        },
        {
          heading: "Intellectual property",
          body: (
            <p>
              The Platform, including its name, logo, design, software, and content (other than Your
              Content), is owned by Click or its licensors and is protected by intellectual-property
              laws. We grant you a limited, revocable, non-transferable licence to use the Platform
              for its intended purpose. You may not copy, modify, reverse-engineer, or create
              derivative works from the Platform except as permitted by law.
            </p>
          ),
        },
        {
          heading: "Third-party services",
          body: (
            <p>
              Click relies on third-party services to operate - including Stripe (payments and
              payouts), Supabase (database and file storage), Mapbox and Google Maps (location and
              discovery), Google and Facebook (sign-in), and our email provider. Your use of those
              features may be subject to the relevant provider&apos;s own terms. We are not
              responsible for third-party services we do not control, but we choose providers we
              consider reputable. See our{" "}
              <Link href="/privacy" className="font-bold underline">Privacy Policy</Link> and{" "}
              <Link href="/security" className="font-bold underline">Security Policy</Link> for how data is
              handled.
            </p>
          ),
        },
        {
          heading: "Suspension and termination",
          body: (
            <p>
              You may stop using Click and request deletion of your account at any time. We may
              suspend or terminate your access if you breach these Terms or our policies, if required
              by law, or to protect the safety of our community. Provisions that by their nature
              should survive termination - including content licences already granted, payment
              obligations, disclaimers, and limitation of liability - will survive.
            </p>
          ),
        },
        {
          heading: "Disclaimers",
          body: (
            <>
              <p>
                Click facilitates connections and bookings for in-person events; it does not vet
                every attendee and does not guarantee the conduct of any user, host, or venue. You
                attend events and meet other people at your own risk and should use good judgement
                and follow our <Link href="/safety" className="font-bold underline">Safety Policy</Link>.
                The Platform is provided &quot;as is&quot; and we do not warrant that it will be
                uninterrupted or error-free.
              </p>
              <p>
                Nothing in these Terms excludes, restricts, or modifies any guarantee, right, or
                remedy you have under the Australian Consumer Law or other laws that cannot be
                lawfully excluded.
              </p>
            </>
          ),
        },
        {
          heading: "Limitation of liability",
          body: (
            <p>
              To the maximum extent permitted by law, Click is not liable for indirect, incidental,
              special, or consequential loss, or for the acts or omissions of users, hosts, or
              venues. Where our liability cannot be excluded but can be limited, our liability is
              limited (at our option) to re-supplying the relevant service or paying the cost of
              having it re-supplied. To the extent permitted by law, our total aggregate liability to
              you for any claim is limited to the greater of the fees you paid to Click in the 12
              months before the claim, or AUD $100.
            </p>
          ),
        },
        {
          heading: "Indemnity",
          body: (
            <p>
              To the extent permitted by law, you agree to indemnify Click against losses, claims,
              and reasonable costs arising from your breach of these Terms, your misuse of the
              Platform, your content, or - if you are a merchant - the events you host.
            </p>
          ),
        },
        {
          heading: "Governing law and disputes",
          body: (
            <p>
              These Terms are governed by the laws of New South Wales, Australia, and you submit to
              the non-exclusive jurisdiction of the courts of that state. If you have a concern,
              please contact us first at{" "}
              <a href="mailto:hello@letsclick.app" className="font-bold underline">hello@letsclick.app</a>{" "}
              so we can try to resolve it.
            </p>
          ),
        },
        {
          heading: "Changes to these Terms",
          body: (
            <p>
              We may update these Terms from time to time. Material changes will be notified in-app or
              by email before they take effect. The &quot;last updated&quot; date above shows the
              current version. Continued use after a change takes effect constitutes acceptance.
            </p>
          ),
        },
      ]}
    />
  );
}
