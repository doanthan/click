"use client";

import Image from "next/image";
import { fireBrandConfetti } from "./brand-confetti";
import toastFaces from "../../public/home/avatars/av-3.jpg";

/* The floating card in the hero photo - an ILLUSTRATION of the product's magic
   moment (a mutual click landing), Partiful-style. Deliberately labelled
   "example": it is NOT the viewer's own notification, "Priya" is demo copy, and
   it stores nothing - tapping it only pops the brand confetti. It carries no
   live/actionable affordance (no "Open" CTA), just a passive timestamp, so a
   logged-out visitor can't mistake it for a real, personal push. Final copy is
   Cindy's to bless. */
export function MutualToast() {
  return (
    <button
      type="button"
      aria-label="Example of a mutual click - tap to pop confetti"
      className="flex w-[326px] flex-col gap-2 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-3 text-left shadow-[var(--shadow-lg)]"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        void fireBrandConfetti({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        });
      }}
    >
      {/* Unmistakably an illustration - not the viewer's own notification. */}
      <span className="inline-flex items-center gap-1 self-start rounded-full bg-[color:var(--lav-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--purple)]">
        <span aria-hidden>✦</span> example
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
            It&apos;s mutual <span aria-hidden>✦</span>
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
