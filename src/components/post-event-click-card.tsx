import Link from "next/link";
import { clickCoAttendeeAction } from "@/app/dashboard/actions";
import type { PostEventClickPrompt } from "@/lib/event-repository";
import { Avatar } from "./ds";

const shortDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

export function PostEventClickCard({ prompt }: { prompt: PostEventClickPrompt }) {
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);
  if (clickable.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <p className="text-xs font-semibold text-[color:var(--slate)]">
        You were there · {shortDate.format(new Date(prompt.endedAt))}
      </p>
      <h3 className="font-display mt-1.5 text-[1.3rem] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
        Did you click with anyone at{" "}
        <Link href={`/events/${prompt.eventSlug}`} className="text-[color:var(--purple)] hover:underline">
          {prompt.eventTitle}
        </Link>
        ?
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--slate)]">
        Tap anyone you&apos;d like to see again. It&apos;s completely private - they only ever hear about it if they
        click you back.
      </p>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {clickable.map((person) => {
          const firstName = person.displayName.split(" ")[0];
          return (
            <li
              key={person.id}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-3"
            >
              <Avatar name={person.displayName} size={40} />
              <Link
                href={`/profile/${person.id}`}
                className="font-display min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--ink)] hover:underline"
              >
                {firstName}
              </Link>
              <form action={clickCoAttendeeAction}>
                <input type="hidden" name="profile_id" value={person.id} />
                <input type="hidden" name="source_event" value={prompt.eventSlug} />
                <button type="submit" className="ck-btn ck-btn--sm ck-btn--primary shrink-0">
                  <span className="ck-btn__label">click with {firstName}</span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
