"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WizardStepper } from "./merchant-ds";

// Post-approval merchant onboarding - a short walkthrough shown once after an
// admin approves a merchant. Each step has its own URL so the Stripe
// hosted-onboarding round-trip (leave the app → come back to
// /merchant/onboarding/payouts) doesn't lose wizard state:
//   /merchant/onboarding/welcome  · the news, plus what hosting looks like
//   /merchant/onboarding/payouts  · connect Stripe (skippable)
//   /merchant/onboarding/done     · finish → create first event
//
// There used to be a fourth step, /create-events, that rendered a hand-written
// prose copy of the create-event wizard's own five-step stepper. It collected
// nothing, it had already drifted out of sync with STEP_TITLES once, and the
// merchant sees the real stepper about thirty seconds later - so it was a page
// load spent teaching something the next screen teaches better. Deleted rather
// than folded in, because any copy of that list is a copy that must be diffed
// by hand forever.
//
// Unlike the signup wizard there's no form state to persist, so there's no
// context provider - the only shared piece is the pathname-driven progress
// bar. The interactive bits (Connect with Stripe, Finish) are the small client
// buttons at the bottom.

export const ONBOARDING_STEPS = [
  { path: "/merchant/onboarding/welcome", title: "Welcome" },
  { path: "/merchant/onboarding/payouts", title: "Get paid" },
  { path: "/merchant/onboarding/done", title: "Done" },
] as const;

export function OnboardingProgress() {
  const pathname = usePathname();
  const current = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((s) => pathname.startsWith(s.path)),
  );

  // Completed dots are tappable here. WizardStepper's read-only mode exists so
  // you can't skip ahead past unvalidated input - this walkthrough has no input
  // at all, so re-reading step 1 from step 3 should cost one tap, not two Backs.
  return (
    <WizardStepper
      steps={ONBOARDING_STEPS.map((s) => s.title)}
      current={current}
      paths={ONBOARDING_STEPS.map((s) => s.path)}
    />
  );
}

const primaryBtn = "ck-btn ck-btn--primary ck-btn--md";
const secondaryBtn = "ck-btn ck-btn--secondary ck-btn--md";

// Back / Next link row. Mostly-static steps use this; the payouts step swaps
// Next for its own Skip/Continue controls.
export function OnboardingNav({
  backHref,
  nextHref,
  nextLabel = "Next →",
}: {
  backHref?: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {backHref ? (
        <Link href={backHref} className={secondaryBtn}>
          ← Back
        </Link>
      ) : (
        <span />
      )}
      {nextHref ? (
        <Link href={nextHref} className={primaryBtn}>
          {nextLabel}
        </Link>
      ) : null}
    </div>
  );
}

// Kicks off Stripe Connect onboarding: asks the API to create (once) the
// connected account + a hosted-onboarding link, then redirects the browser to
// Stripe. The user comes back to `returnTo`, or to whichever page they pressed
// the button on when that is not given.
export function ConnectPayoutsButton({
  label = "Connect with Stripe →",
  returnTo,
}: {
  label?: string;
  /**
   * Where Stripe should hand the host back. The payout step passes through the
   * ?returnTo= it was linked with, so a host who started from Finances, from
   * Settings or from the middle of the create wizard is returned THERE rather
   * than dropped into a first-run walkthrough. Server-validated to a /merchant
   * path in the connect route, never trusted as given.
   */
  returnTo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    // Guard in the handler, not with `disabled` - see the button below.
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/merchant/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Come back to the page the host actually pressed the button on. The
        // route hardcoded /merchant/onboarding/payouts, so an established host
        // connecting from Finances or Settings was returned into step 2 of 3 of
        // a first-run walkthrough ending on "Create your first event".
        body: JSON.stringify({
          returnTo: returnTo || window.location.pathname + window.location.search,
        }),
      });
      if (response.status === 401) {
        window.location.href = "/merchant/login?callbackUrl=/merchant/onboarding/payouts";
        return;
      }
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !body.url) {
        setError(body.error ?? "Couldn't start Stripe onboarding. Try again.");
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error - please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      {/* aria-disabled, not `disabled`: a real `disabled` attribute drops the
          button out of the tab order mid-press, which browsers answer by
          blurring it and sending keyboard users back to the top of the
          document - right as we're about to hand them off to Stripe. The
          double-submit guard lives in start() instead. */}
      <button
        type="button"
        onClick={start}
        aria-busy={busy}
        aria-disabled={busy}
        className={primaryBtn}
      >
        {busy ? "Opening Stripe…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Marks the walkthrough complete (idempotent), then navigates. Used by the
// final step's CTAs so completion is tied to an explicit tap - not to the
// page rendering, which Next.js could trigger early via Link prefetch.
export function FinishOnboardingButton({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // This POST is what stamps onboarding_completed_at, and EVERY host surface
  // gates on it: /merchant, /merchant/events/create and this wizard all bounce
  // a host with no stamp back to /merchant/onboarding. So navigating anyway
  // after a failed write did not "re-prompt at worst" - it dropped the host at
  // step 1 of the tour they had just finished, with nothing explaining why, and
  // pressing the button again repeated it. A bare `await fetch` also treats a
  // 500 as success, since only a network error rejects.
  async function finish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/merchant/onboarding/complete", { method: "POST" });
      if (!response.ok) {
        setError("We couldn't save that just now. Try again in a moment.");
        setBusy(false);
        return;
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
      return;
    }
    router.push(href);
    router.refresh();
  }

  return (
    // aria-disabled rather than `disabled` for the same reason as the Stripe
    // button above: this is the last control in the flow, and blurring it would
    // dump a keyboard user to the top of the page on the way out.
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={finish}
        aria-busy={busy}
        aria-disabled={busy}
        className={variant === "primary" ? primaryBtn : secondaryBtn}
      >
        {busy ? "One sec…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs font-bold text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
