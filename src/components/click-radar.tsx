"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pill } from "@/components/click-ui";
import type { PeopleSuggestion } from "@/lib/event-repository";

export function ClickRadar({
  initial,
}: {
  initial: PeopleSuggestion[];
}) {
  const router = useRouter();
  const [people, setPeople] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function sendClick(person: PeopleSuggestion) {
    if (person.hasClicked || person.isMutual) return;
    setPendingId(person.profileId);

    try {
      const response = await fetch("/api/clicks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickedProfileId: person.profileId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Couldn't send Click.");
        return;
      }

      const isMutual = data.click?.status === "mutual";
      setPeople((current) =>
        current.map((entry) =>
          entry.profileId === person.profileId
            ? { ...entry, hasClicked: true, isMutual }
            : entry,
        ),
      );

      if (isMutual) {
        toast.success("Mutual Click! We'll suggest an event for you both.");
      } else {
        toast.success("Click sent.");
      }
      startTransition(() => router.refresh());
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  const mutualCount = people.filter((p) => p.isMutual).length;

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-8 text-center">
        <p className="font-display text-3xl font-light leading-tight">
          Your radar is quiet.
        </p>
        <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
          Attend a few events and add interest tags — we&apos;ll surface people you&apos;ve shared a room with.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mutualCount > 0 ? (
        <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--ink)] p-5 text-[color:var(--on-deep)] hard-shadow-sm">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
            Mutual Clicks
          </p>
          <p className="mt-2 font-display text-3xl font-light italic leading-tight">
            {mutualCount} match{mutualCount === 1 ? "" : "es"} unlocked.
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--on-deep)]/72">
            We&apos;ll surface a future event for each pair on your dashboard.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-5 sm:grid-cols-2">
        {people.map((person) => {
          const isBusy = pendingId === person.profileId;
          const buttonLabel = person.isMutual
            ? "Mutual ✷"
            : person.hasClicked
              ? "Click sent"
              : isBusy
                ? "Sending…"
                : "Click";

          return (
            <li
              key={person.profileId}
              className="flex flex-col gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/profile/${person.profileId}`}
                    className="font-display text-2xl font-light leading-tight text-[color:var(--ink)] underline-offset-4 hover:underline"
                  >
                    {person.displayName}
                  </Link>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    {person.suburb ?? "Sydney"}
                  </p>
                </div>
                {person.isMutual ? <Pill tone="rose">Mutual</Pill> : null}
              </div>

              {person.bio ? (
                <p className="text-sm font-medium leading-6 text-[color:var(--mauve)] line-clamp-3">
                  {person.bio}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {person.intents.slice(0, 3).map((intent) => (
                  <Pill key={`${person.profileId}-${intent}`} tone="cream">
                    {intent}
                  </Pill>
                ))}
              </div>

              <div className="space-y-1 text-xs font-semibold text-[color:var(--mauve)]">
                {person.sharedTags.length > 0 ? (
                  <p>
                    <span className="font-mono uppercase tracking-[0.18em] text-[color:var(--rose)]">
                      shared interests:
                    </span>{" "}
                    {person.sharedTags.slice(0, 4).join(" · ")}
                  </p>
                ) : null}
                {person.sharedEventIds.length > 0 ? (
                  <p>
                    <span className="font-mono uppercase tracking-[0.18em] text-[color:var(--rose)]">
                      shared rooms:
                    </span>{" "}
                    {person.sharedEventIds.length} event{person.sharedEventIds.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => sendClick(person)}
                disabled={person.hasClicked || person.isMutual || isBusy}
                className={
                  person.isMutual
                    ? "mt-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--surface-deep)]"
                    : person.hasClicked
                      ? "mt-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]"
                      : "mt-auto rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--champagne)] hover:bg-[color:var(--ink-deep)] disabled:opacity-60"
                }
              >
                {buttonLabel}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
