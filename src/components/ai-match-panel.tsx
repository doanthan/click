"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  animatedPrompts,
  avatarFor,
  clickEvents,
  peopleCards,
  starterPrompts,
  type EventItem,
} from "@/lib/click-data";
import { categoryFromPrompt, scoreEvent, scorePerson } from "@/lib/click-matching";
import { EventCard } from "./event-card";
import { Pill } from "./click-ui";

type AIMatchPanelProps = {
  defaultPrompt?: string;
  showEvents?: boolean;
  title?: string;
  eventsEyebrow?: string;
  eventsTitle?: React.ReactNode;
  peopleEyebrow?: string;
  peopleTitle?: React.ReactNode;
};

export function AIMatchPanel({
  defaultPrompt = starterPrompts[0],
  showEvents = true,
  title = "Click conversation",
  eventsEyebrow = "Events near you",
  eventsTitle = "Plans that make the first hello easier.",
  peopleEyebrow = "People recommendations",
  peopleTitle,
}: AIMatchPanelProps) {
  const [events, setEvents] = useState<EventItem[]>(clickEvents);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState(defaultPrompt);
  const [connectedPeople, setConnectedPeople] = useState<string[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState(animatedPrompts[0]);

  useEffect(() => {
    let promptIndex = 0;
    let characterIndex = animatedPrompts[0].length;
    let deleting = true;
    let timeoutId: number;

    function tick() {
      const prompt = animatedPrompts[promptIndex];

      if (deleting) {
        characterIndex -= 1;
        setAnimatedPlaceholder(prompt.slice(0, Math.max(characterIndex, 0)));

        if (characterIndex <= 0) {
          deleting = false;
          promptIndex = (promptIndex + 1) % animatedPrompts.length;
          timeoutId = window.setTimeout(tick, 260);
          return;
        }
      } else {
        characterIndex += 1;
        setAnimatedPlaceholder(prompt.slice(0, characterIndex));

        if (characterIndex >= prompt.length) {
          deleting = true;
          timeoutId = window.setTimeout(tick, 1250);
          return;
        }
      }

      timeoutId = window.setTimeout(tick, deleting ? 34 : 58);
    }

    timeoutId = window.setTimeout(tick, 1250);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const rankedEvents = useMemo(
    () =>
      [...events].sort(
        (left, right) => scoreEvent(right, submittedQuery) - scoreEvent(left, submittedQuery),
      ),
    [events, submittedQuery],
  );

  const recommendedPeople = useMemo(
    () =>
      [...peopleCards]
        .sort(
          (left, right) => scorePerson(right, submittedQuery) - scorePerson(left, submittedQuery),
        )
        .slice(0, 3),
    [submittedQuery],
  );

  const detectedCategory = categoryFromPrompt(submittedQuery);

  function submitPrompt(nextQuery = query) {
    const cleanQuery = nextQuery.trim() || starterPrompts[0];
    setSubmittedQuery(cleanQuery);
    setQuery(cleanQuery);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt();
  }

  function connectWithPerson(personId: string) {
    if (connectedPeople.includes(personId)) return;
    setConnectedPeople((current) => [...current, personId]);
  }

  function joinEvent(eventId: string) {
    if (joinedEvents.includes(eventId)) return;

    setJoinedEvents((current) => [...current, eventId]);
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? { ...event, attendees: Math.min(event.attendees + 1, event.capacity) }
          : event,
      ),
    );
  }

  return (
    <div className="w-full">
      <section className="relative mx-auto w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-left text-[color:var(--ink)] hard-shadow sm:max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)]" />
            <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--punch)]" />
            <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)]" />
          </div>
          {title ? (
            <span className="font-mono hidden text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] sm:block">
              ✷ {title}
            </span>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5">
          <label htmlFor="click-search" className="sr-only">
            Find local people and events
          </label>
          <textarea
            id="click-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitPrompt();
              }
            }}
            className="font-display min-h-40 w-full resize-none rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4 text-2xl font-light italic leading-tight text-[color:var(--ink)] outline-none placeholder:text-[color:var(--mauve)]/55 focus:bg-[color:var(--cream)] sm:min-h-48 sm:text-3xl"
            placeholder={animatedPlaceholder ? `${animatedPlaceholder}|` : ""}
          />
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-full flex-wrap gap-2 overflow-hidden pb-1 lg:pb-0">
              {starterPrompts.map((prompt, index) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => submitPrompt(prompt)}
                  className={`max-w-full rounded-full border-2 border-[color:var(--line)] px-4 py-2 text-left text-xs font-bold hard-shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] ${
                    index % 2 === 0
                      ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                      : "bg-[color:var(--cream)] text-[color:var(--ink)]"
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="group/cta inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow hover:bg-[color:var(--ink)]"
            >
              Find my people
              <span aria-hidden className="inline-block transition-transform duration-300 group-hover/cta:translate-x-1">→</span>
            </button>
          </div>
        </form>
      </section>

      {showEvents ? (
        <div className="mx-auto mt-12 max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-3 text-[color:var(--ink)]">
            <div>
              <p className="eyebrow">{eventsEyebrow}</p>
              <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
                {eventsTitle}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="peach">Mode: {detectedCategory === "All" ? "Friendship" : detectedCategory}</Pill>
              <Pill tone="cream">Query: {submittedQuery}</Pill>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {rankedEvents.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mx-auto mt-12 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[color:var(--ink)]">
          <div>
            <p className="eyebrow">{peopleEyebrow}</p>
            <h2 className="font-display mt-2 text-4xl font-light leading-tight sm:text-5xl">
              {peopleTitle ?? (
                <>
                  People with a <em className="text-[color:var(--rose)]">shared reason</em> to show up.
                </>
              )}
            </h2>
          </div>
          {!showEvents ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="peach">Mode: {detectedCategory === "All" ? "Friendship" : detectedCategory}</Pill>
              <Pill tone="cream">Query: {submittedQuery}</Pill>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {recommendedPeople.map((person, idx) => {
            const event = events.find((item) => item.id === person.nextEventId);
            const connected = connectedPeople.includes(person.id);
            const joined = event ? joinedEvents.includes(event.id) : false;
            const accentBg = idx % 3 === 0 ? "bg-[color:var(--peach)]" : idx % 3 === 1 ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]" : "bg-[color:var(--cream)]";

            return (
              <article
                key={person.id}
                className="group relative rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 text-[color:var(--ink)] hard-shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.5deg] hover:[box-shadow:8px_8px_0_0_var(--shadow-ink)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[color:var(--line)] ${accentBg} font-display text-2xl font-light italic`}
                    >
                      <span aria-hidden className="absolute inset-0 grid place-items-center">
                        {person.initials}
                      </span>
                      <img
                        src={avatarFor(person)}
                        alt={`${person.name} portrait`}
                        loading="lazy"
                        className="relative z-10 h-full w-full object-cover"
                      />
                    </span>
                    <div>
                      <h3 className="font-display text-3xl font-light leading-tight">{person.name}</h3>
                      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                        {person.neighborhood} · {person.intent}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--surface-deep)]">
                    Good fit
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {person.bio}
                </p>
                <p className="mt-3 rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-3 text-sm font-bold leading-6">
                  ✷ {person.matchReason}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {person.tags.slice(0, 4).map((tag) => (
                    <Pill key={tag}>{tag}</Pill>
                  ))}
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => connectWithPerson(person.id)}
                    className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)]"
                  >
                    {connected ? "Clicked privately ✓" : "Click with them"}
                  </button>
                  {event ? (
                    <button
                      type="button"
                      onClick={() => joinEvent(event.id)}
                      className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)] hover:text-[color:var(--surface-deep)]"
                    >
                      {joined ? "Event joined ✓" : "Join event"}
                    </button>
                  ) : null}
                </div>
                {event ? (
                  <p className="font-mono mt-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    Suggested event: {event.title}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
