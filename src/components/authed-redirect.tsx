"use client";

import { useEffect } from "react";

// Client-side backstop for the auth pages' server-side "already signed in?"
// redirect. The server gate can be skipped when Next's client router cache
// replays a /register or /login render that was prefetched BEFORE the user
// signed in (e.g. sign in via the modal, then tap a stale Sign up link or the
// Back button within the cache window) - the signed-in user then sees the
// signup form again. bfcache restores are already handled globally by
// <SessionFreshness />; this covers the soft-navigation path by asking the
// auth endpoint for the live session and bouncing to /post-login if one exists.
export function AuthedRedirect({ to = "/post-login" }: { to?: string }) {
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/session", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (session?.user) window.location.replace(to);
      })
      .catch(() => {
        // Network hiccup or abort - leave the form alone; the server gate
        // still protects the next full-page load.
      });

    return () => controller.abort();
  }, [to]);

  return null;
}
