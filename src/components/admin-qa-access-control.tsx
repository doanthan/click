"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  setAdminQaAccessAction,
  type AdminQaAccessState,
} from "@/app/admin/system/actions";

/**
 * A form action rather than a Link: enabling QA access only changes an HttpOnly
 * cookie, so leaving /admin/system was unnecessary and made the page's
 * unsaved-settings guard claim the QA control would discard unrelated edits.
 */
export function AdminQaAccessControl({ unlocked }: { unlocked: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminQaAccessState, FormData>(
    setAdminQaAccessAction,
    null,
  );
  const current = state?.ok ? state.enabled : unlocked;

  // Refresh the root layout as well as this card so the avatar menu gains or
  // loses "Test as another person" immediately. router.refresh preserves client state,
  // including an unsaved AdminSystemSettings draft above this control.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {current ? (
        <Link href="/test" className="ck-btn ck-btn--primary ck-btn--md whitespace-nowrap">
          Open testing workspace
        </Link>
      ) : null}
      <form action={action}>
        <input type="hidden" name="enabled" value={String(!current)} />
        <button
          type="submit"
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className={`ck-btn ck-btn--md ${current ? "ck-btn--secondary" : "ck-btn--primary"} ${
            pending ? "opacity-70" : ""
          }`}
        >
          {pending ? (current ? "Turning off…" : "Turning on…") : current ? "Turn off" : "Turn on"}
        </button>
      </form>
      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`max-w-xs text-left text-xs font-semibold sm:text-right ${
            state.ok ? "text-[color:var(--slate)]" : "text-[color:var(--danger)]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
