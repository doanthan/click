import { LegalPage, Pending } from "@/components/legal-page";

export const metadata = {
  title: "Safety Policy | Click",
  description: "How Click keeps members safe at events and on the platform.",
};

export default function SafetyPage() {
  return (
    <LegalPage
      eyebrow="Trust & Safety"
      title="Safety Policy"
      lastUpdated="29 May 2026"
      intro="Click is built so that connection happens through shared, real-world events — never through cold messages. Safety is our core promise. This policy explains the protections in place and what to do if something goes wrong."
      sections={[
        {
          heading: "No messaging, by design",
          body: (
            <p>
              Click has no direct-message inbox. Nobody can send you unsolicited messages. You signal
              interest in someone privately by &quot;clicking&quot; them after an event — and they
              only ever know if they click you back. This removes the most common harassment vector in
              social apps.
            </p>
          ),
        },
        {
          heading: "Block, mute and report",
          body: (
            <p>
              From any profile you can <strong>block</strong> someone (you disappear from each
              other&apos;s discovery and any pending click is cancelled), <strong>mute</strong> them
              (you stop receiving notifications involving them), or <strong>report</strong> them to
              our safety team. Reporting also auto-mutes the person while we review.
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
          heading: "Dating mode safeguards",
          body: (
            <Pending>
              Document the additional safeguards that apply when dating mode is enabled: identity /
              photo verification, the safety briefing shown before first use, and the escalation path
              and SLA for any report of unwanted contact.
            </Pending>
          ),
        },
        {
          heading: "Meeting in person safely",
          body: (
            <>
              <p>
                Click events are hosted at public venues by vetted merchants. We recommend telling a
                friend where you&apos;re going, arranging your own transport, and trusting your
                instincts — you never have to stay.
              </p>
              <Pending>
                Add a full in-person safety checklist reviewed alongside the dating-mode safety
                briefing.
              </Pending>
            </>
          ),
        },
        {
          heading: "Get help",
          body: (
            <p>
              In an emergency, call 000. For non-urgent safety concerns about another member or an
              event, report them in-app or email{" "}
              <a href="mailto:safety@click.com.au" className="font-bold underline">safety@click.com.au</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
