import Link from "next/link";
import type { SuggestedPerson } from "@/lib/event-repository";

export function ClickRadar({ people }: { people: SuggestedPerson[] }) {
  const top = people.slice(0, 4);
  return (
    <aside className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--ink)] p-5 text-[color:var(--on-deep)] hard-shadow">
      <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
        Click Radar
      </span>
      <h3 className="font-display mt-3 text-2xl font-light leading-tight">
        People with overlapping tags.
      </h3>
      <p className="mt-2 text-sm font-medium leading-6 opacity-80">
        Quietly suggested. Nothing happens unless you both Click.
      </p>
      {top.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {top.map((person) => (
            <li
              key={person.id}
              className="rounded-2xl border-2 border-[color:var(--peach)] bg-[color:var(--surface-deep)] p-3"
            >
              <Link
                href={`/profile/${person.id}`}
                className="block text-sm font-bold text-[color:var(--on-deep)] hover:text-[color:var(--peach)]"
              >
                {person.displayName}
              </Link>
              <p className="mt-1 text-xs font-medium text-[color:var(--peach)]">
                {person.suburb ?? "Sydney"}
                {person.sharedInterests.length > 0
                  ? ` · ${person.sharedInterests.slice(0, 2).join(", ")}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border-2 border-dashed border-[color:var(--peach)] p-3 text-xs font-medium opacity-80">
          Pick a few interests in onboarding to light up your radar.
        </p>
      )}
    </aside>
  );
}
