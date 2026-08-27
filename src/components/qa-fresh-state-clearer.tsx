"use client";

import { useLayoutEffect } from "react";
import { useAccountScope } from "@/lib/account-scope";

/**
 * A fresh QA scenario resets server rows and the selected account's browser
 * drafts. Without the second half, attendee or host onboarding can reopen the
 * answers from the previous run even though its database state is clean.
 */
export function QaFreshStateClearer() {
  const scope = useAccountScope();

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("qaFresh") !== "1") return;

    const suffix = `::${scope}`;
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
        for (const key of keys) {
          if (key?.endsWith(suffix)) storage.removeItem(key);
        }
      } catch {
        // Storage may be blocked in private browsing. Server state is still
        // reset, so leave the form usable with its normal in-memory defaults.
      }
    }

    url.searchParams.delete("qaFresh");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [scope]);

  return null;
}
