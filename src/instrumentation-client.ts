// Client instrumentation - runs once, synchronously, at the very top of the
// dev/prod client bootstrap (Next requires this module before `appBootstrap`,
// i.e. before the dev overlay's `handleGlobalErrors()` registers its own
// `unhandledrejection` listener). That ordering is the whole point: see below.
//
// Why this exists
// ---------------
// The Mapbox SearchBox (`@mapbox/search-js-*`, used by the address autocomplete
// on /merchant/events/create/location) and mapbox-gl (map tiles) abort every
// superseded in-flight request via `AbortController.abort()` with no reason.
// The aborted work rejects with a benign DOMException - `AbortError: signal is
// aborted without reason`. The library discards the result either way, but on
// some paths the rejection still escapes as an *unhandled* rejection. Next's
// dev overlay then paints it as a "Runtime AbortError" and forwards it to the
// terminal as `[browser] ⨯ unhandledRejection: AbortError`. It's harmless, but
// it's noise that masks real errors.
//
// Why a window listener here (and not in the component)
// -----------------------------------------------------
// Next's overlay listener (`onUnhandledRejection` in its `use-error-handler`)
// always logs + overlays any rejection that isn't one of its own router
// errors; it does not honour `preventDefault()`. For `window`-targeted events,
// listeners fire in registration order, so the only way to stop Next's handler
// is to register BEFORE it and call `stopImmediatePropagation()`. Component
// code runs long after the overlay is wired up, so it can never win that race -
// but `instrumentation-client` is required before the overlay setup, so it can.
//
// We swallow only `AbortError`: these are always intentional cancellations that
// have no business surfacing as unhandled rejections. Every other rejection
// passes through untouched.
if (typeof window !== "undefined") {
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event.reason as { name?: string } | null | undefined;
      if (reason?.name === "AbortError") {
        // Stop Next's overlay/terminal handler (registered after us) from
        // running, and mark the rejection handled for any other consumer.
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    // Capture phase so we're ahead of any bubble-phase listeners too.
    true,
  );
}
