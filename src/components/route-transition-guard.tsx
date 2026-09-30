"use client";

import { useEffect } from "react";

/**
 * Safari and Chrome on Android animate a swipe back or forward themselves. If
 * the route transition then played too, the page you had just swiped away
 * would flash back and fade out. So after a gesture traversal this marks
 * <html data-ua-transition>, and globals.css stills the route transition while
 * it is set. The next tap or key press clears it, so a navigation someone
 * starts themselves always animates.
 */
export function RouteTransitionGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.removeAttribute("data-ua-transition");
    const onPopState = (event: PopStateEvent) => {
      if (event.hasUAVisualTransition) root.setAttribute("data-ua-transition", "");
      else clear();
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pointerdown", clear, true);
    window.addEventListener("keydown", clear, true);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pointerdown", clear, true);
      window.removeEventListener("keydown", clear, true);
      clear();
    };
  }, []);

  return null;
}
