"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setMatchingV2EnabledAction, type ToggleState } from "@/app/algo/actions";

// Admin flip for the Matching v2 kill-switch. The button submits the OPPOSITE of
// the current state. Message comes back via useActionState (non-admins get a
// polite refusal instead of a crash).
export default function V2Toggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    setMatchingV2EnabledAction,
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // The action already calls revalidatePath("/algo"), which is what feeds the
  // `enabled` prop this label is derived from. refresh() is the second guard on
  // top of it: a kill-switch that might be showing a stale state is the worst
  // failure mode there is, because the fix an operator reaches for is a second
  // tap - which flips the live engine straight back. Same idiom as
  // admin-merchant-verification.tsx. `state` keeps its identity across the
  // refresh, so this fires once per flip, not in a loop.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col gap-2">
      <form ref={formRef} action={action} className="flex items-center gap-3">
        <input type="hidden" name="enabled" value={(!enabled).toString()} />
        <button
          type="submit"
          // aria-disabled, not disabled: a disabled control loses focus mid-write
          // and drops keyboard users at the top of the document. The submit is
          // stopped in the handler instead.
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          onClick={(event) => {
            if (pending) {
              event.preventDefault();
              return;
            }
            // Turning v2 ON re-ranks people + discovery for all live traffic, so
            // it gets a confirm. Turning it OFF is the incident path and stays
            // one tap - never make an operator argue with a dialog mid-incident.
            // With scripting off this handler never runs and both directions
            // post straight through, exactly as they did before.
            if (enabled) return;
            event.preventDefault();
            setConfirming(true);
          }}
          className={`ck-btn ck-btn--sm ${enabled ? "ck-btn--secondary" : "ck-btn--primary"} ${
            pending ? "opacity-70" : ""
          }`}
        >
          {pending ? "Saving…" : enabled ? "Disable v2 (revert to v1)" : "Enable v2 live"}
        </button>
      </form>
      {state && (
        <p
          role={state.ok ? undefined : "alert"}
          className={`text-xs font-semibold ${
            state.ok ? "text-[color:var(--ink)]" : "text-[color:var(--danger)]"
          }`}
        >
          {state.message}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        title="Send live traffic through v2?"
        description="People and Discovery start ranking with the cohort model for every member straight away. The Disable button reverts it in one tap."
        confirmLabel="Enable v2 live"
        cancelLabel="Not yet"
        tone="peach"
        busy={pending}
        onConfirm={() => {
          setConfirming(false);
          formRef.current?.requestSubmit();
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
