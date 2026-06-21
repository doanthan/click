"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Pill } from "./click-ui";
import { clickPersonAction } from "@/app/people/actions";
import type { SuggestedPerson } from "@/lib/event-repository";

export function ClickWithSomeoneUserCard({ person }: { person: SuggestedPerson }) {
  const [state, formAction, pending] = useActionState(clickPersonAction, null);

  const initials = person.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // "sent" persists across reloads via person.alreadyClicked (a pending click
  // already recorded server-side), and also flips immediately after a fresh
  // successful submit in this session.
  const sent = state?.ok === true || person.alreadyClicked;

  return (
    <article className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex items-start gap-4">
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photoUrl}
            alt={person.displayName}
            className="size-14 shrink-0 rounded-full border-2 border-[color:var(--line)] object-cover"
          />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-bold text-[color:var(--surface-deep)]">
            {initials || "·"}
          </div>
        )}
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

      <form action={formAction} className="mt-5 flex items-center gap-3">
        <input type="hidden" name="profile_id" value={person.id} />
        <button
          type="submit"
          disabled={pending || sent}
          className="flex-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[color:var(--rose)] disabled:hover:text-[color:var(--surface-deep)]"
        >
          {sent
            ? "Clicked privately ✓ — pending their Click"
            : pending
              ? "Sending…"
              : "Click privately"}
        </button>
        <Link
          href={`/profile/${person.id}`}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
        >
          View
        </Link>
      </form>

      {state && state.message ? (
        <p
          role="status"
          className={`mt-3 rounded-xl border-2 border-[color:var(--line)] px-3 py-2 text-xs font-bold leading-5 ${
            state.ok
              ? "bg-[color:var(--mint,#d7f0e0)] text-[color:var(--surface-deep)]"
              : "bg-[color:var(--cream)] text-[color:var(--mauve)]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
