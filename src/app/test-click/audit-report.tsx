import {
  DISCOVERY_CLICK_WINDOW_DAYS,
  POST_EVENT_CLICK_WINDOW_HOURS,
  POST_EVENT_PROMPT_DELAY_HOURS,
  MUTUAL_CLOCK_DAYS,
} from "@/lib/clicks/constants";

export function ClickAuditReport() {
  return (
    <section className="border-t border-[color:var(--mist)] bg-[color:var(--cream)] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-3xl font-semibold text-[color:var(--ink)]">What the tester should check</h2>
        <p className="mt-3 text-sm text-[color:var(--slate)]">
          The scenario board reports the current pair. It is not a saved test report, and the
          walkthrough below the driver is an illustration. Record what actually happens in the live driver.
        </p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-[color:var(--ink)]">
          <li>Have the test owner prepare fresh fixtures and a clean QA pair before the session. Rebuild or reset only when needed; this clears existing test data. Check that the fixture clocks are ready and neither person has an eligibility blocker.</li>
          <li>Send a discovery click from the left person. Only that person should see it as sent. The right person should see no incoming click or mutual.</li>
          <li>Send a discovery click back from the right person. Both should now see one mutual. Repeating either send must not create another mutual.</li>
          <li>Mark the reveal seen on one side. Only that side should be marked seen. Then mark the other side.</li>
          <li>If a plan was suggested automatically, use it or counter with Plan B. Otherwise suggest Plan A. Confirm from either side. Both people still need to take a seat.</li>
          <li>Take a seat from one side, then the other. Only after both bookings should the pair show both going. Give up one seat and check the remaining person sees the recovery.</li>
          <li>On a fresh pair, test the post-event open and closed windows. The open window accepts; the closed window refuses. A discovery click and a post-event click must not form a mutual with each other.</li>
          <li>For separate fresh runs, try declining a plan, a full event, and blocking. Declining leaves the mutual available for another plan; a full event offers recovery; blocking ends coordination.</li>
        </ol>
        <p className="mt-5 text-sm leading-6 text-[color:var(--slate)]">
          Discovery clicks last {DISCOVERY_CLICK_WINDOW_DAYS} days. Post-event sends close {POST_EVENT_CLICK_WINDOW_HOURS} hours after the event ends;
          the prompt appears after {POST_EVENT_PROMPT_DELAY_HOURS} hours. Mutuals and new proposals have {MUTUAL_CLOCK_DAYS}-day clocks.
          The lifecycle job handles expiry, and blocking withdraws live plans. Confirming a plan never books a seat.
        </p>
        <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
          Also test the real People, Clicks and event pages in two separate browser sessions using the same QA people.
          The driver verifies server behavior, but cannot prove the customer-facing controls work.
          Record the pair, action, expected result and actual result with “Report a bug”.
          Do not use real accounts, paid bookings, or the global lifecycle sweep in an ordinary tester session.
        </p>
      </div>
    </section>
  );
}
