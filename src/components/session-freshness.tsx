"use client";

import { useEffect } from "react";

// Guards against the browser back/forward cache (bfcache) resurrecting a page
// that was server-rendered under a PREVIOUS session. Every authed surface here
// is rendered per-request from the session cookie, but bfcache restores the
// full DOM snapshot from memory without hitting the server — so after a
// sign-out or account switch, pressing Back (or restoring the tab) shows the
// old user's dashboard/header as if they were still signed in. Reported as
// "I logged in as Ellen but got Janey's account" / "logged out but it
// authenticated me back as my last session".
//
// `pageshow` fires with `persisted: true` only on bfcache restores, so a normal
// load/navigation never reloads. The reload re-renders against the cookie that
// is ACTUALLY present now.
export function SessionFreshness() {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
