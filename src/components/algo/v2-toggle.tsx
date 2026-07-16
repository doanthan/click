"use client";

import { useActionState } from "react";
import { setMatchingV2EnabledAction, type ToggleState } from "@/app/algo/actions";

// Admin flip for the Matching v2 kill-switch. The button submits the OPPOSITE of
// the current state. Message comes back via useActionState (non-admins get a
// polite refusal instead of a crash).
export default function V2Toggle({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    setMatchingV2EnabledAction,
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="enabled" value={(!enabled).toString()} />
        <button
          type="submit"
          disabled={pending}
          className={`ck-btn ck-btn--sm ${enabled ? "ck-btn--secondary" : "ck-btn--primary"}`}
        >
          {pending ? "Saving…" : enabled ? "Disable v2 (revert to v1)" : "Enable v2 live"}
        </button>
      </form>
      {state && (
        <p
          className={`text-xs font-semibold ${
            state.ok ? "text-[color:var(--ink)]" : "text-[color:var(--danger)]"
          }`}
        >
          {state.message} <span className="opacity-60">(reload to see the new state)</span>
        </p>
      )}
    </div>
  );
}
