import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ds";

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

export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mb-3 text-[12.5px] font-bold tracking-[0.12em] uppercase text-[color:var(--purple-500)]">{children}</p>
  );
}

/**
 * The top of /how-it-works - the hero and the three steps, what a phone shows
 * before any scrolling. Shared with loading.tsx, which passes a placeholder for
 * the one part that waits on the session, the CTA, so the loading screen is
 * the page itself and nothing moves when the rest lands.
 */
export function HowItWorksIntro({ cta }: { cta: ReactNode }) {
  return (
    <>
      {/* 1 · Hero */}
      <section className="ck-page pt-12 pb-14 sm:pt-16">
        <div className="max-w-[720px]">
          <h1 className="font-display max-w-[660px] text-[length:var(--text-display)] leading-[1.06] font-semibold tracking-[-0.025em] text-balance text-[color:var(--ink)]">
            The best people you&apos;ll meet this year aren&apos;t on an app. They&apos;re across the room.
          </h1>
          <p className="mt-4.5 max-w-[540px] text-[16.5px] leading-[1.55] text-[color:var(--ink-soft)] sm:text-[19px]">
            Click gets you out doing things you love, in real life. The people you&apos;ll click with are already there.
          </p>
          <div className="mt-6">{cta}</div>
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
    </>
  );
}
