import Link from "next/link";
import { clickCoAttendeeAction } from "@/app/dashboard/actions";
import type { PostEventClickPrompt } from "@/lib/event-repository";

const shortDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

export function PostEventClickCard({ prompt }: { prompt: PostEventClickPrompt }) {
  const clickable = prompt.coAttendees.filter((p) => !p.alreadyClicked);
  if (clickable.length === 0) return null;

  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-5 hard-shadow-sm">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        You went to {shortDate.format(new Date(prompt.endedAt))}
      </p>
      <h3 className="font-display mt-2 text-2xl font-light leading-tight text-[color:var(--ink)]">
        Did you click with anyone at{" "}
        <Link href={`/events/${prompt.eventSlug}`} className="italic hover:text-[color:var(--rose)]">
          {prompt.eventTitle}
        </Link>
        ?
      </h3>
      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--ink)]/80">
        Tap anyone you&apos;d like to see again. It&apos;s completely private — they only find out if
        they click you back.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {clickable.map((person) => (
          <li
            key={person.id}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3"
          >
            <Link
              href={`/profile/${person.id}`}
              className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--ink)] hover:text-[color:var(--rose)]"
            >
              {person.displayName}
              {person.suburb ? (
                <span className="ml-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-[color:var(--mauve)]">
                  · {person.suburb}
                </span>
              ) : null}
            </Link>
            <form action={clickCoAttendeeAction}>
              <input type="hidden" name="profile_id" value={person.id} />
              <input type="hidden" name="source_event" value={prompt.eventSlug} />
              <button
                type="submit"
                className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
              >
                Click
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
