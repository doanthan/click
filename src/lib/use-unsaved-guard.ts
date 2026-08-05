"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Warn before unsaved form work is discarded.
 *
 * Two halves:
 *  - `beforeunload` for a reload, a tab close or an off-site link, which is the
 *    only warning the browser lets us show there (the copy is the browser's).
 *  - a capture-phase click listener for in-app <a>/<Link> navigations, which
 *    beforeunload never sees because the App Router does not unload the
 *    document. A blocked navigation surfaces as `pendingHref`, which the caller
 *    renders through the existing ConfirmDialog:
 *
 *      const { pendingHref, confirm, cancel } = useUnsavedGuard(dirty);
 *      <ConfirmDialog
 *        open={!!pendingHref}
 *        tone="rose"
 *        title="Leave without saving?"
 *        confirmLabel="Leave without saving"
 *        cancelLabel="Keep editing"
 *        onConfirm={confirm}
 *        onCancel={cancel}
 *      />
 *
 * This is PURE PROGRESSIVE ENHANCEMENT. It intercepts links only - never a
 * submit, never a button - so with JS off, or if the listener never attaches,
 * saving behaves exactly as it does today. Never gate a submit on it.
 */
export function useUnsavedGuard(dirty: boolean): {
  pendingHref: string | null;
  confirm: () => void;
  cancel: () => void;
} {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty || typeof window === "undefined") return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Legacy channel some browsers still require to show the prompt at all.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      // A modified click is an explicit "open this somewhere else" - it never
      // discards the current document, so there is nothing to guard.
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const raw = anchor.getAttribute("href");
      // In-page anchors and non-navigating hrefs leave the form mounted.
      if (!raw || raw.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Cross-origin leaves the SPA entirely, which beforeunload already covers.
      if (url.origin !== window.location.origin) return;
      // Same route (a filter or hash change) keeps the form mounted.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      event.preventDefault();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase, so we get in ahead of the router's own click handler.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  /** Proceed with the navigation the guard held back. */
  const confirm = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  }, [pendingHref, router]);

  /** Stay on the page and keep editing. */
  const cancel = useCallback(() => setPendingHref(null), []);

  return { pendingHref, confirm, cancel };
}
