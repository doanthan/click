"use client";

import Link from "next/link";
import { useActionState } from "react";
import { clickCoAttendeeAction } from "@/app/dashboard/actions";
import { POST_EVENT_CLICK_CAP, POST_EVENT_CLICK_WINDOW_HOURS } from "@/lib/clicks/constants";
import type { PostEventClickPrompt } from "@/lib/event-repository";
import { Avatar, Button, ckBtn } from "./ds";

const shortDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

const firstNameOf = (name: string) => name.split(" ")[0];

export function PostEventClickCard({ prompt }: { prompt: PostEventClickPrompt }) {
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);
  // §6.9(a): a pending click of your own is the only thing with a slot to give back.
  const swappable = prompt.coAttendees.filter((p) => p.swappable);
  const remaining = Math.max(0, POST_EVENT_CLICK_CAP - prompt.clicksUsed);
  // §6.9.1: at zero the surface is a SPENT STATE, not a picker. It used to return null
  // here, so the moment the budget ran out the card just stopped existing - no account
  // of where the three went, and no sign the swap courtesy was ever on offer.
  const spent = remaining === 0;
  // Nothing left to say only when there is nobody to click AND nothing was spent here.
  if (clickable.length === 0 && !spent) return null;
  const canSwap = spent && !prompt.swapUsed && swappable.length > 0 && clickable.length > 0;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-semibold text-[color:var(--slate)]">
        You were there · {shortDate.format(new Date(prompt.endedAt))}
      </p>
      <h3 className="font-display mt-1 text-[1.18rem] leading-tight font-semibold tracking-[-0.01em] text-balance text-[color:var(--ink)] sm:text-[1.3rem]">
        <Link href={`/events/${prompt.eventSlug}`} className="hover:underline">
          {prompt.eventTitle}
        </Link>
      </h3>

      {spent ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
          You used your {POST_EVENT_CLICK_CAP} clicks for this event already. They&apos;re with the
          people you picked earlier.
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
          Tap up to {remaining} more {remaining === 1 ? "person" : "people"} you&apos;d like to see
          again. Clicking is anonymous - we&apos;ll only show you if it&apos;s mutual.
        </p>
      )}

      {/* Both numbers come from src/lib/clicks/constants.ts, the same source the
          server guards read - the cap used to surface only as a thrown error on
          the fourth tap, and the window not at all until the refusal you get
          after missing it. */}
      <p className="mt-2 text-xs font-semibold text-[color:var(--slate)]">
        Open for {POST_EVENT_CLICK_WINDOW_HOURS} hours after the event
      </p>

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
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {clickable.map((person) => (
            <CoAttendeeRow key={person.id} person={person} eventSlug={prompt.eventSlug} />
          ))}
        </ul>
      )}
    </div>
  );
}

// The swap picker. One form: who to let go of, who to spend it on.
function SwapForm({ prompt }: { prompt: PostEventClickPrompt }) {
  const [state, formAction, submitting] = useActionState(clickCoAttendeeAction, null);
  const swappable = prompt.coAttendees.filter((p) => p.swappable);
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);
  const selectClass =
    "w-full rounded-[var(--radius-md)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)]";

  return (
    <form action={formAction} className="mt-3 grid gap-3">
      <input type="hidden" name="source_event" value={prompt.eventSlug} />
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--slate)]">Swap out</span>
        <select name="release_profile_id" className={selectClass} defaultValue={swappable[0]?.id}>
          {swappable.map((person) => (
            <option key={person.id} value={person.id}>
              {firstNameOf(person.displayName)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--slate)]">Click with</span>
        <select name="profile_id" className={selectClass} defaultValue={clickable[0]?.id}>
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
