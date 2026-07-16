import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StepAuthCard } from "@/components/merchant-signup-wizard";

// Entry point for /merchant/signup. Logged-in users are forwarded to the
// first wizard step; logged-out visitors get the OAuth/email auth gate.
// The "already a merchant" redirect (→ /merchant) lives in the layout, so it
// fires uniformly for every step page too.
export default async function MerchantSignupPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/merchant/signup/business");
  }

  const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const metaConfigured = !!(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET);

  return (
    <>
      <StepAuthCard googleConfigured={googleConfigured} metaConfigured={metaConfigured} />
      <HostPitch />
    </>
  );
}

// Host value props + transparent fees. This used to live on the home page, but
// the home page is now attendee-focused — host economics belong here, where
// someone is actually deciding whether to list.
function HostPitch() {
  return (
    <section className="mt-12 grid gap-10 border-t border-[color:var(--line)] pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
      <div>
        <p className="eyebrow">For hosts + venues</p>
        <h2 className="font-display mt-4 text-4xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
          You run the room.{" "}
          <span className="text-[color:var(--purple)]">We bring the right people.</span>
        </h2>
        <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-[color:var(--slate)]">
          List your event in minutes. Click puts it in front of locals who already
          care - by interest tag, suburb, life stage, and intent. Free events
          are free to list. Paid events get Click-managed booking + secure
          payouts via Stripe.
        </p>
        <ul className="mt-6 grid gap-2 text-sm font-medium text-[color:var(--ink)] sm:grid-cols-2">
          {[
            "Vetted attendee profiles",
            "Capacity + waitlist on autopilot",
            "Free events stay free",
            "ABN verification once, list forever",
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
        <p className="eyebrow">Quick numbers</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ["7 days", "Avg. time to first booking"],
            ["94%", "Show-up rate"],
            ["$0", "Listing fee for free events"],
            ["2.9% + 30¢", "Click managed fee per paid ticket"],
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
