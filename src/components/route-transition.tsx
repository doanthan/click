"use client";
/// <reference types="react/canary" />
import { ViewTransition, useSyncExternalStore, type ReactNode } from "react";

/**
 * The route transition - the one piece of motion every page shares. It is the
 * default export of app/template.tsx and of the nested templates. A template
 * remounts when the route changes, where a layout would not, so this
 * <ViewTransition> gets a real exit and enter to animate and is never asked
 * for an in-place update. The CSS lives in globals.css under "Route
 * transitions", along with the chrome that stays pinned while it plays and the
 * reduced-motion collapse.
 *
 * default="none" is load-bearing. Without it, every router.refresh(), server
 * action and search-param change inside the page would crossfade the whole
 * page as well.
 *
 * Cost: everything inside a <ViewTransition> opts into React's suspensey
 * images. A route change holds its commit (up to ~800ms) for any eager plain
 * <img> without an onLoad. next/image has an onLoad, and Avatar is lazy for
 * this reason.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="ck-page" exit="ck-page" default="none">
      {children}
    </ViewTransition>
  );
}

const noSubscribe = () => () => {};

/**
 * Wraps a route's loading.tsx so the skeleton dissolves into the page when its
 * data lands, instead of snapping. It wraps the whole shell, one snapshot per
 * page, rather than each Skeleton block. A snapshot ignores its parents'
 * overflow, so per-block snapshots would paint every rail- and card-clipped
 * block uncropped for the length of the fade.
 *
 * Client navigations only. A server-rendered shell is revealed by React's
 * streaming script, and the vt-exit this transition stamps on it sends that
 * reveal through document.startViewTransition, which first waits up to 500ms
 * for fonts and every in-view image and then plays the fade. React streams a
 * big page's content BEHIND its loading shell even when it's ready (every page
 * with the site header), so on a hard load a phone sat on "Loading Click…" or
 * a skeleton for all of that with the page already downloaded. Rendered bare
 * on the server and through hydration, the shell swaps out on the next frame.
 */
export function RouteSkeleton({ children }: { children: ReactNode }) {
  const clientRender = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!clientRender) return children;
  return (
    <ViewTransition exit="ck-skeleton" default="none">
      {children}
    </ViewTransition>
  );
}
