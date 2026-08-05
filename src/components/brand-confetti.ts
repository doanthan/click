"use client";

// Brand-coloured celebratory confetti. Dynamic-imports canvas-confetti exactly
// like src/components/support/support-widget.tsx so it stays out of the initial
// bundle.
//
// WHERE THIS IS ALLOWED - settled, please don't re-litigate. The header used to
// say "genuine success moments" with no boundary, and the drift that followed
// left one surface deleting its burst while four others kept theirs.
//
// The DS bans confetti in exactly ONE place: "context/Click Design System/
// README.md" line 114, inside the mutual-coordination MODAL set - "Premium
// restraint - dopamine via a real moment, never gamification trinkets (no
// confetti/badges/streaks) or dark patterns". That sentence is scoped to the
// mutual / click / coordination surfaces, and the same line prescribes what
// goes there instead: "a soft pop animation, prefers-reduced-motion safe".
// The general gamification ban at README line 174 lists depleting counters,
// streaks, points, leaderboards, loss/urgency, guilt nudges and fake scarcity -
// confetti is deliberately NOT on that list.
//
// So the boundary is:
//   BANNED  on anything depicting a mutual click, a click, or coordination.
//           mutual-toast.tsx is the worked example - it re-pops a single ✦
//           spark glyph (.pop-in) rather than firing particles.
//   ALLOWED on a genuine personal completion the user themselves just
//           finished: finishing the quiz (home-quiz.tsx), a confirmed RSVP
//           (event-rsvp-success-overlay.tsx), completing onboarding
//           (onboarding-form.tsx).
// Check any fifth call site against that line before adding it.
//
// IMPORTANT: the global prefers-reduced-motion CSS block in globals.css freezes
// CSS animations but does NOT cover canvas-confetti's JS-driven canvas, so we
// guard every fire with an explicit window.matchMedia check (and pass
// canvas-confetti's own disableForReducedMotion flag as a second belt).
const BRAND_COLORS = ["#E8674C", "#C8B8F8", "#3B2F81", "#1C1830"];

export async function fireBrandConfetti(origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 70,
      spread: 68,
      startVelocity: 38,
      gravity: 0.9,
      scalar: 0.9,
      ticks: 160,
      origin: origin ?? { x: 0.5, y: 0.62 },
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
    });
  } catch {
    /* confetti is optional; never break the flow it celebrates */
  }
}
