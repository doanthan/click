import Link from "next/link";
import { Pill } from "./click-ui";
import { clickPersonAction } from "@/app/people/actions";
import type { SuggestedPerson } from "@/lib/event-repository";

export function ClickWithSomeoneUserCard({ person }: { person: SuggestedPerson }) {
  const initials = person.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-bold text-[color:var(--surface-deep)]">
          {initials || "·"}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${person.id}`}
            className="font-display block truncate text-2xl font-light leading-tight text-[color:var(--ink)] hover:text-[color:var(--rose)]"
          >
            {person.displayName}
          </Link>
          <p className="mt-1 text-xs font-mono font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            {person.suburb ?? "Sydney"}
            {person.age ? ` · ${person.age}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {person.intents.slice(0, 3).map((intent) => (
          <Pill key={intent} tone="cream">{intent}</Pill>
        ))}
      </div>

      {person.sharedInterests.length > 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-3">
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            Shared interests
          </span>
          <p className="mt-1 text-sm font-bold text-[color:var(--ink)]">
            {person.sharedInterests.slice(0, 4).join(" · ")}
          </p>
        </div>
      ) : null}

      <form action={clickPersonAction} className="mt-5 flex items-center gap-3">
        <input type="hidden" name="profile_id" value={person.id} />
        <button
          type="submit"
          className="flex-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
        >
          Click privately
        </button>
        <Link
          href={`/profile/${person.id}`}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
        >
          View
        </Link>
      </form>
    </article>
  );
}
