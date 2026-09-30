/// <reference types="react/canary" />
import { ViewTransition, type ReactNode } from "react";

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

/**
 * Wraps a route's loading.tsx so the skeleton dissolves into the page when its
 * data lands, instead of snapping. It wraps the whole shell, one snapshot per
 * page, rather than each Skeleton block. A snapshot ignores its parents'
 * overflow, so per-block snapshots would paint every rail- and card-clipped
 * block uncropped for the length of the fade.
 */
export function RouteSkeleton({ children }: { children: ReactNode }) {
  return (
    <ViewTransition exit="ck-skeleton" default="none">
      {children}
    </ViewTransition>
  );
}
