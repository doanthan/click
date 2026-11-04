import { auth } from "@/auth";
import { MerchantSignupForm, StepAuthCard } from "@/components/merchant-signup-wizard";
import { authErrorMessage } from "@/lib/auth-error-copy";
import { getPlatformFeeBps } from "@/lib/stripe-connect";

// /merchant/signup - the whole host signup on one page. Signed-in visitors get
// the form; logged-out visitors get the pitch first and then the OAuth/email
// auth gate, whose callback lands back here. The "already a merchant" redirect
// (to /merchant) and the signed-in "Tell us about you" header live in the
// layout. The old step URLs (/merchant/signup/business, /contact, /documents)
// redirect here from next.config.ts.
export default async function MerchantSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ emailSent?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    return <MerchantSignupForm />;
  }

  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);
  const params = await searchParams;
  const emailSent = params?.emailSent === "1";
  // signInWithEmail redirects here with ?error=<code> when the send fails - most
  // often RateLimited, since the limit is 5 an hour. This page used to read only
  // ?emailSent, so a failed send re-rendered it byte-identical: no error, no
  // "check your inbox", nothing. On the sole email path into the entire host
  // funnel that reads as a dead button, and tapping again just burns the limit.
  const errorMessage = authErrorMessage(params?.error);

  // The deal first, then sign-in. This page used to open on "Tell us about
  // you" and an auth gate, with the reason to sign up below the fold - a host
  // was asked who they were before being told why.
  return (
    <>
      <HostPitch />
      <div className="mt-12 border-t border-[color:var(--line)] pt-12">
        <StepAuthCard
          googleConfigured={googleConfigured}
          metaConfigured={metaConfigured}
          emailSent={emailSent}
          errorMessage={errorMessage}
        />
      </div>
    </>
  );
}

// Host value props + transparent fees. This used to live on the home page, but
// the home page is now attendee-focused - host economics belong here, where
// someone is actually deciding whether to list. It is the logged-out page's
// opening section, so it carries the page's one h1.
function HostPitch() {
  // Read the fee we ACTUALLY charge rather than printing a literal. This tile
  // is a commercial claim on the page where a business decides to sign up, so
  // it must not drift from calculateApplicationFee the day someone changes the
  // env var. Trailing zeroes are trimmed so 290bps reads "2.9%", not "2.90%".
  const feePercentLabel = `${Number((getPlatformFeeBps() / 100).toFixed(2))}%`;

  return (
    <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
      <div>
        <p className="eyebrow">For hosts + venues</p>
        <h1 className="font-display mt-4 text-4xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
          You run the room.{" "}
          <span className="text-[color:var(--purple)]">We bring the right people.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[color:var(--slate)]">
          List your event in minutes. Click puts it in front of locals who already
          care - by interest tag, suburb, life stage, and intent. Free events
          are free to list. Paid events get Click-managed booking + secure
          payouts via Stripe.
        </p>
        {/* There is no application inside the Sydney pilot: a new host is in
            the moment they submit, and their first event gets an admin check
            before it goes live (registerMerchantWizardSubmit, database/073).
            Outside the pilot the same form puts them on the waitlist. This
            list and the deal tiles below used to say "One application" and
            "Apply once". */}
        <ul className="mt-6 grid gap-2 text-sm font-medium text-[color:var(--ink)] sm:grid-cols-2">
          {[
            "Vetted attendee profiles",
            "Capacity + waitlist on autopilot",
            "Free events stay free",
            "Sydney hosts start straight away",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-100)] text-[10px] font-semibold text-[color:var(--purple-700)]">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <aside className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <p className="eyebrow">The deal</p>
        {/* Every tile here has to be something we can point at in the code or the
            database. The first two used to read "7 days · Avg. time to first
            booking" and "94% · Show-up rate" - invented figures, presented as
            measured platform performance, to businesses making a commercial
            decision, on a platform that has not opened to the public. That is
            the shape of claim that becomes an ACL misleading-conduct problem the
            day it goes live, and the promise the first cohort of hosts would
            measure us against.

            The fee tile is now DERIVED from getPlatformFeeBps rather than
            typed in, so it cannot drift from what calculateApplicationFee
            actually charges. Note the fee is purely percentage-based - there is
            no fixed per-ticket component anywhere in the charge path, and
            booking_fee_bps is 0. Put real performance numbers back in the other
            tiles once events/event_attendees can actually produce them. */}
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["$0", "Listing fee for free events"],
            [feePercentLabel, "Click fee per paid ticket"],
            ["Sydney", "Where the pilot runs - elsewhere, join the waitlist"],
            ["Instant", "Access in Sydney - we check your first event before it goes live"],
          ].map(([num, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
            >
              <dt className="font-display text-3xl font-semibold leading-none text-[color:var(--purple)]">
                {num}
              </dt>
              <dd className="mt-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
                {label}
              </dd>
            </div>
          ))}
        </dl>
        <p className="font-script mt-6 text-2xl text-[color:var(--purple)]">
          hosts who care, win
        </p>
      </aside>
    </section>
  );
}
