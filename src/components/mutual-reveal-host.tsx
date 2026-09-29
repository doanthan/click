"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ProposalCatalogueEvent, ProposalEntry } from "@/lib/event-repository";
import { CoordinationDrawer } from "./coordination-drawer";
import {
  CLICK_SENT_EVENT,
  announceMutualRevealed,
  revealedThisSession,
  type ClickSent,
} from "./mutual-reveal";

type Coordination = { entry: ProposalEntry; catalogue: ProposalCatalogueEvent[] };

// null = the server says there is nothing to open; undefined = the read itself failed.
// The two matter apart only mid-drawer, where a dropped request must not close it.
async function fetchCoordination(query: string): Promise<Coordination | null | undefined> {
  try {
    const response = await fetch(`/api/clicks/coordination?${query}`, { cache: "no-store" });
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      entry: ProposalEntry | null;
      catalogue?: ProposalCatalogueEvent[];
    };
    return body.entry ? { entry: body.entry, catalogue: body.catalogue ?? [] } : null;
  } catch {
    // A missed reveal is not a failure: the bell, the dashboard and Your clicks carry it.
    return undefined;
  }
}

// The live mutual reveal for the person whose click COMPLETED it (COORDINATION_MODAL_SYSTEM
// §4), over the click surface they're on - and the rest of the coordination drawer after
// it, in place (§1). "Suggest a plan" steps on inside the same drawer; it used to hand off
// to /proposals, which changed the URL and the page mid-sequence. Mounted once in the root
// layout for signed-in members, inside ChromeGate so it never lands on top of sign-in,
// onboarding or a quiz takeover.
//
// Only the completer. A click form announces its send with the person it clicked, and this
// reads back the viewer's unseen mutual with exactly that person. The person who was
// WAITING meets theirs when they open it: the notification, the dashboard moment, Your
// clicks and the email all land on the drawer at /proposals, which plays it there.
export function MutualRevealHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState<Coordination | null>(null);

  // A link inside the drawer (the RSVP, the event, report or block) leaves the page, and
  // the drawer must not ride along over the next one. Reset while rendering, React's
  // idiom for state that follows a prop, rather than a setState in an effect.
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(null);
  }
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let disposed = false;
    async function onSent(event: Event) {
      const { profileId } = (event as CustomEvent<ClickSent>).detail;
      const sentOn = pathRef.current;
      const found = await fetchCoordination(`with=${encodeURIComponent(profileId)}`);
      // Nothing if the person has moved on to another page since the tap.
      if (disposed || !found || pathRef.current !== sentOn) return;
      if (revealedThisSession.has(found.entry.mutualId)) return;
      setOpen((current) => current ?? found);
    }
    window.addEventListener(CLICK_SENT_EVENT, onSent);
    return () => {
      disposed = true;
      window.removeEventListener(CLICK_SENT_EVENT, onSent);
    };
  }, []);

  // So a card still showing that person moves its button to the mutual state underneath.
  const mutualId = open?.entry.mutualId;
  const otherId = open?.entry.otherId;
  useEffect(() => {
    if (mutualId && otherId) announceMutualRevealed(otherId, mutualId);
  }, [mutualId, otherId]);

  // The page underneath was rendered before the mutual existed - its Your clicks, its
  // banner - so it is refreshed on the way out.
  const close = useCallback(() => {
    setOpen(null);
    router.refresh();
  }, [router]);

  // An action landed: every one revalidates /proposals, which is not this page, so read
  // the mutual back and let the drawer re-project its step. A mutual that has left the
  // projection (not feeling it, a block) closes the drawer; a failed read keeps it open.
  const reload = useCallback(async () => {
    if (!mutualId) return;
    const fresh = await fetchCoordination(`id=${encodeURIComponent(mutualId)}`);
    if (fresh === undefined) return;
    if (fresh === null) {
      close();
      return;
    }
    setOpen((current) => (current?.entry.mutualId === mutualId ? fresh : current));
  }, [mutualId, close]);

  if (!open) return null;
  return (
    <CoordinationDrawer
      key={open.entry.mutualId}
      entry={open.entry}
      catalogue={open.catalogue}
      onClose={close}
      onChanged={reload}
    />
  );
}
