import { FinishOnboardingButton } from "@/components/merchant-onboarding-wizard";

// Final step. The CTAs stamp onboarding_completed_at on click (via
// FinishOnboardingButton → POST /api/merchant/onboarding/complete) so /merchant
// stops redirecting back into onboarding — whether the merchant connected
// payouts or skipped. Marking on click (not on render) avoids Link-prefetch
// completing the flow before the merchant actually arrives here.
export default function OnboardingDonePage() {
  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow sm:p-8">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          ✷ You&apos;re all set
        </span>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight">
          That&apos;s the lap — go make something.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Spin up your first event whenever you&apos;re ready. If you skipped
          payouts, you&apos;ll find a one-click prompt on your dashboard to
          connect your bank before publishing a paid event.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
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
