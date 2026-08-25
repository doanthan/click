"use client";

import Link from "next/link";
import { useActionState } from "react";
import { clickCoAttendeeAction } from "@/app/dashboard/actions";
import { POST_EVENT_CLICK_CAP, POST_EVENT_CLICK_WINDOW_HOURS } from "@/lib/clicks/constants";
import type { PostEventClickPrompt } from "@/lib/event-repository";
import { Avatar, Button, ckBtn } from "./ds";

const shortDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

export function PostEventClickCard({ prompt }: { prompt: PostEventClickPrompt }) {
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);
  if (clickable.length === 0) return null;

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
      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
        Tap up to {POST_EVENT_CLICK_CAP}{" "}
        people you&apos;d like to see again. It&apos;s completely private - they only ever hear about it if they click
        you back.
      </p>
      {/* Both numbers come from src/lib/clicks/constants.ts, the same source the
          server guards read - the cap used to surface only as a thrown error on
          the fourth tap, and the window not at all until the refusal you get
          after missing it. */}
      <p className="mt-2 text-xs font-semibold text-[color:var(--slate)]">
        Open for {POST_EVENT_CLICK_WINDOW_HOURS} hours after the event
      </p>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {clickable.map((person) => (
          <CoAttendeeRow key={person.id} person={person} eventSlug={prompt.eventSlug} />
        ))}
      </ul>
    </div>
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
  const firstName = person.displayName.split(" ")[0];
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
