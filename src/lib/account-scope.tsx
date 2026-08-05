"use client";

import { createContext, useContext } from "react";

/**
 * Who the browser is currently signed in as, for the benefit of anything that
 * writes to localStorage/sessionStorage.
 *
 * Browser storage is per-BROWSER, but a draft is per-PERSON. One tab signs in
 * as several people all the time here - the QA persona switcher, a shared
 * laptop, a host who also has an attendee account - and every draft key in the
 * app used to be global, so the next person to open a form was handed the
 * previous one's answers: their name and birth date on /onboarding, their ABN,
 * phone and street address on the merchant signup wizard.
 *
 * Scoping the keys is deliberate rather than wiping them on sign-in: wiping
 * races the forms (a hydrate effect can read a stale draft before any sweep
 * runs), and it would throw away a draft you meant to come back to. A scoped
 * key can never be read by the wrong account in the first place.
 *
 * The provider is mounted once in the root layout, so a form only has to call
 * useAccountScope() - there is no prop to thread and nothing to remember when
 * adding the next form.
 */

export const ANON_SCOPE = "anon";

const AccountScopeContext = createContext<string>(ANON_SCOPE);

export function AccountScopeProvider({
  scope,
  children,
}: {
  /** The signed-in email, or null when signed out. */
  scope: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <AccountScopeContext.Provider value={scope?.trim().toLowerCase() || ANON_SCOPE}>
      {children}
    </AccountScopeContext.Provider>
  );
}

/** The current account's storage scope. `ANON_SCOPE` when signed out. */
export function useAccountScope() {
  return useContext(AccountScopeContext);
}

/** A storage key, namespaced to one account. */
export function scopedKey(scope: string, key: string) {
  return `${key}::${scope}`;
}
