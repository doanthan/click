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
          className={`rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide hard-shadow-sm transition disabled:opacity-50 ${
            enabled
              ? "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
              : "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          }`}
        >
          {pending ? "Saving…" : enabled ? "Disable v2 (revert to v1)" : "Enable v2 live"}
        </button>
      </form>
      {state && (
        <p
          className={`text-xs font-semibold ${
            state.ok ? "text-[color:var(--ink)]" : "text-[color:var(--rose)]"
          }`}
        >
          {state.message} <span className="opacity-60">(reload to see the new state)</span>
        </p>
      )}
    </div>
  );
}
