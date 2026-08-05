import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata = {
  title: "Security",
  description: "How Click protects your account, your data, and your payments.",
};

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust & Safety"
      title="Security"
      lastUpdated="18 June 2026"
      intro="Security and privacy are built into how Click works, not bolted on. This page explains the technical and organisational measures we use to protect your account, your data, and your payments - and how to report a security issue to us."
      sections={[
        {
          heading: "Our approach",
          body: (
            <p>
              We design Click so the most sensitive things are protected by default: interest signals
              are private until mutual, card details never touch our servers, and sensitive merchant
              documents are kept in a private store. We take reasonable steps to protect personal
              information consistent with the Australian Privacy Principles. No online service can be
              perfectly secure, but we work to reduce risk and respond quickly when issues arise.
            </p>
          ),
        },
        {
          heading: "Infrastructure and hosting",
          body: (
            <p>
              The Platform runs on managed cloud infrastructure (Vercel for the application, Supabase
              for the Postgres database and file storage). Traffic between your browser and Click is
              encrypted in transit using HTTPS/TLS, and data held by our infrastructure providers is
              encrypted at rest by those providers. We connect to the database over a managed,
              access-controlled connection.
            </p>
          ),
        },
        {
          heading: "Authentication and access",
          body: (
            <>
              <p>
                You can sign in with Google, Facebook, or your email. When you use social sign-in, the
                provider authenticates you and Click never receives or stores your Google or Facebook
                password. Sessions are managed by NextAuth using signed, encrypted tokens.
              </p>
              <p>
                Internally, access to personal data is limited to what is needed to run the Platform.
                Administrative tools are restricted to authorised staff, and privileged operations
                (such as reading sensitive documents) use scoped, server-side access rather than
                exposing raw data to the browser.
              </p>
            </>
          ),
        },
        {
          heading: "Payment security",
          body: (
            <p>
              All payments and merchant payouts are handled by Stripe, a PCI-DSS Level 1 certified
              payment provider. Card details are entered directly with Stripe and are tokenised -
              Click never receives or stores your full card number. Merchant identity and bank
              verification (KYC) is performed by Stripe Connect under Stripe&apos;s own security
              controls.
            </p>
          ),
        },
        {
          heading: "Data storage and isolation",
          body: (
            <>
              <p>
                We separate data by sensitivity. Public media (such as profile photos and event
                images) is served from a public storage bucket. Sensitive merchant documents (such as
                identity or licence documents) are held in a <strong>private</strong> bucket that
                refuses anonymous reads and is only accessed through short-lived signed URLs generated
                on the server.
              </p>
              <p>
                Server-side access to storage uses a privileged key that is never exposed to the
                browser, so file access always passes through our application logic and permission
                checks.
              </p>
            </>
          ),
        },
        {
          heading: "Privacy by design - the click mechanic",
          body: (
            <p>
              When you &quot;click&quot; someone, that interest signal is stored privately and is never
              revealed to the other person unless they click you back. There is no direct-message
              inbox and no way to broadcast one-way interest. This removes a common harassment vector
              and is enforced in how the data is modelled and surfaced, not just in the interface. See
              our <Link href="/safety" className="font-bold underline">Safety Policy</Link> for the
              member-facing controls.
            </p>
          ),
        },
        {
          heading: "Support and diagnostic data",
          body: (
            <p>
              Our in-app bug reporter can capture a screenshot of your screen plus recent console and
              network activity to help us fix issues. Secrets and sensitive values are redacted on
              your device before anything is sent, and reports are stored against your support ticket
              for the team handling it.
            </p>
          ),
        },
        {
          heading: "Your role in security",
          body: (
            <>
              <p>You can help keep your account secure:</p>
              <ul className="ml-5 list-disc space-y-1.5">
                <li>Use a strong, unique password (or sign in with Google/Facebook) and enable two-factor authentication with your provider.</li>
                <li>Keep your devices, browser, and email account secure, and sign out on shared devices.</li>
                <li>Be cautious of phishing - Click will never ask for your password by email, and our emails come from a letsclick.app address.</li>
                <li>Report anything suspicious to us straight away.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "Reporting a vulnerability",
          body: (
            <p>
              We welcome responsible disclosure. If you believe you have found a security
              vulnerability, please email{" "}
              <a href="mailto:security@letsclick.app" className="font-bold underline">security@letsclick.app</a>{" "}
              with enough detail for us to reproduce it. Please give us a reasonable opportunity to
              investigate and fix the issue before any public disclosure, and do not access or modify
              other users&apos; data, degrade the service, or run intrusive automated scans. We will
              not pursue good-faith researchers who follow these guidelines.
            </p>
          ),
        },
        {
          heading: "Incident response and breach notification",
          body: (
            <p>
              We maintain processes to detect, investigate, and respond to security incidents. If a
              data breach is likely to result in serious harm, we will notify affected individuals and
              the Office of the Australian Information Commissioner (OAIC) as required by the
              Notifiable Data Breaches scheme under the Privacy Act 1988 (Cth).
            </p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>
              For security matters, email{" "}
              <a href="mailto:security@letsclick.app" className="font-bold underline">security@letsclick.app</a>.
              For privacy requests, see our{" "}
              <Link href="/privacy" className="font-bold underline">Privacy Policy</Link>. For safety
              concerns about another member or an event, see our{" "}
              <Link href="/safety" className="font-bold underline">Safety Policy</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
