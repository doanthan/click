"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Post-approval merchant onboarding — a short, mostly-informational walkthrough
// shown once after an admin approves a merchant. Each step has its own URL so
// the Stripe hosted-onboarding round-trip (leave the app → come back to
// /merchant/onboarding/payouts) doesn't lose wizard state:
//   /merchant/onboarding/welcome        · intro
//   /merchant/onboarding/create-events  · how event creation works
//   /merchant/onboarding/payouts        · connect Stripe (skippable)
//   /merchant/onboarding/done           · finish → create first event
//
// Unlike the signup wizard there's no form state to persist, so there's no
// context provider — the only shared piece is the pathname-driven progress
// bar. The interactive bits (Connect with Stripe, Finish) are the small client
// buttons at the bottom.

export const ONBOARDING_STEPS = [
  { path: "/merchant/onboarding/welcome", title: "Welcome" },
  { path: "/merchant/onboarding/create-events", title: "Create events" },
  { path: "/merchant/onboarding/payouts", title: "Get paid" },
  { path: "/merchant/onboarding/done", title: "Done" },
] as const;

export function OnboardingProgress() {
  const pathname = usePathname();
  const current = Math.max(
    0,
    ONBOARDING_STEPS.findIndex((s) => pathname.startsWith(s.path)),
  );

  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {ONBOARDING_STEPS.map((step, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const circleClass = `flex size-8 flex-none items-center justify-center rounded-full border-2 border-[color:var(--line)] text-xs font-bold ${
          isActive
            ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
            : isDone
              ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
              : "bg-[color:var(--champagne)] text-[color:var(--mauve)]"
        }`;
        const labelClass = `hidden sm:inline font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] ${
          isActive ? "text-[color:var(--ink)]" : "text-[color:var(--mauve)]"
        }`;
        return (
          <li key={step.path} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span className={circleClass} aria-current={isActive ? "step" : undefined}>
              {isDone ? "✓" : i + 1}
            </span>
            <span className={labelClass}>{step.title}</span>
            {i < ONBOARDING_STEPS.length - 1 ? (
              <span
                className={`h-[2px] flex-1 ${
                  isDone ? "bg-[color:var(--peach)]" : "bg-[color:var(--line-soft)]"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]";

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
// Stripe. The user returns to /merchant/onboarding/payouts?stripe=return.
export function ConnectPayoutsButton({
  label = "Connect with Stripe →",
}: {
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/merchant/stripe/connect", {
        method: "POST",
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
      <button type="button" onClick={start} disabled={busy} className={primaryBtn}>
        {busy ? "Opening Stripe…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs font-bold text-[color:var(--surface-deep)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Marks the walkthrough complete (idempotent), then navigates. Used by the
// final step's CTAs so completion is tied to an explicit click — not to the
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

  async function finish() {
    setBusy(true);
    try {
      await fetch("/api/merchant/onboarding/complete", { method: "POST" });
    } catch {
      // Non-fatal — they can still navigate; /merchant will re-prompt at worst.
    }
    router.push(href);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={finish}
      disabled={busy}
      className={variant === "primary" ? primaryBtn : secondaryBtn}
    >
      {busy ? "One sec…" : label}
    </button>
  );
}
