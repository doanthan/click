"use client";

import Image from "next/image";
import { useState } from "react";
import toastFaces from "../../public/home/avatars/av-3.jpg";

/* The floating card in the hero photo - an ILLUSTRATION of the product's magic
   moment (a mutual click landing), Partiful-style. Deliberately labelled
   "example": it is NOT the viewer's own notification, "Priya" is demo copy, and
   it stores nothing - tapping it only replays the spark. It carries no
   live/actionable affordance (no "Open" CTA), just a passive timestamp, so a
   logged-out visitor can't mistake it for a real, personal push. Final copy is
   Cindy's to bless.

   This card used to fire brand confetti on tap. It doesn't any more. The DS
   bans confetti on the mutual-coordination set - "Premium restraint - dopamine
   via a real moment, never gamification trinkets (no confetti/badges/streaks)"
   ("context/Click Design System/README.md" line 114) - and prescribes the
   replacement in the same breath: "a soft pop animation". Confetti stays on
   genuine personal completions only; the full boundary is written into
   brand-confetti.ts so it doesn't get re-argued.

   The tap still has to pay off - this component's whole job is to demo the
   feeling - so it re-pops the two ✦ spark glyphs. `.pop-in` is the DS
   glyph/sticker treatment (scale 0.4, rotate -12deg): exactly right on a single
   spark, and exactly what a whole content block must never get. */
export function MutualToast() {
  /* A counter rather than a boolean because it is used as a React `key`:
     bumping the key remounts the glyph, which is the only way to restart a CSS
     animation on demand. At 0 no `.pop-in` class is applied at all, so the
     resting sparks are visible before any tap and the motion stays purely
     additive - never a gate on visibility. */
  const [sparks, setSparks] = useState(0);
  const sparkClass = sparks > 0 ? "pop-in inline-block" : "inline-block";

  return (
    <button
      type="button"
      aria-label="Example of a mutual click - tap to replay it"
      className="flex w-[326px] flex-col gap-2 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-3 text-left shadow-[var(--shadow-lg)]"
      onClick={() => setSparks((n) => n + 1)}
    >
      {/* Unmistakably an illustration - not the viewer's own notification. */}
      <span className="inline-flex items-center gap-1 self-start rounded-full bg-[color:var(--lav-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--purple)]">
        <span key={`badge-spark-${sparks}`} aria-hidden className={sparkClass}>
          ✦
        </span>{" "}
        example
      </span>
      <span className="flex items-start gap-3">
        <Image
          src={toastFaces}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover"
          sizes="44px"
        />
        <span className="min-w-0 flex-1">
          <span className="font-display block text-[13.5px] leading-tight font-semibold text-[color:var(--ink)]">
            It&apos;s mutual{" "}
            {/* The 80ms offset is an inline style, not `.rise-d1`: `.pop-in` is
                declared after the .rise-d* rules in globals.css and its
                `animation` shorthand would reset the delay back to 0. Two
                glyphs in unison read mechanical; a beat apart reads as one
                sparkle in reading order. */}
            <span
              key={`title-spark-${sparks}`}
              aria-hidden
              className={sparkClass}
              style={sparks > 0 ? { animationDelay: "80ms" } : undefined}
            >
              ✦
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[12.5px] text-[color:var(--slate)]">
            You and Priya both clicked
          </span>
        </span>
        <span className="shrink-0 text-[11.5px] font-medium text-[color:var(--slate)]">now</span>
      </span>
    </button>
  );
}
