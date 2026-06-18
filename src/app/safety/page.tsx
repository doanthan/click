import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Safety Policy | Click",
  description: "How Click keeps members safe at events and on the platform.",
};

export default function SafetyPage() {
  return (
    <LegalPage
      eyebrow="Trust & Safety"
      title="Safety Policy"
      lastUpdated="18 June 2026"
      intro="Click is built so that connection happens through shared, real-world events — never through cold messages. Safety is our core promise. This policy explains the protections in place and what to do if something goes wrong."
      sections={[
        {
          heading: "No messaging, by design",
          body: (
            <p>
              Click has no direct-message inbox. Nobody can send you unsolicited messages. You signal
              interest in someone privately by &quot;clicking&quot; them after an event — and they only
              ever know if they click you back. This removes the most common harassment vector in social
              apps.
            </p>
          ),
        },
        {
          heading: "Block, mute and report",
          body: (
            <p>
              From any profile you can <strong>block</strong> someone (you disappear from each
              other&apos;s discovery and any pending click is cancelled), <strong>mute</strong> them
              (you stop receiving notifications involving them), or <strong>report</strong> them to our
              safety team. Reporting also auto-mutes the person while we review.
            </p>
          ),
        },
        {
          heading: "How we handle reports",
          body: (
            <p>
              Every report goes to a dedicated safety queue and is reviewed within 24 hours. Outcomes
              range from a warning to permanent removal. Serious safety concerns are escalated
              immediately and, where appropriate, reported to authorities.
            </p>
          ),
        },
        {
          heading: "Verified profiles and dating mode safeguards",
          body: (
            <>
              <p>
                Profiles can carry a <strong>verified tick</strong> once a member&apos;s photo has been
                confirmed, so you can see who has been verified before you meet. When connection is for
                dating, we apply extra safeguards:
              </p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li>a short safety briefing is shown before first use, with reminders to meet in public and tell a friend;</li>
                <li>photo verification is encouraged so matches can trust who they are meeting;</li>
                <li>reports involving unwanted contact are prioritised in the safety queue and reviewed promptly, with auto-muting applied while we investigate.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Meeting in person safely",
          body: (
            <>
              <p>
                Click events are hosted at public venues by vetted merchants. When you meet anyone for
                the first time:
              </p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li>tell a friend or family member where you are going and who you are meeting;</li>
                <li>meet in the public event space and stay in public until you are comfortable;</li>
                <li>arrange your own transport to and from the venue so you can leave whenever you want;</li>
                <li>keep your phone charged and look after your own drink;</li>
                <li>don&apos;t share your home address or financial details, and never send money to someone you&apos;ve just met;</li>
                <li>trust your instincts — you never have to stay, and you can leave at any time.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Merchant and venue vetting",
          body: (
            <p>
              Events are run by merchants who apply to host on Click and are reviewed before they can
              publish. Until a host has earned trusted status, their events are checked by our team
              before going live. Hosts are responsible for running safe, lawful events and holding any
              required licences and insurance.
            </p>
          ),
        },
        {
          heading: "Your privacy is part of your safety",
          body: (
            <p>
              Your clicks are private and one-way interest is never revealed. We don&apos;t share your
              contact details with other members, and we keep sensitive data protected — see our{" "}
              <a href="/privacy" className="font-bold underline">Privacy Policy</a> and{" "}
              <a href="/security" className="font-bold underline">Security Policy</a> for the detail.
            </p>
          ),
        },
        {
          heading: "Get help",
          body: (
            <p>
              In an emergency, call 000. For non-urgent safety concerns about another member or an
              event, report them in-app or email{" "}
              <a href="mailto:safety@letsclick.app" className="font-bold underline">safety@letsclick.app</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
