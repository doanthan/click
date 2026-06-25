"use client";

// Brand-coloured celebratory confetti for genuine success moments (saving your
// Click persona, a confirmed RSVP). Dynamic-imports canvas-confetti exactly
// like src/components/support/support-widget.tsx so it stays out of the initial
// bundle.
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
