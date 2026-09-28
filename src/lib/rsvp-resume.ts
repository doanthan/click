// Where to send someone who tapped RSVP while signed out, once sign-up (and
// onboarding) is done: the event itself, with ?rsvp=1, which makes the event
// page reopen the booking dialog they were in (EventBookingDialog `autoOpen`).
// The return used to be wherever the tap happened, so a signup that started on
// an event came back to a page with the RSVP to find and tap all over again,
// and one that started on Discover came back to Discover with the event gone.
//
// The event page's own query survives when that is where they were (a plan's
// ?planWith=, say), which is why this reads window.location. Client-only: the
// two booking buttons call it on a 401. The server routes that send an
// unfinished profile to /onboarding add the same ?rsvp=1 themselves.
export function rsvpReturnPath(eventId: string): string {
  const eventPath = `/events/${encodeURIComponent(eventId)}`;
  const params = new URLSearchParams(
    window.location.pathname === eventPath ? window.location.search : "",
  );
  params.set("rsvp", "1");
  return `${eventPath}?${params.toString()}`;
}
