"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type EventStatus = "Live" | "Pending" | "Featured";

type EventItem = {
  id: string;
  title: string;
  group: string;
  host: string;
  category: string;
  date: string;
  time: string;
  location: string;
  price: string;
  attendees: number;
  capacity: number;
  image: string;
  imageAlt: string;
  description: string;
  tags: string[];
  status: EventStatus;
  relationshipGoal: string;
};

type PeopleRecommendation = {
  id: string;
  name: string;
  initials: string;
  neighborhood: string;
  intent: string;
  bio: string;
  tags: string[];
  matchReason: string;
  nextEventId: string;
  accent: string;
};

type MemberForm = {
  name: string;
  email: string;
  city: string;
  goal: string;
  interests: string;
};

type CreatorForm = {
  title: string;
  group: string;
  category: string;
  date: string;
  time: string;
  location: string;
  capacity: string;
  price: string;
  description: string;
};

const animatedPrompts = [
  "I want to meet new friends in Newtown",
  "Find people for weekend coffee in Surry Hills",
  "I just moved to Marrickville and want a social group",
  "Show me low-pressure dinners in Bondi",
  "I want a fitness friend around Redfern",
  "Help me meet creative people in Glebe",
  "Find a walking group near Barangaroo",
  "I want to make friends in Parramatta",
];

const starterPrompts = animatedPrompts.slice(0, 4);

const categories = [
  "All",
  "Social Activities",
  "Sports and Fitness",
  "Relationships",
  "New to Sydney",
  "Food and Drink",
  "Hobbies and Passions",
  "Career and Business",
];

const baseEvents: EventItem[] = [
  {
    id: "new-friends-barangaroo",
    title: "New Friends Picnic at Barangaroo",
    group: "Sydney First-Timers Social Club",
    host: "Maya Chen",
    category: "Social Activities",
    date: "Fri, May 8",
    time: "6:30 PM",
    location: "Barangaroo Reserve, Sydney",
    price: "Free",
    attendees: 47,
    capacity: 60,
    image: "/media/open-yoga.jpg",
    imageAlt: "People gathering outdoors in a community class",
    description:
      "A relaxed picnic for people who want easy conversation, shared snacks, and a few familiar faces for the next event.",
    tags: ["friends", "sydney", "new to town", "weekend", "low pressure"],
    status: "Featured",
    relationshipGoal: "Make two familiar faces before the next weekend.",
  },
  {
    id: "crossfit-coffee",
    title: "CrossFit Skills and Coffee Crew",
    group: "Inner West Fitness Mates",
    host: "Theo Morgan",
    category: "Sports and Fitness",
    date: "Sat, May 9",
    time: "8:00 AM",
    location: "Marrickville Training Yard",
    price: "$12",
    attendees: 24,
    capacity: 32,
    image: "/media/yoga.jpg",
    imageAlt: "People training together in a group fitness class",
    description:
      "Technique-focused partner drills, scalable workouts, and post-session coffee for people who want consistency without gym cliques.",
    tags: ["crossfit", "fitness", "training", "coffee", "accountability"],
    status: "Live",
    relationshipGoal: "Find a fitness partner for a four-week streak.",
  },
  {
    id: "slow-dating-six",
    title: "Slow Dating: Dinner Tables of Six",
    group: "Real Conversations Sydney",
    host: "Amelia Hart",
    category: "Relationships",
    date: "Thu, May 14",
    time: "7:00 PM",
    location: "Surry Hills",
    price: "$29",
    attendees: 36,
    capacity: 42,
    image: "/media/networking.jpg",
    imageAlt: "People talking together at a social gathering",
    description:
      "Hosted dinner tables where singles meet through small-group conversation first, with private mutual interest after the event.",
    tags: ["dating", "relationships", "dinner", "surry hills", "low pressure"],
    status: "Live",
    relationshipGoal: "Meet people through conversation before matching.",
  },
  {
    id: "ordinary-creatives",
    title: "Creative Brunch for Ordinary People",
    group: "Ordinary People Making Things",
    host: "Noah Singh",
    category: "Hobbies and Passions",
    date: "Sun, May 17",
    time: "10:30 AM",
    location: "Newtown Community Hall",
    price: "$18",
    attendees: 53,
    capacity: 70,
    image: "/media/concert.jpg",
    imageAlt: "Crowd at a warm local music event",
    description:
      "A no-status brunch for writers, designers, builders, makers, and anyone who wants a recurring community around doing real things.",
    tags: ["creative", "brunch", "newtown", "friends", "community"],
    status: "Featured",
    relationshipGoal: "Turn a hobby into a recurring group.",
  },
  {
    id: "career-walk",
    title: "Career Change Walk and Talk",
    group: "Sydney Career Switchers",
    host: "Priya Nair",
    category: "Career and Business",
    date: "Wed, May 20",
    time: "6:00 PM",
    location: "Circular Quay to The Rocks",
    price: "Free",
    attendees: 31,
    capacity: 45,
    image: "/media/networking.jpg",
    imageAlt: "People talking at a community meetup",
    description:
      "A walking meetup for people changing careers, building confidence, and looking for peers rather than formal networking.",
    tags: ["career", "confidence", "walk", "networking", "support"],
    status: "Live",
    relationshipGoal: "Meet peers who understand the same career transition.",
  },
];

const groups = [
  {
    name: "Sydney First-Timers Social Club",
    members: "8,420",
    category: "Social Activities",
    focus: "Making friends after moving, breakups, new jobs, or fresh starts.",
    accent: "bg-[#B1EDE8]",
  },
  {
    name: "Inner West Fitness Mates",
    members: "3,180",
    category: "Sports and Fitness",
    focus: "CrossFit, running, climbing, and accountability partners.",
    accent: "bg-[#B1EDE8]",
  },
  {
    name: "Real Conversations Sydney",
    members: "5,930",
    category: "Relationships",
    focus: "Relationship-minded dinners, walks, workshops, and quiet socials.",
    accent: "bg-[#FF6978]",
  },
  {
    name: "Ordinary People Making Things",
    members: "2,760",
    category: "Hobbies and Passions",
    focus: "Creative hobbies, brunches, accountability circles, and local showcases.",
    accent: "bg-[#B1EDE8]",
  },
];

const peopleCards: PeopleRecommendation[] = [
  {
    id: "maya",
    name: "Maya",
    initials: "MC",
    neighborhood: "Barangaroo",
    intent: "New friends",
    bio: "Moved back to Sydney and wants a reliable weekend circle for picnics, walks, and easy conversation.",
    tags: ["friends", "sydney", "new to town", "weekend", "low pressure"],
    matchReason: "Good first match for relaxed social plans and recurring friendship groups.",
    nextEventId: "new-friends-barangaroo",
    accent: "bg-[#B1EDE8]",
  },
  {
    id: "theo",
    name: "Theo",
    initials: "TM",
    neighborhood: "Marrickville",
    intent: "Fitness partner",
    bio: "Training for consistency, not ego. Likes scalable CrossFit sessions and coffee after class.",
    tags: ["crossfit", "fitness", "training", "coffee", "accountability"],
    matchReason: "Best match for getting better at CrossFit without joining a clique.",
    nextEventId: "crossfit-coffee",
    accent: "bg-[#B1EDE8]",
  },
  {
    id: "amelia",
    name: "Amelia",
    initials: "AH",
    neighborhood: "Surry Hills",
    intent: "Relationship-minded",
    bio: "Prefers hosted dinners, small tables, and dating events that start with real conversation.",
    tags: ["dating", "relationships", "dinner", "surry hills", "low pressure"],
    matchReason: "Strong fit for relationship events with structure and no awkward pressure.",
    nextEventId: "slow-dating-six",
    accent: "bg-[#FF6978]",
  },
  {
    id: "noah",
    name: "Noah",
    initials: "NS",
    neighborhood: "Newtown",
    intent: "Creative circle",
    bio: "Wants ordinary makers around a table: sketchbooks, side projects, brunch, and accountability.",
    tags: ["creative", "brunch", "newtown", "friends", "community"],
    matchReason: "Useful match for hobbies, making things, and becoming familiar through repetition.",
    nextEventId: "ordinary-creatives",
    accent: "bg-[#B1EDE8]",
  },
  {
    id: "priya",
    name: "Priya",
    initials: "PN",
    neighborhood: "The Rocks",
    intent: "Career support",
    bio: "Changing industries and looking for peers who want practical encouragement, not stiff networking.",
    tags: ["career", "confidence", "walk", "networking", "support"],
    matchReason: "Right fit for career-change support and walking conversations.",
    nextEventId: "career-walk",
    accent: "bg-[#6D435A]",
  },
];

const communityWays = [
  {
    title: "Friendship",
    body: "Low-pressure tables, walks, brunches, and recurring events where first-timers are expected.",
  },
  {
    title: "Relationships",
    body: "Hosted singles gatherings that start with shared activity instead of swipe-style judgement.",
  },
  {
    title: "Momentum",
    body: "Fitness, creative, and career groups that turn intention into people you see again.",
  },
];

const imageByCategory: Record<string, string> = {
  "Social Activities": "/media/open-yoga.jpg",
  "Sports and Fitness": "/media/yoga.jpg",
  Relationships: "/media/networking.jpg",
  "New to Sydney": "/media/open-yoga.jpg",
  "Food and Drink": "/media/concert.jpg",
  "Hobbies and Passions": "/media/concert.jpg",
  "Career and Business": "/media/networking.jpg",
};

const queryStopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "want",
  "make",
  "meet",
  "around",
  "near",
  "here",
  "that",
  "this",
  "what",
  "kind",
]);

function queryTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2 && !queryStopWords.has(term));
}

function scoreEvent(event: EventItem, query: string) {
  const terms = queryTerms(query);
  const haystack = [
    event.title,
    event.group,
    event.category,
    event.location,
    event.description,
    event.relationshipGoal,
    ...event.tags,
  ]
    .join(" ")
    .toLowerCase();

  const exactMatches = terms.filter((term) => haystack.includes(term)).length;
  const friendBoost =
    terms.some((term) =>
      ["friend", "friends", "people", "lonely", "new", "mate", "mates"].includes(term),
    ) && event.tags.some((tag) => ["friends", "community", "new to town"].includes(tag))
      ? 3
      : 0;
  const fitnessBoost =
    terms.some((term) =>
      ["crossfit", "fitness", "gym", "workout", "training", "strong"].includes(term),
    ) && event.category === "Sports and Fitness"
      ? 4
      : 0;
  const relationshipBoost =
    terms.some((term) =>
      ["date", "dating", "relationship", "relationships", "single", "singles"].includes(term),
    ) && event.category === "Relationships"
      ? 4
      : 0;
  const momentum = event.attendees / event.capacity;

  return exactMatches + friendBoost + fitnessBoost + relationshipBoost + momentum;
}

function scorePerson(person: PeopleRecommendation, query: string) {
  const terms = queryTerms(query);
  const haystack = [
    person.name,
    person.neighborhood,
    person.intent,
    person.bio,
    person.matchReason,
    ...person.tags,
  ]
    .join(" ")
    .toLowerCase();

  const exactMatches = terms.filter((term) => haystack.includes(term)).length;
  const friendBoost =
    terms.some((term) =>
      ["friend", "friends", "people", "lonely", "new", "mate", "mates"].includes(term),
    ) && person.tags.some((tag) => ["friends", "community", "new to town"].includes(tag))
      ? 4
      : 0;
  const fitnessBoost =
    terms.some((term) =>
      ["crossfit", "fitness", "gym", "workout", "training", "strong"].includes(term),
    ) && person.tags.includes("crossfit")
      ? 5
      : 0;
  const relationshipBoost =
    terms.some((term) =>
      ["date", "dating", "relationship", "relationships", "single", "singles"].includes(term),
    ) && person.tags.includes("relationships")
      ? 5
      : 0;

  return exactMatches + friendBoost + fitnessBoost + relationshipBoost;
}

function categoryFromPrompt(prompt: string) {
  const lower = prompt.toLowerCase();

  if (lower.includes("crossfit") || lower.includes("fitness")) return "Sports and Fitness";
  if (lower.includes("dating") || lower.includes("relationship")) return "Relationships";
  if (lower.includes("new")) return "New to Sydney";
  if (lower.includes("career") || lower.includes("business")) return "Career and Business";
  return "All";
}

function formatCapacity(event: EventItem) {
  const remaining = Math.max(event.capacity - event.attendees, 0);
  return remaining === 0 ? "Waitlist open" : `${remaining} spots left`;
}

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>(baseEvents);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState(starterPrompts[0]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeEventId, setActiveEventId] = useState(baseEvents[0].id);
  const [savedEvents, setSavedEvents] = useState<string[]>(["new-friends-barangaroo"]);
  const [joinedEvents, setJoinedEvents] = useState<string[]>([]);
  const [connectedPeople, setConnectedPeople] = useState<string[]>([]);
  const [memberSubmitted, setMemberSubmitted] = useState(false);
  const [creatorNotice, setCreatorNotice] = useState("");
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState(animatedPrompts[0]);
  const [memberForm, setMemberForm] = useState<MemberForm>({
    name: "",
    email: "",
    city: "Sydney",
    goal: "Make new friends",
    interests: "brunch, fitness, low pressure events",
  });
  const [creatorForm, setCreatorForm] = useState<CreatorForm>({
    title: "Board Games for New Locals",
    group: "Sydney Tabletop Friends",
    category: "Social Activities",
    date: "2026-05-22",
    time: "18:30",
    location: "Redfern Community Centre",
    capacity: "28",
    price: "Free",
    description:
      "A hosted board game night for people who want simple activities and easy conversation.",
  });

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
        (left, right) =>
          scoreEvent(right, submittedQuery) - scoreEvent(left, submittedQuery),
      ),
    [events, submittedQuery],
  );

  const visibleEvents = useMemo(
    () =>
      rankedEvents.filter(
        (event) => selectedCategory === "All" || event.category === selectedCategory,
      ),
    [rankedEvents, selectedCategory],
  );

  const recommendedPeople = useMemo(
    () =>
      [...peopleCards]
        .sort(
          (left, right) =>
            scorePerson(right, submittedQuery) - scorePerson(left, submittedQuery),
        )
        .slice(0, 3),
    [submittedQuery],
  );

  const activeEvent =
    events.find((event) => event.id === activeEventId) ?? visibleEvents[0] ?? events[0];

  const adminStats = useMemo(() => {
    const totalAttendees = events.reduce((sum, event) => sum + event.attendees, 0);
    const totalCapacity = events.reduce((sum, event) => sum + event.capacity, 0);
    const pending = events.filter((event) => event.status === "Pending").length;
    const featured = events.filter((event) => event.status === "Featured").length;

    return {
      totalEvents: events.length,
      totalAttendees,
      fillRate: Math.round((totalAttendees / totalCapacity) * 100),
      pending,
      featured,
    };
  }, [events]);

  function submitChat(nextQuery = query) {
    const cleanQuery = nextQuery.trim() || starterPrompts[0];

    const matches = [...events].sort(
      (left, right) => scoreEvent(right, cleanQuery) - scoreEvent(left, cleanQuery),
    );

    setSubmittedQuery(cleanQuery);
    setSelectedCategory(categoryFromPrompt(cleanQuery));
    setQuery(cleanQuery);
    setActiveEventId(matches[0]?.id ?? activeEventId);
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitChat();
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

  function connectWithPerson(personId: string) {
    if (connectedPeople.includes(personId)) return;
    setConnectedPeople((current) => [...current, personId]);
  }

  function handleMemberSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberSubmitted(true);
  }

  function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const category = creatorForm.category;
    const newEvent: EventItem = {
      id: `creator-${Date.now()}`,
      title: creatorForm.title,
      group: creatorForm.group,
      host: "Creator account",
      category,
      date: creatorForm.date || "Date pending",
      time: creatorForm.time || "Time pending",
      location: creatorForm.location,
      price: creatorForm.price,
      attendees: 0,
      capacity: Math.max(Number.parseInt(creatorForm.capacity, 10) || 20, 1),
      image: imageByCategory[category] ?? "/media/open-yoga.jpg",
      imageAlt: "Community event placeholder",
      description: creatorForm.description,
      tags: [
        category.toLowerCase(),
        "creator event",
        "sydney",
        ...creatorForm.title.toLowerCase().split(/\W+/).filter(Boolean).slice(0, 3),
      ],
      status: "Pending",
      relationshipGoal: "Help attendees meet through a hosted activity.",
    };

    setEvents((current) => [newEvent, ...current]);
    setActiveEventId(newEvent.id);
    setSelectedCategory("All");
    setCreatorNotice(`${newEvent.title} was added as pending review.`);
  }

  function approveEvent(eventId: string) {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, status: "Live" } : event,
      ),
    );
  }

  return (
    <main className="min-h-screen max-w-full overflow-hidden bg-[#FFFCF9] text-[#340068]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#FFFCF9]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="#home" className="group flex items-center gap-3" aria-label="Click home">
            <span className="grid size-10 place-items-center rounded-full bg-[#FF6978] text-lg font-black text-[#340068] shadow-[4px_4px_0_#340068]">
              C
            </span>
            <span className="font-display text-3xl font-black tracking-normal text-[#340068]">
              Click
            </span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-black text-black/58 lg:flex">
            <a href="#events" className="hover:text-black">
              Events
            </a>
            <a href="#groups" className="hover:text-black">
              Groups
            </a>
            <a href="#relationships" className="hover:text-black">
              Relationships
            </a>
            <a href="#create" className="hover:text-black">
              Host
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="#signup"
              className="hidden rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-black shadow-[2px_2px_0_#340068] sm:block"
            >
              Join
            </a>
            <a
              href="#guide"
              className="rounded-full bg-[#340068] px-4 py-2 text-sm font-black text-white shadow-[2px_2px_0_#B1EDE8]"
            >
              Ask Click
            </a>
          </div>
        </div>
      </header>

      <section id="home" className="brand-gradient fit-viewport relative overflow-hidden px-4 py-10 text-white sm:px-6">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="mobile-home-shell relative z-10 mx-auto max-w-7xl">
          <p className="mx-auto max-w-[300px] text-center text-xs font-black uppercase tracking-[0.18em] text-[#B1EDE8] sm:max-w-none sm:text-sm">
            AI people matching for Sydney
          </p>

          <section
            id="guide"
            className="mx-auto mt-4 w-full max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.5rem] border-4 border-white bg-[#FFFCF9] text-left text-[#340068] shadow-[14px_14px_0_#B1EDE8] sm:max-w-6xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#340068] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-[#FF6978]" />
                <span className="size-3 rounded-full bg-[#B1EDE8]" />
                <span className="size-3 rounded-full bg-[#B1EDE8]" />
              </div>
              <span className="hidden text-xs font-black uppercase tracking-[0.18em] text-black/45 sm:block">
                Click conversation
              </span>
            </div>

            <form onSubmit={handleChatSubmit} className="p-4">
              <label htmlFor="event-search" className="sr-only">
                Search events or describe yourself
              </label>
              <textarea
                id="event-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitChat();
                  }
                }}
                className="min-h-44 w-full resize-none rounded-2xl border-2 border-[#340068] bg-white px-5 py-4 text-base font-bold leading-7 outline-none placeholder:text-black/35 focus:border-[#FF6978] sm:min-h-52 sm:text-lg sm:leading-8"
                placeholder={animatedPlaceholder ? `${animatedPlaceholder}|` : ""}
              />
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex max-w-full flex-wrap gap-2 overflow-hidden pb-1 lg:pb-0">
                  {starterPrompts.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => submitChat(prompt)}
                      className="max-w-full rounded-full border-2 border-[#340068] bg-white px-4 py-2 text-left text-xs font-black text-black/68 hover:bg-[#B1EDE8]"
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

          <div className="mt-8 grid gap-4 text-white lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <h1 className="font-display text-4xl font-black leading-none sm:text-5xl">
              People cards worth meeting.
            </h1>
            <p className="max-w-2xl text-base font-bold leading-7 text-white/70 lg:justify-self-end">
              Click turns the chat into nearby people, shared interests, and a
              suggested event so there is a natural reason to connect.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {recommendedPeople.map((person) => {
              const event = events.find((item) => item.id === person.nextEventId);
              const connected = connectedPeople.includes(person.id);
              const joined = event ? joinedEvents.includes(event.id) : false;

              return (
                <article
                  key={person.id}
                  className="rounded-[1.2rem] border-4 border-white bg-[#FFFCF9] p-5 text-[#340068] shadow-[8px_8px_0_#6D435A]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-14 place-items-center rounded-full border-4 border-[#340068] ${person.accent} font-black shadow-[4px_4px_0_#340068]`}
                      >
                        {person.initials}
                      </span>
                      <div>
                        <h2 className="font-display text-3xl font-black leading-none">
                          {person.name}
                        </h2>
                        <p className="mt-1 text-sm font-black text-black/52">
                          {person.neighborhood} - {person.intent}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border-2 border-[#340068] bg-white px-3 py-1 text-xs font-black">
                      AI pick
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-bold leading-6 text-black/68">
                    {person.bio}
                  </p>
                  <p className="mt-3 rounded-2xl border-2 border-[#340068] bg-white p-3 text-sm font-black leading-6">
                    {person.matchReason}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {person.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-black/12 bg-[#FFFCF9] px-3 py-1 text-xs font-black text-black/62"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => connectWithPerson(person.id)}
                      className="rounded-full bg-[#FF6978] px-4 py-3 text-sm font-black text-[#340068] shadow-[4px_4px_0_#340068]"
                    >
                      {connected ? "Requested" : "Connect"}
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
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-black/45">
                      Suggested event: {event.title}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y-4 border-[#340068] bg-[#B1EDE8]">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-5 sm:px-6">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 rounded-full border-2 border-[#340068] px-4 py-2 text-sm font-black shadow-[3px_3px_0_#340068] ${
                selectedCategory === category
                  ? "bg-[#340068] text-white"
                  : "bg-[#FFFCF9] text-black/70 hover:bg-white"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section id="events" className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FF6978]">
                Events near Sydney
              </p>
              <h2 className="mt-3 font-display text-5xl font-black leading-none text-[#340068] sm:text-6xl">
                The next good reason to leave the house.
              </h2>
            </div>
            <p className="text-base font-bold leading-7 text-black/62 lg:max-w-xl lg:justify-self-end">
              Based on:{" "}
              <span className="font-black text-black">
                &ldquo;{submittedQuery}&rdquo;
              </span>
            </p>
          </div>

          <div className="mt-10 grid gap-7 lg:grid-cols-[1fr_390px]">
            <div className="grid gap-6 md:grid-cols-2">
              {visibleEvents.map((event) => {
                const fullness = Math.min((event.attendees / event.capacity) * 100, 100);
                const saved = savedEvents.includes(event.id);
                const joined = joinedEvents.includes(event.id);

                return (
                  <article
                    key={event.id}
                    className="group overflow-hidden rounded-[1.35rem] border-4 border-[#340068] bg-white shadow-[8px_8px_0_#340068]"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveEventId(event.id)}
                      className="block w-full text-left"
                    >
                      <div className="relative h-56 overflow-hidden border-b-4 border-[#340068]">
                        <Image
                          src={event.image}
                          alt={event.imageAlt}
                          fill
                          sizes="(min-width: 1024px) 36vw, 100vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <span className="absolute left-3 top-3 rounded-full border-2 border-[#340068] bg-[#B1EDE8] px-3 py-2 text-xs font-black text-[#340068] shadow-[3px_3px_0_#340068]">
                          {event.status}
                        </span>
                      </div>
                    </button>
                    <div className="p-5">
                      <p className="text-sm font-black text-[#FF6978]">
                        {event.date} at {event.time}
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-black leading-[0.98]">
                        {event.title}
                      </h3>
                      <p className="mt-2 text-sm font-bold leading-6 text-black/58">
                        Hosted by {event.group}
                      </p>
                      <p className="mt-3 text-sm font-bold leading-6 text-black/68">
                        {event.description}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {event.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-black/12 bg-[#FFFCF9] px-3 py-1 text-xs font-black text-black/62"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5">
                        <div className="flex justify-between gap-4 text-xs font-black text-black/55">
                          <span>{event.location}</span>
                          <span>{formatCapacity(event)}</span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[#340068] bg-white">
                          <div
                            className="h-full rounded-full bg-[#B1EDE8]"
                            style={{ width: `${fullness}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => joinEvent(event.id)}
                          className="rounded-full bg-[#340068] px-4 py-3 text-sm font-black text-white"
                        >
                          {joined ? "Joined" : "Join"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSavedEvents((current) =>
                              saved
                                ? current.filter((id) => id !== event.id)
                                : [...current, event.id],
                            )
                          }
                          className="rounded-full border-2 border-[#340068] px-4 py-3 text-sm font-black"
                        >
                          {saved ? "Saved" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveEventId(event.id)}
                          className="rounded-full border-2 border-[#340068] px-4 py-3 text-sm font-black"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="brand-gradient-soft h-fit rounded-[1.35rem] border-4 border-[#340068] p-5 text-white shadow-[8px_8px_0_#B1EDE8] lg:sticky lg:top-24">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B1EDE8]">
                Current match
              </p>
              <h3 className="mt-3 font-display text-4xl font-black leading-none">
                {activeEvent.title}
              </h3>
              <p className="mt-4 text-sm font-bold leading-6 text-white/72">
                {activeEvent.description}
              </p>
              <div className="mt-5 grid gap-3 text-sm font-bold text-white/72">
                <p>{activeEvent.date} at {activeEvent.time}</p>
                <p>{activeEvent.location}</p>
                <p>Hosted by {activeEvent.host}</p>
                <p>
                  {activeEvent.attendees}/{activeEvent.capacity} people going
                </p>
                <p>{activeEvent.price}</p>
              </div>
              <div className="mt-5 rounded-2xl border-2 border-white/20 bg-white/[0.08] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/42">
                  Relationship goal
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-white/75">
                  {activeEvent.relationshipGoal}
                </p>
              </div>
              <button
                type="button"
                onClick={() => joinEvent(activeEvent.id)}
                className="mt-5 w-full rounded-full bg-[#FF6978] px-5 py-3 text-sm font-black text-[#340068] shadow-[4px_4px_0_#340068]"
              >
                {joinedEvents.includes(activeEvent.id) ? "You joined this event" : "Join this event"}
              </button>
            </aside>
          </div>
        </div>
      </section>

      <section id="groups" className="brand-gradient-soft py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B1EDE8]">
                Groups for common people
              </p>
              <h2 className="mt-3 font-display text-5xl font-black leading-none sm:text-6xl">
                Join once. Show up twice. Become familiar.
              </h2>
            </div>
            <p className="text-base font-bold leading-7 text-white/62 lg:max-w-xl lg:justify-self-end">
              Click favors recurring groups because relationships rarely start in a
              single perfect moment. They start when ordinary people keep crossing paths.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {groups.map((group) => (
              <article
                key={group.name}
                className="rounded-[1.2rem] border-4 border-white bg-[#FFFCF9] p-6 text-[#340068] shadow-[8px_8px_0_#6D435A]"
              >
                <span className={`block h-3 w-20 rounded-full ${group.accent}`} />
                <p className="mt-6 text-sm font-black text-[#340068]">
                  {group.members} members
                </p>
                <h3 className="mt-2 font-display text-3xl font-black leading-none">
                  {group.name}
                </h3>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-black/42">
                  {group.category}
                </p>
                <p className="mt-3 text-sm font-bold leading-6 text-black/64">
                  {group.focus}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="relationships" className="bg-[#FF6978] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#340068]">
              Relationships without the performance
            </p>
            <h2 className="mt-3 font-display text-5xl font-black leading-none text-[#340068] sm:text-6xl">
              Less profile theatre. More shared tables.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {communityWays.map((way) => (
              <article
                key={way.title}
                className="rounded-[1.2rem] border-4 border-[#340068] bg-[#FFFCF9] p-5 shadow-[7px_7px_0_#340068]"
              >
                <h3 className="font-display text-3xl font-black">{way.title}</h3>
                <p className="mt-3 text-sm font-bold leading-6 text-black/64">
                  {way.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="signup" className="bg-[#FFFCF9] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#340068]">
              Member profile
            </p>
            <h2 className="mt-3 font-display text-5xl font-black leading-none">
              Tell Click what should feel easier.
            </h2>
            <p className="mt-4 text-base font-bold leading-7 text-black/62">
              City, interests, and relationship goals become the inputs for event
              matching, group discovery, and repeat invitations.
            </p>
            {memberSubmitted ? (
              <div className="mt-6 rounded-2xl border-4 border-[#340068] bg-[#B1EDE8] p-5 shadow-[6px_6px_0_#340068]">
                <p className="text-sm font-black text-[#340068]">
                  Member profile ready for {memberForm.name || "new member"} in {memberForm.city}.
                </p>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleMemberSignup}
            className="grid gap-4 rounded-[1.35rem] border-4 border-[#340068] bg-white p-5 shadow-[8px_8px_0_#B1EDE8]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                Name
                <input
                  value={memberForm.name}
                  onChange={(event) =>
                    setMemberForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                  placeholder="Jordan Lee"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Email
                <input
                  value={memberForm.email}
                  onChange={(event) =>
                    setMemberForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                  placeholder="jordan@example.com"
                  type="email"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                City
                <input
                  value={memberForm.city}
                  onChange={(event) =>
                    setMemberForm((current) => ({ ...current, city: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Relationship goal
                <select
                  value={memberForm.goal}
                  onChange={(event) =>
                    setMemberForm((current) => ({ ...current, goal: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                >
                  <option>Make new friends</option>
                  <option>Find fitness partners</option>
                  <option>Meet relationship-minded singles</option>
                  <option>Build a creative circle</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black">
              Interests
              <textarea
                value={memberForm.interests}
                onChange={(event) =>
                  setMemberForm((current) => ({
                    ...current,
                    interests: event.target.value,
                  }))
                }
                className="min-h-24 rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
              />
            </label>
            <button
              type="submit"
              className="w-fit rounded-full bg-[#340068] px-6 py-3 text-sm font-black text-white shadow-[4px_4px_0_#340068]"
            >
              Create member profile
            </button>
          </form>
        </div>
      </section>

      <section id="create" className="bg-[#FFFCF9] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#FF6978]">
              Host a group
            </p>
            <h2 className="mt-3 font-display text-5xl font-black leading-none">
              Put a reason on the calendar.
            </h2>
            <p className="mt-4 text-base font-bold leading-7 text-black/62">
              Creators can add a local event, choose the audience, and send it to
              review before it joins the marketplace.
            </p>
            {creatorNotice ? (
              <div className="mt-6 rounded-2xl border-4 border-[#340068] bg-[#B1EDE8] p-5 shadow-[6px_6px_0_#340068]">
                <p className="text-sm font-black text-[#340068]">{creatorNotice}</p>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleCreateEvent}
            className="grid gap-4 rounded-[1.35rem] border-4 border-[#340068] bg-white p-5 shadow-[8px_8px_0_#FF6978]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                Event title
                <input
                  value={creatorForm.title}
                  onChange={(event) =>
                    setCreatorForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Group
                <input
                  value={creatorForm.group}
                  onChange={(event) =>
                    setCreatorForm((current) => ({ ...current, group: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-black">
                Category
                <select
                  value={creatorForm.category}
                  onChange={(event) =>
                    setCreatorForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                >
                  {categories.filter((category) => category !== "All").map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black">
                Date
                <input
                  value={creatorForm.date}
                  onChange={(event) =>
                    setCreatorForm((current) => ({ ...current, date: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                  type="date"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Time
                <input
                  value={creatorForm.time}
                  onChange={(event) =>
                    setCreatorForm((current) => ({ ...current, time: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                  type="time"
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-black md:col-span-2">
                Location
                <input
                  value={creatorForm.location}
                  onChange={(event) =>
                    setCreatorForm((current) => ({ ...current, location: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Capacity
                <input
                  value={creatorForm.capacity}
                  onChange={(event) =>
                    setCreatorForm((current) => ({ ...current, capacity: event.target.value }))
                  }
                  className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
                  inputMode="numeric"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black">
              Price
              <input
                value={creatorForm.price}
                onChange={(event) =>
                  setCreatorForm((current) => ({ ...current, price: event.target.value }))
                }
                className="rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              Description
              <textarea
                value={creatorForm.description}
                onChange={(event) =>
                  setCreatorForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="min-h-28 rounded-2xl border-2 border-[#340068] bg-white px-4 py-3 font-bold outline-none focus:border-[#FF6978]"
              />
            </label>
            <button
              type="submit"
              className="w-fit rounded-full bg-[#FF6978] px-6 py-3 text-sm font-black text-[#340068] shadow-[4px_4px_0_#340068]"
            >
              Submit event for review
            </button>
          </form>
        </div>
      </section>

      <section id="admin" className="bg-[#FFFCF9] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#340068]">
                Operator view
              </p>
              <h2 className="mt-3 font-display text-5xl font-black leading-none">
                Keep the room worth entering.
              </h2>
            </div>
            <p className="max-w-lg text-sm font-bold leading-6 text-black/60">
              Review pending events, spot momentum, and keep the marketplace focused
              on groups that help people meet again.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {[
              ["Events", adminStats.totalEvents.toLocaleString()],
              ["Attendees", adminStats.totalAttendees.toLocaleString()],
              ["Fill rate", `${adminStats.fillRate}%`],
              ["Pending", adminStats.pending.toLocaleString()],
              ["Featured", adminStats.featured.toLocaleString()],
            ].map(([label, value]) => (
              <article
                key={label}
                className="rounded-2xl border-4 border-[#340068] bg-white p-5 shadow-[5px_5px_0_#340068]"
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-black/42">
                  {label}
                </p>
                <p className="mt-2 font-display text-4xl font-black">{value}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 overflow-hidden rounded-[1.2rem] border-4 border-[#340068] bg-white shadow-[8px_8px_0_#340068]">
            <div className="hidden grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.8fr] gap-4 bg-[#340068] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white md:grid">
              <span>Event</span>
              <span>Category</span>
              <span>Status</span>
              <span>Going</span>
              <span>Action</span>
            </div>
            <div className="divide-y-4 divide-[#340068] bg-white">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-1 gap-3 px-4 py-4 text-sm font-bold text-black/68 md:grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_0.8fr] md:items-center"
                >
                  <span className="font-black text-black">{event.title}</span>
                  <span>{event.category}</span>
                  <span>{event.status}</span>
                  <span>
                    {event.attendees}/{event.capacity}
                  </span>
                  {event.status === "Pending" ? (
                    <button
                      type="button"
                      onClick={() => approveEvent(event.id)}
                      className="w-fit rounded-full bg-[#340068] px-4 py-2 text-xs font-black text-white"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveEventId(event.id)}
                      className="w-fit rounded-full border-2 border-[#340068] px-4 py-2 text-xs font-black text-black"
                    >
                      Inspect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="brand-gradient-soft text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <p className="font-display text-3xl font-black">Click</p>
            <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-white/60">
              A people platform for friendship, relationships, local groups, and
              shared-interest events.
            </p>
          </div>
          {[
            ["Discover", "Events", "Groups", "Interests"],
            ["Relationships", "Make friends", "Dating", "Fitness mates"],
            ["Platform", "Member profile", "Host a group", "Operator view"],
          ].map(([title, ...items]) => (
            <div key={title}>
              <p className="font-black">{title}</p>
              <div className="mt-3 grid gap-2 text-sm font-bold text-white/60">
                {items.map((item) => (
                  <a href="#events" key={item} className="hover:text-white">
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
