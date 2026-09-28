"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markMutualSeenAction } from "@/app/proposals/actions";
import type { MutualReveal } from "@/lib/event-repository";
import { ModalShell } from "./modal-shell";
import {
  CLICK_SENT_EVENT,
  RevealStep,
  announceMutualRevealed,
  revealedThisSession,
} from "./mutual-reveal";

async function fetchUnseenReveal(): Promise<MutualReveal | null> {
  try {
    const response = await fetch("/api/clicks/reveal", { cache: "no-store" });
    if (!response.ok) return null;
    const { reveal } = (await response.json()) as { reveal: MutualReveal | null };
    return reveal && !revealedThisSession.has(reveal.mutualId) ? reveal : null;
  } catch {
    // A missed reveal is not a failure: the bell and the dashboard banner still carry it.
    return null;
  }
}

// The mutual reveal on every page except /proposals, where the coordination drawer
// plays it itself. Mounted once in the root layout for signed-in members, inside
// ChromeGate so it never lands on top of sign-in, onboarding or a quiz takeover.
//
// It asks api/clicks/reveal on every navigation - the other person clicked back while
// you were elsewhere - and whenever a click form announces a send, which is how the
// person whose click COMPLETED the mutual sees it straight away rather than on their
// next page. Either way a mutual plays once: every way out stamps seen_at, exactly
// as the drawer's reveal does.
export function MutualRevealHost() {
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();
  const [reveal, setReveal] = useState<MutualReveal | null>(null);
  const onProposals = pathname === "/proposals";

  // Once per navigation, and again on every announced send. The fetch lives in here
  // (the bell's idiom) so state is only ever set after it resolves, never during the
  // effect itself - and never once this page has moved on.
  useEffect(() => {
    if (onProposals) return;
    let disposed = false;
    async function check() {
      const next = await fetchUnseenReveal();
      if (!disposed && next) setReveal((current) => current ?? next);
    }
    void check();
    window.addEventListener(CLICK_SENT_EVENT, check);
    return () => {
      disposed = true;
      window.removeEventListener(CLICK_SENT_EVENT, check);
    };
  }, [pathname, onProposals]);

  useEffect(() => {
    if (reveal) announceMutualRevealed(reveal.otherId, reveal.mutualId);
  }, [reveal]);

  // Maybe later, ✕, the scrim and Escape all land here, and every one stamps seen_at -
  // the drawer's #1 bug class was a reveal that only its primary CTA ever persisted.
  const close = useCallback(() => {
    if (!reveal) return;
    revealedThisSession.add(reveal.mutualId);
    void markMutualSeenAction(reveal.mutualId);
    setReveal(null);
  }, [reveal]);

  // Suggest a plan carries on in the drawer, which owns every step after the reveal.
  // close() has put the mutual in revealedThisSession, which is what stops the drawer
  // playing the reveal a second time while the seen_at stamp is still in flight.
  const suggest = useCallback(() => {
    if (!reveal) return;
    const { mutualId } = reveal;
    close();
    router.push(`/proposals?open=${mutualId}`);
  }, [reveal, close, router]);

  if (!reveal || onProposals) return null;

  // The drawer's own card and scrim, so the reveal looks the same wherever it plays.
  return (
    <ModalShell
      onClose={close}
      labelledBy={titleId}
      align="sheet"
      zIndex={110}
      scrimClassName="bg-[color:var(--surface-deep)]/45 backdrop-blur-[2px]"
      cardClassName="step-enter-fwd max-h-[92dvh] w-full max-w-[540px] overflow-y-auto rounded-[24px] bg-[color:var(--paper)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] sm:p-7"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lav-bg)] hover:text-[color:var(--ink)]"
      >
        <span aria-hidden className="text-lg leading-none">
          ✕
        </span>
      </button>
      <RevealStep entry={reveal} titleId={titleId} onSuggest={suggest} onLater={close} />
    </ModalShell>
  );
}
