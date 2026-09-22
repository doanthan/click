"use client";

import { useEffect } from "react";

// Guards against the browser back/forward cache (bfcache) resurrecting a page
// that was server-rendered under a PREVIOUS session. Every authed surface here
// is rendered per-request from the session cookie, but bfcache restores the
// full DOM snapshot from memory without hitting the server - so after a
// sign-out or account switch, pressing Back (or restoring the tab) shows the
// old user's dashboard/header as if they were still signed in. Reported as
// "I logged in as Ellen but got Janey's account" / "logged out but it
// authenticated me back as my last session".
//
// `pageshow` fires with `persisted: true` only on bfcache restores, so a normal
// load/navigation never reloads. The reload re-renders against the cookie that
// is ACTUALLY present now.
export function SessionFreshness({ version, expiresAt }: { version: string; expiresAt?: number }) {
  useEffect(() => {
    let checking = false;
    let disposed = false;
    async function checkSession() {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/session-state", { cache: "no-store" });
        if (response.ok) {
          const current = await response.json();
          if (!disposed && current.version !== version) window.location.reload();
        }
      } catch { /* Keep the current page usable through a network interruption. */ }
      finally { checking = false; }
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === "click:session-changed") void checkSession();
    }
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", checkSession);
    // Includes ordinary login/sign-out and OAuth returns, not just the picker.
    // This carries no identity: other tabs always ask the server for the truth.
    try { localStorage.setItem("click:session-changed", crypto.randomUUID()); } catch {}
    // Also catches an old request completing after a switch in another tab.
    void checkSession();
    const expiryTimer = expiresAt ? window.setTimeout(checkSession, Math.max(0, expiresAt - Date.now()) + 100) : undefined;
    return () => {
      disposed = true;
      window.clearTimeout(expiryTimer);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [version, expiresAt]);

  return null;
}
