"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EVENT_CREATE_DRAFT_VERSION,
  EVENT_CREATE_STORAGE_KEY,
  eventCreateDraftStorage,
} from "@/lib/event-create-storage";
import { scopedKey, useAccountScope } from "@/lib/account-scope";
import type { EventDuplicateDraft } from "@/lib/event-repository";

type DuplicateState = "idle" | "loading" | "error";

// "Duplicate" pre-populates the create wizard with this event's details (no
// attendees, no date) and drops the merchant into the normal create flow so
// they pick a fresh date/time, tweak anything, and publish - which is what
// pushes the copy into discovery. Handy for recurring events. The draft is
// seeded into the same browser-storage slot the wizard rehydrates from - which
// Storage that is comes from eventCreateDraftStorage(), so this side and
// useFormDraft can never drift apart and strand a seeded draft.
// Bug board #184 (choose the date), #185 (no "Copy of" prefix), #191 (prefill +
// publish to discovery).
export function MerchantEventDuplicateButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<DuplicateState>("idle");
  const [message, setMessage] = useState("");
  const [clobberOpen, setClobberOpen] = useState(false);
  // Same per-account slot the create wizard rehydrates from. The wizard gets its
  // scoping from useFormDraft; this button writes the slot directly, so it has
  // to apply the same scopedKey by hand - see lib/account-scope.
  const storageKey = scopedKey(useAccountScope(), EVENT_CREATE_STORAGE_KEY);

  // Duplicating is reversible - it opens a prefilled wizard the merchant can
  // simply walk away from - so it used to sit behind a window.confirm it did
  // not earn, and gating harmless actions is what teaches people to dismiss the
  // prompt on the cancel path without reading it. The ONE thing here that has
  // no undo is overwriting an unsaved create draft, so that is the only case
  // that asks, and it asks in the neutral tone.
  function startDuplicate() {
    let hasDraft = false;
    try {
      hasDraft = eventCreateDraftStorage().getItem(storageKey) != null;
    } catch {
      // Storage blocked (private mode, iframe) - there is no draft to lose.
    }
    if (hasDraft) {
      setClobberOpen(true);
      return;
    }
    void duplicateEvent();
  }

  async function duplicateEvent() {
    setState("loading");
    setMessage("");

    try {
      const response = await fetch(
        `/api/merchant/events/${encodeURIComponent(eventId)}/duplicate`,
        { method: "GET" },
      );
      const payload = (await response.json()) as {
        error?: string;
        draft?: EventDuplicateDraft;
      };

      if (!response.ok || !payload.draft) {
        setState("error");
        setMessage(payload.error ?? "Could not duplicate this event.");
        return;
      }

      // Seed the wizard, then land on step 1 so the merchant fills in the date.
      // The { v, values } envelope is not decoration: the wizard reads this slot
      // through useFormDraft, which drops any payload whose `v` does not match
      // EVENT_CREATE_DRAFT_VERSION. Writing the bare draft object - as this used
      // to - would now silently discard every duplicate.
      eventCreateDraftStorage().setItem(
        storageKey,
        JSON.stringify({ v: EVENT_CREATE_DRAFT_VERSION, values: payload.draft }),
      );
      router.push("/merchant/events/create/basics");
    } catch {
      setState("error");
      setMessage("Could not duplicate this event. Check your connection.");
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={startDuplicate}
        disabled={state === "loading"}
        className="ck-btn ck-btn--secondary ck-btn--md"
      >
        {state === "loading" ? "Opening copy..." : "Duplicate event"}
      </button>
      {message ? (
        <p role="alert" className="text-xs font-semibold text-[color:var(--danger)]">
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={clobberOpen}
        tone="ink"
        badge="Heads up"
        title="Replace your unsaved event draft?"
        description="You have an event part-way through the create wizard. Opening a copy of this one takes its place, and the older draft is not kept."
        confirmLabel="Open the copy"
        cancelLabel="Keep my draft"
        onConfirm={() => {
          setClobberOpen(false);
          void duplicateEvent();
        }}
        onCancel={() => setClobberOpen(false)}
      />
    </div>
  );
}
