import { Badge, Icon } from "@/components/ds";
import { FinishOnboardingButton } from "@/components/merchant-onboarding-wizard";

// Final step. The CTAs stamp onboarding_completed_at on tap (via
// FinishOnboardingButton → POST /api/merchant/onboarding/complete) so /merchant
// stops redirecting back into onboarding - whether the merchant connected
// payouts or skipped. Stamping on tap (not on render) is load-bearing: Next.js
// Link prefetch can render this page before the merchant ever arrives, and a
// render-time stamp would quietly finish the flow for them.
//
// This is the one genuine completion moment in the walkthrough, so it gets the
// weight: a sage check that pops in, then the headline, copy and CTAs riding up
// behind it. Deliberately no confetti - the DS bans it as a gamification
// trinket, and a merchant who has just handed over bank details is owed
// confirmation, not celebration.
export default function OnboardingDonePage() {
  return (
    <div className="grid gap-6">
      <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
        {/* pop-in owns `transform` via its forwards fill, so it rides a wrapper
            rather than the Badge - same rule as the sticker on step 1. */}
        <span className="pop-in inline-flex">
          <Badge tone="sage">
            <Icon name="check" size={13} stroke={2.6} />
            You&apos;re all set
          </Badge>
        </span>
        <h1 className="font-display rise-soft rise-d1 mt-3 text-3xl font-semibold leading-tight text-[color:var(--ink)]">
          That&apos;s the lap - go make something.
        </h1>
        <p className="rise-soft rise-d2 mt-3 text-sm font-medium leading-6 text-[color:var(--slate)]">
          Spin up your first event whenever you&apos;re ready. If you skipped
          payouts, you&apos;ll find a one-tap prompt on your dashboard and under
          Settings to connect your bank before publishing a paid event.
        </p>

        <div className="rise-soft rise-d3 mt-6 flex flex-wrap gap-3">
          <FinishOnboardingButton
            href="/merchant/events/create"
            label="Create your first event →"
          />
          <FinishOnboardingButton
            href="/merchant"
            label="Go to dashboard"
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
}
