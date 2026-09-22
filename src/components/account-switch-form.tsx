"use client";

import { useActionState, useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { AccountSwitchResult } from "@/lib/account-switch-result";

// One lock for the picker and return banner, even when both forms are visible.
let switchingAccount = false;
const listeners = new Set<() => void>();
function setSwitching(value: boolean) {
  switchingAccount = value;
  // Let the submit event capture its named button before disabling controls.
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useAccountSwitchPending() {
  return useSyncExternalStore(subscribe, () => switchingAccount, () => false);
}

export function AccountSwitchForm({ action, children }: {
  action: (previous: AccountSwitchResult, data: FormData) => Promise<AccountSwitchResult>;
  children: ReactNode;
}) {
  const [state, submit] = useActionState(async (previous: AccountSwitchResult, data: FormData) => {
    let result: AccountSwitchResult;
    try { result = await action(previous, data); }
    catch { result = { error: "The connection was interrupted. Please try again." }; }
    if (result.destination) {
      // Discard prefetched pages and mounted form state. SessionFreshness
      // announces the new session to other tabs after this navigation.
      window.location.assign(result.destination);
    } else { setSwitching(false); }
    return result;
  }, {});
  return (
    <form action={submit} onSubmitCapture={(event) => {
      if (switchingAccount) event.preventDefault();
      else setSwitching(true);
    }}>
      {state.error ? <p role="alert" className="mb-3 rounded-xl bg-[color:var(--lavender-100)] p-3 text-sm text-[color:var(--ink)]">{state.error}</p> : null}
      {children}
    </form>
  );
}

export function AccountSwitchButton({ name = "targetId", value, children, current = false }: {
  name?: string; value: string; children: ReactNode; current?: boolean;
}) {
  const { pending, data } = useFormStatus();
  const switching = useAccountSwitchPending();
  const selected = data?.get(name) === value;
  return (
    <button name={name} value={value} type="submit" disabled={switching || pending || current}
      aria-busy={pending && selected || undefined}
      className="ck-btn ck-btn--secondary ck-btn--sm whitespace-nowrap disabled:opacity-60">
      {pending && selected ? "Switching…" : current ? "Current account" : children}
    </button>
  );
}
