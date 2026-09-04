"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { answerPostEventWindowAction, clickCoAttendeeAction } from "@/app/dashboard/actions";
import type { PostEventClickPrompt } from "@/lib/event-repository";
import { MomentBanner } from "./dashboard-ds";
import { Avatar, Button, Spark, ckBtn } from "./ds";

const shortDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

const firstNameOf = (name: string) => name.split(" ")[0];

// Stage 0.5, "The window's own rules": the window is a backend concept and the UI
// only ever knows open or not open. Nothing on this surface may name the window's
// duration or what is left of the per-event budget - no countdown, no "N clicks
// left" - which is why the constants module is deliberately NOT imported here.
export function PostEventClickCard({ prompt }: { prompt: PostEventClickPrompt }) {
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);
  // §6.9(a): a pending click of your own is the only thing with a slot to give back.
  const swappable = prompt.coAttendees.filter((p) => p.swappable);
  // §6.9.1: once the budget is gone the surface is a SPENT STATE, not a picker. It
  // used to return null here, so the moment the budget ran out the card just stopped
  // existing - no sign the swap courtesy was ever on offer. The server hands this
  // over as a boolean; the count itself never crosses the boundary.
  const spent = prompt.budgetSpent;

  // Stage 0.5, "Empty pool": nobody else to click with is a state of its own, not
  // silence. The server keeps returning the prompt with an empty roster (and marks
  // the window answered on view) so this can render once instead of vanishing.
  if (prompt.coAttendees.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
        <EventHeading prompt={prompt} />
        <p className="font-display mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
          <Spark size={18} tone="var(--purple)" toneSmall="var(--purple-400)" />
          Quiet one
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[color:var(--slate)]">
          No one to click with here. Your next event is where it happens.
        </p>
      </div>
    );
  }

  // Nothing left to say only when there is nobody to click AND nothing was spent here.
  if (clickable.length === 0 && !spent) return null;
  const canSwap = spent && !prompt.swapUsed && swappable.length > 0 && clickable.length > 0;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <EventHeading prompt={prompt} />

      {spent ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
          Your clicks for this one are already with the people you picked.
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
          Tap anyone you&apos;d like to see again. Clicking is anonymous - we&apos;ll only show you
          if it&apos;s mutual.
        </p>
      )}

      {spent ? (
        canSwap ? (
          <>
            {/* §6.9(2) the swap courtesy: one per event, for the wrong person picked
                early or the better one met late. Two native selects and a submit -
                no client state, and the whole exchange is one transaction on the
                server, so it can never spend the swap without landing the click.
                The person swapped out is never told (§6.9(c)). */}
            <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
              You can swap one click, once, while the window is open. Nobody is told.
            </p>
            <SwapForm prompt={prompt} />
          </>
        ) : (
          <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--slate)]">
            {prompt.swapUsed
              ? "You've used your swap for this event."
              : "Your clicks are all out there. If any are mutual you'll both hear about it."}
          </p>
        )
      ) : (
        <>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {clickable.map((person) => (
              <CoAttendeeRow key={person.id} person={person} eventSlug={prompt.eventSlug} />
            ))}
          </ul>
          <NoOneThisTime eventSlug={prompt.eventSlug} />
        </>
      )}
    </div>
  );
}

// The date + title the whole card hangs off. Shared by the picker and the empty
// pool so the "Quiet one" state still says which night it is talking about.
function EventHeading({ prompt }: { prompt: PostEventClickPrompt }) {
  return (
    <>
      <p className="text-xs font-semibold text-[color:var(--slate)]">
        You were there · {shortDate.format(new Date(prompt.endedAt))}
      </p>
      <h3 className="font-display mt-1 text-[1.18rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-[color:var(--ink)] sm:text-[1.3rem]">
        <Link href={`/events/${prompt.eventSlug}`} className="hover:underline">
          {prompt.eventTitle}
        </Link>
      </h3>
    </>
  );
}

// Stage 0.5: a window is answered by clicking at least one person OR by tapping
// this. Without it, someone who wanted nobody from a night had no way to say so -
// the prompt simply re-asked on every visit until the window lapsed. This one
// writes; `Maybe later` on the banner does not.
function NoOneThisTime({ eventSlug }: { eventSlug: string }) {
  const [state, formAction, submitting] = useActionState(answerPostEventWindowAction, null);

  return (
    <form action={formAction} className="mt-3.5">
      <input type="hidden" name="source_event" value={eventSlug} />
      <Button type="submit" variant="ghost" size="sm" loading={submitting}>
        No one this time
      </Button>
      {state?.message ? (
        <p role="status" className="mt-2 text-xs leading-5 text-[color:var(--slate)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// The store behind the dismissal never emits: nothing outside this component writes
// the key, so a subscriber that returns a no-op unsubscribe is the whole contract.
const noopSubscribe = () => () => {};

// The Stage 0.5 dashboard moment banner. It lives here rather than at the (server)
// call site because `Maybe later` is client-side only: the runbook is explicit that
// it calls nothing, dismisses the banner for THIS session, and leaves the window
// unanswered so the banner returns next visit. sessionStorage is exactly that
// lifetime; the dismissal is read after mount so the server and first client render
// still agree.
export function PostEventMomentBanner({ eyebrow, eventSlug }: { eyebrow: string; eventSlug: string }) {
  const key = `click:post-event-later:${eventSlug}`;
  // useSyncExternalStore rather than a setState-in-effect: the server snapshot is
  // always "not dismissed", so the first client render matches the HTML and the
  // stored value is picked up in the same commit instead of a second cascading one.
  // The store never changes after mount - `Maybe later` navigates nothing, it just
  // writes the key and drops the banner - so subscribe is a no-op unsubscriber.
  const stored = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return sessionStorage.getItem(key) === "1";
      } catch {
        // Private-mode storage refusals are not worth a broken banner.
        return false;
      }
    },
    () => false,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = stored || dismissedNow;

  if (dismissed) return null;

  return (
    <div className="rise-soft rise-d2 mt-6 max-w-[760px]">
      <MomentBanner
        icon="calendar"
        eyebrow={eyebrow}
        title="Did you click with anyone?"
        sub="Click anyone worth a second hang - we'll do the rest."
        actionLabel="See who was there"
        actionHref="#who-was-there"
        secondary={
          <button
            type="button"
            className={ckBtn("ghost", "sm", { className: "w-full sm:w-auto" })}
            onClick={() => {
              try {
                sessionStorage.setItem(key, "1");
              } catch {
                // Session-only either way - worst case it returns on the next render.
              }
              setDismissedNow(true);
            }}
          >
            <span className="ck-btn__label">Maybe later</span>
          </button>
        }
      />
    </div>
  );
}

// The swap picker. One form: who to let go of, who to spend it on.
function SwapForm({ prompt }: { prompt: PostEventClickPrompt }) {
  const [state, formAction, submitting] = useActionState(clickCoAttendeeAction, null);
  const swappable = prompt.coAttendees.filter((p) => p.swappable);
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);

  return (
    <form action={formAction} className="mt-3 grid gap-3">
      <input type="hidden" name="source_event" value={prompt.eventSlug} />
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--slate)]">Swap out</span>
        {/* Both selects wear .ck-input rather than a hand-rolled string: that one
            was ~38px tall on a phone, under the 44px floor, on the control that
            spends the one-per-event swap. */}
        <select name="release_profile_id" className="ck-input w-full" defaultValue={swappable[0]?.id}>
          {swappable.map((person) => (
            <option key={person.id} value={person.id}>
              {firstNameOf(person.displayName)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--slate)]">Click with</span>
        <select name="profile_id" className="ck-input w-full" defaultValue={clickable[0]?.id}>
          {clickable.map((person) => (
            <option key={person.id} value={person.id}>
              {firstNameOf(person.displayName)}
            </option>
          ))}
        </select>
      </label>
      <div>
        <Button type="submit" variant="secondary" size="sm" loading={submitting}>
          Swap this click
        </Button>
      </div>
      {state?.message ? (
        <p role="status" className="text-xs leading-5 text-[color:var(--slate)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// One row per person, so each can own its own useActionState - a hook can't run
// in a loop, and each click needs its own independent result.
function CoAttendeeRow({
  person,
  eventSlug,
}: {
  person: PostEventClickPrompt["coAttendees"][number];
  eventSlug: string;
}) {
  const [state, formAction, submitting] = useActionState(clickCoAttendeeAction, null);
  const firstName = firstNameOf(person.displayName);
  const sent = state?.ok === true || person.alreadyClicked;

  return (
    <li className="rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-3">
      <div className="flex items-center gap-3">
        <Avatar name={person.displayName} src={person.photoUrl} size={40} />
        {/* The name is the only route to this person's profile from here, and
            at 14px it was a ~20px-tall target beside a 44px button. Padding
            grows the hit box; the negative margin keeps the row height. */}
        <Link
          href={`/profile/${person.id}`}
          className="font-display -my-3 min-w-0 flex-1 truncate py-3 text-sm font-semibold text-[color:var(--ink)] hover:underline"
        >
          {firstName}
        </Link>
        <form action={formAction}>
          <input type="hidden" name="profile_id" value={person.id} />
          <input type="hidden" name="source_event" value={eventSlug} />
          {sent ? (
            <span className={ckBtn("pending", "sm", { className: "shrink-0" })} aria-live="polite">
              <span className="ck-btn__label">clicked</span>
            </span>
          ) : (
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              click with {firstName}
            </Button>
          )}
        </form>
      </div>
      {/* The outcome the action used to swallow: a closed post-event window, a
          spent per-event cap, or the kill switch being off all land here. */}
      {state?.message ? (
        <p role="status" className="mt-2 text-xs leading-5 text-[color:var(--slate)]">
          {state.message}
        </p>
      ) : null}
    </li>
  );
}
