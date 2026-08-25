import { auth } from "@/auth";
import { ButtonLink, Icon, type IconName } from "@/components/ds";
import { getPlatformFeeBps } from "@/lib/stripe-connect";

export const metadata = {
  title: "How Click works",
  description:
    "The best people you'll meet this year aren't on an app. They're across the room. Here's how Click works.",
};

// The three-step model - one idea each, no paragraph over three lines. On
// marketing surfaces the click stays curious: teased, never explained, with no
// rejection on the page in either direction.
const STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "compass",
    title: "Pick something good",
    body: "Pottery in Newtown, a sunrise run, a wine-bar quiz. Real places, near you, this week.",
  },
  {
    icon: "calendar",
    title: "Show up",
    body: "You click side by side, not face to face - and everyone in the room chose the same thing you did.",
  },
  {
    icon: "users",
    title: "That's it",
    body: "A great night, a thing you love, maybe someone you click with. Show up, and everything else is a bonus.",
  },
];

const ON_PURPOSE: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "check", title: "Only verified venues", body: "Every event is a real place run by real people." },
  {
    icon: "user",
    title: "You're in control",
    body: "What you do, who you click with, whether you're visible at all.",
  },
  {
    icon: "compass",
    title: "Clicks are rare on purpose",
    body: "No feed of faces to scroll. That's what makes one feel real.",
  },
];

const INTENTS = [
  "Here for the activities",
  "Here for friends",
  "New in town",
  "Growing my circle",
  "Here to meet people, not to date",
  "Open to dating",
];

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[12.5px] font-bold tracking-[0.12em] uppercase text-[color:var(--purple-500)]">{children}</p>
  );
}

export default async function HowItWorksPage() {
  // The footer carries "How it works" on every signed-in surface too, so this
  // is not a logged-out-only page. Both CTAs pointed at /signup, which for a
  // member is a round trip: /signup -> /register -> /post-login -> the
  // dashboard they just left, with nothing on this page having offered them a
  // thing to do. Same page, one honest next step each - an account to make, or
  // an event to find.
  const session = await auth();
  const signedIn = !!session?.user;
  const ctaHref = signedIn ? "/discover" : "/signup";
  const ctaLabel = signedIn ? "Find an event" : "Create your account";
  // Derived, never a literal. This page used to hardcode "a flat 5% fee, paid
  // out monthly" while production runs PLATFORM_FEE_BPS=290 - so the same host
  // was quoted two different commissions one click apart. /merchant/signup:53
  // already derives it the same way; this is the sibling that did not.
  const feePercentLabel = `${Number((getPlatformFeeBps() / 100).toFixed(2))}%`;
  return (
    <main className="bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {/* 1 · Hero */}
      <section className="ck-page pt-12 pb-14 sm:pt-16">
        <div className="max-w-[720px]">
          <h1 className="font-display max-w-[660px] text-[length:var(--text-display)] leading-[1.06] font-semibold tracking-[-0.025em] text-balance text-[color:var(--ink)]">
            The best people you&apos;ll meet this year aren&apos;t on an app. They&apos;re across the room.
          </h1>
          <p className="mt-4.5 max-w-[540px] text-[16.5px] leading-[1.55] text-[color:var(--ink-soft)] sm:text-[19px]">
            Click gets you out doing things you love, in real life. The people you&apos;ll click with are already there.
          </p>
          <div className="mt-6">
            <ButtonLink href={ctaHref} size="lg">
              {ctaLabel}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* 2 · How it works - three steps */}
      <section className="bg-[color:var(--lav-bg)]">
        <div className="ck-page py-12 sm:py-16">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display text-[length:var(--text-h2)] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-[color:var(--ink)]">
            You don&apos;t click with a profile. You click in person.
          </h2>
          <p className="mt-3.5 max-w-[620px] text-[15.5px] leading-[1.6] text-[color:var(--ink-soft)] sm:text-[17px]">
            Your closest people probably started as whoever kept showing up to the same thing you did. Psychologists call
            it the proximity effect. Click just rebuilds the rooms where it happens.
          </p>
          <div className="mt-9 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lavender)_22%,var(--champagne))] text-[color:var(--purple)]">
                    <Icon name={step.icon} size={22} stroke={1.9} />
                  </span>
                  <span className="font-display text-[27px] font-semibold text-[color:var(--purple-300)]">{i + 1}</span>
                </div>
                <h3 className="font-display text-[19px] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-[1.58] text-[color:var(--ink-soft)]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 · The bonus - the click, teased, never explained */}
      <section className="ck-page py-14 sm:py-[72px]">
        <div className="max-w-[560px]">
          <Eyebrow>The bonus</Eyebrow>
          <h2 className="font-display text-[length:var(--text-h2)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance text-[color:var(--ink)]">
            And every so often, you just click with someone.
          </h2>
          <p className="mt-3.5 text-[15.5px] leading-[1.6] text-[color:var(--ink-soft)] sm:text-[17px]">
            Same event, same odd sense of humour, same reason for being there. Let Click know, quietly - if it&apos;s
            mutual, we suggest the next thing to do together.
          </p>
          <p className="mt-3.5 text-[15.5px] leading-[1.6] text-[color:var(--ink-soft)] sm:text-[17px]">
            A new friend, a regular crew, sometimes something more. It all works the same.
          </p>
        </div>
      </section>

      {/* 4 · On purpose */}
      <section className="bg-[color:var(--lav-bg)]">
        <div className="ck-page py-12 sm:py-16">
          <div className="max-w-[640px]">
            <Eyebrow>On purpose</Eyebrow>
            <h2 className="font-display text-[length:var(--text-h2)] leading-[1.12] font-semibold tracking-[-0.02em] text-balance text-[color:var(--ink)]">
              No endless chat. Just real life.
            </h2>
            <p className="mt-3.5 text-[15.5px] leading-[1.6] text-[color:var(--ink-soft)] sm:text-[17px]">
              When two people click, Click suggests something to do next - the plan <i>is</i> the conversation. The magic
              was never in the app; it&apos;s in the room. We set the conditions, then get out of the way.
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {ON_PURPOSE.map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lavender)_22%,var(--champagne))] text-[color:var(--purple)]">
                  <Icon name={item.icon} size={19} stroke={1.9} />
                </span>
                <div>
                  <h3 className="font-display text-[16.5px] font-semibold text-[color:var(--ink)]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-[1.55] text-[color:var(--ink-soft)]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · Come as you are - intents as quiet chips */}
      <section className="ck-page py-12 sm:py-16">
        <div className="max-w-[640px]">
          <Eyebrow>Whatever you&apos;re here for</Eyebrow>
          <h2 className="font-display text-[length:var(--text-h2)] leading-[1.12] font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
            Come as you are.
          </h2>
          <p className="mt-3.5 mb-5.5 text-[15.5px] leading-[1.6] text-[color:var(--slate)] sm:text-[17px]">
            Friendship, community, romance - equal footing. Pick what fits, or don&apos;t, and just show up.
          </p>
        </div>
        <div className="flex max-w-[720px] flex-wrap gap-2.5">
          {INTENTS.map((intent) => (
            <span
              key={intent}
              className="font-display inline-flex items-center rounded-full border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--ink)] sm:text-[14.5px]"
            >
              {intent}
            </span>
          ))}
        </div>
      </section>

      {/* 6 · For hosts */}
      <section className="bg-[color:var(--lav-bg)]">
        <div className="ck-page py-12 sm:py-14">
          <div className="max-w-[640px]">
            <Eyebrow>For hosts</Eyebrow>
            <h2 className="font-display text-[length:var(--text-h2)] leading-[1.12] font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
              You bring the room. We fill it.
            </h2>
            <p className="mt-3.5 text-[15.5px] leading-[1.6] text-[color:var(--ink-soft)] sm:text-[17px]">
              Run a studio, a bar, a run club? List your events on Click and meet a crowd that actually shows up - people
              who picked your thing on purpose.
            </p>
            <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--slate)] sm:text-[15px]">
              Free events cost nothing to host. Paid events run through Stripe with a flat {feePercentLabel} fee.
              Bookings, waitlists and door lists are handled for you.
            </p>
            <div className="mt-5">
              <ButtonLink href="/merchant/signup" variant="secondary" size="sm">
                Host on Click
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* 7 · Close */}
      <section className="ck-page py-14 text-center sm:py-[72px]">
        <h2 className="font-display mx-auto max-w-[620px] text-[length:var(--text-h1)] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-[color:var(--ink)]">
          Something good is happening in Sydney this week.
        </h2>
        <p className="mx-auto mt-3 mb-6.5 max-w-[520px] text-[15.5px] leading-[1.6] text-[color:var(--ink-soft)] sm:text-[17px]">
          Find it. Show up. Everything else is a bonus.
        </p>
        <ButtonLink href={ctaHref} size="lg">
          {ctaLabel}
        </ButtonLink>
        {/* The out-of-area note is a sign-up prompt, so it only speaks to
            someone who has not signed up. A member already told us where they
            are when they made the account. */}
        {signedIn ? null : (
          <p className="mx-auto mt-4.5 max-w-[460px] text-[13.5px] leading-[1.55] text-[color:var(--slate)]">
            Somewhere else? Sign up anyway - we&apos;ll tell you the moment Click reaches you.
          </p>
        )}
      </section>
    </main>
  );
}
