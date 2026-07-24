"use client";

import Image from "next/image";
import { fireBrandConfetti } from "./brand-confetti";
import toastFaces from "../../public/home/avatars/av-3.jpg";

/* The floating notification in the hero photo - the product's magic moment
   (a mutual click landing) mocked up as a push notification, Partiful-style.
   Demo copy only, no real data; tapping it pops the brand confetti from the
   card's own position. */
export function MutualToast() {
  return (
    <button
      type="button"
      aria-label="A mutual click notification - tap to pop confetti"
      className="flex w-[326px] items-center gap-3 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-3 text-left shadow-[var(--shadow-lg)]"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        void fireBrandConfetti({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        });
      }}
    >
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
      <span className="font-display shrink-0 rounded-[10px] bg-[color:var(--purple)] px-3 py-1.5 text-[12.5px] font-semibold text-[color:var(--champagne)]">
        Open
      </span>
    </button>
  );
}
