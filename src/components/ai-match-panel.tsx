"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  animatedPrompts,
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
};

export function AIMatchPanel({
  defaultPrompt = starterPrompts[0],
  showEvents = true,
  title = "Click conversation",
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
      <section className="mx-auto w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.45rem] border-4 border-white bg-[#FFFCF9] text-left text-[#340068] shadow-[14px_14px_0_#B1EDE8] sm:max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#340068] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#FF6978]" />
            <span className="size-3 rounded-full bg-[#FFD166]" />
            <span className="size-3 rounded-full bg-[#B1EDE8]" />
          </div>
          <span className="hidden text-xs font-black uppercase tracking-[0.18em] text-[#340068]/45 sm:block">
            {title}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <label htmlFor="click-ai-search" className="sr-only">
            Tell Click what people you want to meet
          </label>
          <textarea
            id="click-ai-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitPrompt();
              }
            }}
            className="min-h-44 w-full resize-none rounded-2xl border-2 border-[#340068] bg-white px-5 py-4 text-base font-bold leading-7 outline-none placeholder:text-[#340068]/35 focus:border-[#FF6978] sm:min-h-52 sm:text-lg sm:leading-8"
            placeholder={animatedPlaceholder ? `${animatedPlaceholder}|` : ""}
          />
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-full flex-wrap gap-2 overflow-hidden pb-1 lg:pb-0">
              {starterPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => submitPrompt(prompt)}
                  className="max-w-full rounded-full border-2 border-[#340068] bg-white px-4 py-2 text-left text-xs font-black text-[#340068]/68 hover:bg-[#B1EDE8]"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="min-h-12 shrink-0 rounded-full bg-[#FF6978] px-6 text-sm font-black text-[#340068] shadow-[4px_4px_0_#340068]"
            >
              Match me
            </button>
          </div>
        </form>
      </section>

      <div className="mx-auto mt-8 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B1EDE8]">
              AI recommendations
            </p>
            <h2 className="mt-2 font-display text-4xl font-black leading-none">
              People cards worth meeting.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="aqua">Mode: {detectedCategory === "All" ? "Friendship" : detectedCategory}</Pill>
            <Pill>Query: {submittedQuery}</Pill>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {recommendedPeople.map((person) => {
            const event = events.find((item) => item.id === person.nextEventId);
            const connected = connectedPeople.includes(person.id);
            const joined = event ? joinedEvents.includes(event.id) : false;

            return (
              <article
                key={person.id}
                className="rounded-lg border-4 border-white bg-[#FFFCF9] p-5 text-[#340068] shadow-[8px_8px_0_#6D435A]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-14 place-items-center rounded-full border-4 border-[#340068] ${person.accent} font-black shadow-[4px_4px_0_#340068]`}
                    >
                      {person.initials}
                    </span>
                    <div>
                      <h3 className="font-display text-3xl font-black leading-none">
                        {person.name}
                      </h3>
                      <p className="mt-1 text-sm font-black text-[#340068]/52">
                        {person.neighborhood} - {person.intent}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border-2 border-[#340068] bg-white px-3 py-1 text-xs font-black">
                    AI pick
                  </span>
                </div>
                <p className="mt-4 text-sm font-bold leading-6 text-[#340068]/68">
                  {person.bio}
                </p>
                <p className="mt-3 rounded-lg border-2 border-[#340068] bg-white p-3 text-sm font-black leading-6">
                  {person.matchReason}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {person.tags.slice(0, 4).map((tag) => (
                    <Pill key={tag}>{tag}</Pill>
                  ))}
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => connectWithPerson(person.id)}
                    className="rounded-full bg-[#FF6978] px-4 py-3 text-sm font-black text-[#340068] shadow-[4px_4px_0_#340068]"
                  >
                    {connected ? "Clicked privately" : "Click with them"}
                  </button>
                  {event ? (
                    <button
                      type="button"
                      onClick={() => joinEvent(event.id)}
                      className="rounded-full border-2 border-[#340068] bg-white px-4 py-3 text-sm font-black"
                    >
                      {joined ? "Event joined" : "Join event"}
                    </button>
                  ) : null}
                </div>
                {event ? (
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[#340068]/45">
                    Suggested event: {event.title}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        {showEvents ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {rankedEvents.slice(0, 2).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
