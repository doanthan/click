"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

type IntentMode = "Dating" | "Friendship" | "Networking" | "Exploring";

type Persona = {
  socialEnergy: "Introvert" | "Ambivert" | "Extrovert";
  pace: "Relaxed" | "Balanced" | "Fast-moving";
  openness: "Cautious" | "Open" | "Ready";
  frequency: "Occasional" | "Regular" | "Enthusiastic";
  intentPrimary: IntentMode;
};

type EventItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  distanceKm: number;
  price: string;
  image: string;
  imageAlt: string;
  tags: string[];
  musicTags: string[];
  lifeComposition: Record<string, number>;
  attendeeInterests: string[];
  capacity: number;
  rsvps: number;
  saves: number;
  attendance: number;
  velocity6h: number;
  velocityAverage: number;
  availability: "Weekday evenings" | "Weekends" | "Both";
  startsInHours: number;
  clickedUsersAttending: number;
  smallGroup: boolean;
  highEnergy: boolean;
  leadsToClicks: boolean;
  intentBoosts: IntentMode[];
  conversion: {
    views: number;
    saves: number;
    rsvps: number;
    attendance: number;
  };
};

type PeopleCandidate = {
  id: string;
  alias: string;
  revealedName: string;
  distanceKm: number;
  tags: string[];
  lifeTags: string[];
  musicTags: string[];
  availability: "Weekday evenings" | "Weekends" | "Both";
  persona: Persona;
  intents: IntentMode[];
  sharedPastEvents: number;
  hasClickedViewer: boolean;
};

const intentModes: IntentMode[] = [
  "Friendship",
  "Dating",
  "Networking",
  "Exploring",
];

const modeTone: Record<IntentMode, string> = {
  Dating: "Warm matching, intimate events, and private mutual clicks.",
  Friendship: "Casual shared-interest discovery for people who love what you do.",
  Networking: "Professional overlap, learning events, and goal-aligned introductions.",
  Exploring: "Broad discovery while the engine keeps learning your intent mix.",
};

const currentUser = {
  tags: [
    "Yoga",
    "Live Jazz",
    "Startups",
    "Creative Workshops",
    "Food Markets",
    "Hiking",
    "Design",
  ],
  lifeTags: ["New to Town", "Wellness-Focused", "Creative Professional"],
  musicTags: ["Jazz", "Soul", "Indie"],
  availability: ["Weekday evenings", "Weekends"],
  radiusKm: 10,
  categoryHistory: {
    Wellness: 7,
    Music: 4,
    Business: 2,
    Food: 1,
    Outdoors: 3,
    Arts: 5,
  } as Record<string, number>,
  persona: {
    socialEnergy: "Ambivert",
    pace: "Balanced",
    openness: "Ready",
    frequency: "Regular",
    intentPrimary: "Friendship" as IntentMode,
  },
};

const events: EventItem[] = [
  {
    id: "jazz-rooftop",
    title: "Rooftop Jazz Night for New Locals",
    category: "Music",
    date: "Fri 19 Jun 2026",
    time: "7:30 PM",
    venue: "Paramount House Rooftop",
    city: "Surry Hills NSW",
    distanceKm: 2.4,
    price: "$34",
    image: "/media/concert.jpg",
    imageAlt: "Outdoor live band performance with crowd and stage lights",
    tags: ["Live Jazz", "Food Markets", "New to Town", "Soul"],
    musicTags: ["Jazz", "Soul"],
    lifeComposition: {
      "New to Town": 0.46,
      "Creative Professional": 0.41,
      "Wellness-Focused": 0.18,
    },
    attendeeInterests: ["Live Jazz", "Food Markets", "Design", "Startups"],
    capacity: 80,
    rsvps: 69,
    saves: 188,
    attendance: 55,
    velocity6h: 26,
    velocityAverage: 10,
    availability: "Weekends",
    startsInHours: 38,
    clickedUsersAttending: 2,
    smallGroup: false,
    highEnergy: true,
    leadsToClicks: true,
    intentBoosts: ["Dating", "Friendship", "Exploring"],
    conversion: { views: 4200, saves: 188, rsvps: 69, attendance: 55 },
  },
  {
    id: "sunrise-yoga",
    title: "Sunrise Yoga and Brunch Circle",
    category: "Wellness",
    date: "Sun 21 Jun 2026",
    time: "8:00 AM",
    venue: "Barangaroo Reserve",
    city: "Sydney NSW",
    distanceKm: 3.1,
    price: "Free",
    image: "/media/yoga.jpg",
    imageAlt: "People practicing yoga together in a studio class",
    tags: ["Yoga", "Wellness-Focused", "Food Markets", "Small Group"],
    musicTags: ["Indie"],
    lifeComposition: {
      "Wellness-Focused": 0.63,
      "New to Town": 0.39,
      "Creative Professional": 0.21,
    },
    attendeeInterests: ["Yoga", "Hiking", "Food Markets"],
    capacity: 32,
    rsvps: 28,
    saves: 96,
    attendance: 25,
    velocity6h: 12,
    velocityAverage: 8,
    availability: "Weekends",
    startsInHours: 74,
    clickedUsersAttending: 1,
    smallGroup: true,
    highEnergy: false,
    leadsToClicks: true,
    intentBoosts: ["Friendship", "Exploring"],
    conversion: { views: 1900, saves: 96, rsvps: 28, attendance: 25 },
  },
  {
    id: "founder-brunch",
    title: "Founder Brunch: Product People x Operators",
    category: "Business",
    date: "Thu 25 Jun 2026",
    time: "9:00 AM",
    venue: "Stone & Chalk",
    city: "Sydney NSW",
    distanceKm: 1.8,
    price: "$22",
    image: "/media/networking.jpg",
    imageAlt: "People standing and talking at a professional networking event",
    tags: ["Startups", "Design", "Networking", "Creative Professional"],
    musicTags: [],
    lifeComposition: {
      "Creative Professional": 0.58,
      "New to Town": 0.22,
      "Wellness-Focused": 0.09,
    },
    attendeeInterests: ["Startups", "Design", "Creative Workshops"],
    capacity: 120,
    rsvps: 102,
    saves: 144,
    attendance: 90,
    velocity6h: 18,
    velocityAverage: 11,
    availability: "Weekday evenings",
    startsInHours: 154,
    clickedUsersAttending: 0,
    smallGroup: false,
    highEnergy: true,
    leadsToClicks: false,
    intentBoosts: ["Networking", "Exploring"],
    conversion: { views: 5100, saves: 144, rsvps: 102, attendance: 90 },
  },
  {
    id: "ceramics-supper",
    title: "Clay, Supper and Slow Conversations",
    category: "Arts",
    date: "Wed 17 Jun 2026",
    time: "6:30 PM",
    venue: "Kil.n.it Experimental Studio",
    city: "Glebe NSW",
    distanceKm: 5.2,
    price: "$48",
    image: "/media/open-yoga.jpg",
    imageAlt: "Outdoor group class in an open community space",
    tags: ["Creative Workshops", "Food Markets", "Small Group", "Design"],
    musicTags: ["Indie"],
    lifeComposition: {
      "Creative Professional": 0.49,
      "New to Town": 0.31,
      "Wellness-Focused": 0.26,
    },
    attendeeInterests: ["Creative Workshops", "Design", "Food Markets"],
    capacity: 24,
    rsvps: 22,
    saves: 118,
    attendance: 20,
    velocity6h: 16,
    velocityAverage: 6,
    availability: "Weekday evenings",
    startsInHours: 32,
    clickedUsersAttending: 1,
    smallGroup: true,
    highEnergy: false,
    leadsToClicks: true,
    intentBoosts: ["Dating", "Friendship"],
    conversion: { views: 2600, saves: 118, rsvps: 22, attendance: 20 },
  },
  {
    id: "coastal-hike",
    title: "Coastal Reset Hike and Picnic",
    category: "Outdoors",
    date: "Sat 27 Jun 2026",
    time: "10:00 AM",
    venue: "Bondi to Bronte Walk",
    city: "Bondi NSW",
    distanceKm: 8.7,
    price: "$12",
    image: "/media/yoga.jpg",
    imageAlt: "Group wellness activity with people stretching together",
    tags: ["Hiking", "Wellness-Focused", "Food Markets", "New to Town"],
    musicTags: [],
    lifeComposition: {
      "Wellness-Focused": 0.52,
      "New to Town": 0.44,
      "Creative Professional": 0.17,
    },
    attendeeInterests: ["Hiking", "Yoga", "Food Markets"],
    capacity: 50,
    rsvps: 34,
    saves: 90,
    attendance: 30,
    velocity6h: 9,
    velocityAverage: 8,
    availability: "Weekends",
    startsInHours: 202,
    clickedUsersAttending: 0,
    smallGroup: false,
    highEnergy: false,
    leadsToClicks: false,
    intentBoosts: ["Friendship", "Exploring"],
    conversion: { views: 1750, saves: 90, rsvps: 34, attendance: 30 },
  },
  {
    id: "ai-community",
    title: "AI Builders: Practical Matching Systems",
    category: "Business",
    date: "Tue 23 Jun 2026",
    time: "6:00 PM",
    venue: "Fishburners",
    city: "Sydney NSW",
    distanceKm: 2.9,
    price: "$18",
    image: "/media/networking.jpg",
    imageAlt: "Attendees talking at a networking event",
    tags: ["Startups", "Design", "Creative Workshops", "Networking"],
    musicTags: [],
    lifeComposition: {
      "Creative Professional": 0.61,
      "New to Town": 0.19,
      "Wellness-Focused": 0.06,
    },
    attendeeInterests: ["Startups", "Design", "Creative Workshops"],
    capacity: 140,
    rsvps: 76,
    saves: 132,
    attendance: 64,
    velocity6h: 14,
    velocityAverage: 7,
    availability: "Weekday evenings",
    startsInHours: 110,
    clickedUsersAttending: 1,
    smallGroup: false,
    highEnergy: true,
    leadsToClicks: true,
    intentBoosts: ["Networking", "Friendship", "Exploring"],
    conversion: { views: 3600, saves: 132, rsvps: 76, attendance: 64 },
  },
];

const peopleCandidates: PeopleCandidate[] = [
  {
    id: "p-07",
    alias: "Verified profile 07",
    revealedName: "Maya",
    distanceKm: 2.1,
    tags: ["Yoga", "Live Jazz", "Food Markets", "Design", "Hiking"],
    lifeTags: ["New to Town", "Wellness-Focused"],
    musicTags: ["Jazz", "Soul"],
    availability: "Weekends",
    persona: {
      socialEnergy: "Ambivert",
      pace: "Balanced",
      openness: "Ready",
      frequency: "Regular",
      intentPrimary: "Friendship",
    },
    intents: ["Friendship", "Dating", "Exploring"],
    sharedPastEvents: 1,
    hasClickedViewer: true,
  },
  {
    id: "p-14",
    alias: "Verified profile 14",
    revealedName: "Theo",
    distanceKm: 3.7,
    tags: ["Startups", "Design", "Creative Workshops", "Live Jazz"],
    lifeTags: ["Creative Professional", "New to Town"],
    musicTags: ["Jazz", "Indie"],
    availability: "Weekday evenings",
    persona: {
      socialEnergy: "Extrovert",
      pace: "Fast-moving",
      openness: "Ready",
      frequency: "Enthusiastic",
      intentPrimary: "Networking",
    },
    intents: ["Networking", "Friendship", "Exploring"],
    sharedPastEvents: 2,
    hasClickedViewer: false,
  },
  {
    id: "p-22",
    alias: "Verified profile 22",
    revealedName: "Noah",
    distanceKm: 5.6,
    tags: ["Yoga", "Creative Workshops", "Food Markets", "Hiking"],
    lifeTags: ["Wellness-Focused"],
    musicTags: ["Soul"],
    availability: "Both",
    persona: {
      socialEnergy: "Introvert",
      pace: "Relaxed",
      openness: "Open",
      frequency: "Occasional",
      intentPrimary: "Dating",
    },
    intents: ["Dating", "Friendship", "Exploring"],
    sharedPastEvents: 0,
    hasClickedViewer: true,
  },
  {
    id: "p-31",
    alias: "Verified profile 31",
    revealedName: "Ari",
    distanceKm: 6.4,
    tags: ["Startups", "Hiking", "Networking", "Design"],
    lifeTags: ["Creative Professional"],
    musicTags: ["Indie"],
    availability: "Weekends",
    persona: {
      socialEnergy: "Ambivert",
      pace: "Fast-moving",
      openness: "Open",
      frequency: "Regular",
      intentPrimary: "Networking",
    },
    intents: ["Networking", "Exploring"],
    sharedPastEvents: 1,
    hasClickedViewer: false,
  },
];

function categoryMultiplier(category: string) {
  const count = currentUser.categoryHistory[category] ?? 0;

  if (count >= 11) return 1.6;
  if (count >= 6) return 1.4;
  if (count >= 3) return 1.25;
  if (count >= 1) return 1.1;
  return 1;
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function eventScore(event: EventItem, mode: IntentMode, rsvpOffset = 0) {
  const sharedTags = overlap(currentUser.tags, event.tags);
  const tagScore = sharedTags.length * 0.24 * categoryMultiplier(event.category);
  const matchingLifeRatio = Object.entries(event.lifeComposition)
    .filter(([tag]) => currentUser.lifeTags.includes(tag))
    .reduce((sum, [, ratio]) => sum + ratio, 0);
  const lifeBonus = Math.min(matchingLifeRatio, 1) * 0.2;
  const personaFit =
    (event.highEnergy && currentUser.persona.socialEnergy !== "Introvert"
      ? 0.15
      : 0) +
    (event.smallGroup && currentUser.persona.socialEnergy !== "Extrovert"
      ? 0.15
      : 0) +
    (event.leadsToClicks && currentUser.persona.openness === "Ready"
      ? 0.1
      : 0) +
    (event.startsInHours <= 48 ? 0.08 : 0) +
    (event.smallGroup && currentUser.persona.frequency !== "Enthusiastic"
      ? 0.06
      : 0);
  const peopleBonus = Math.min(event.clickedUsersAttending * 0.12, 0.36);
  const recencyBoost =
    event.startsInHours <= 24 && event.rsvps + rsvpOffset < event.capacity * 0.9
      ? 0.18
      : event.startsInHours <= 72
        ? 0.1
        : 0;
  const distancePenalty = (event.distanceKm / currentUser.radiusKm) * 0.3;
  const intentBoost = event.intentBoosts.includes(mode)
    ? mode === "Networking" && event.category === "Business"
      ? 0.22
      : 0.16
    : mode === "Exploring"
      ? 0.06
      : 0;

  return {
    sharedTags,
    total: Number(
      (
        tagScore +
        lifeBonus +
        personaFit +
        peopleBonus +
        recencyBoost +
        intentBoost -
        distancePenalty
      ).toFixed(3),
    ),
    tagScore: Number(tagScore.toFixed(2)),
    lifeBonus: Number(lifeBonus.toFixed(2)),
    personaFit: Number(personaFit.toFixed(2)),
    peopleBonus: Number(peopleBonus.toFixed(2)),
    recencyBoost: Number(recencyBoost.toFixed(2)),
    distancePenalty: Number(distancePenalty.toFixed(2)),
    intentBoost: Number(intentBoost.toFixed(2)),
  };
}

function radarScore(event: EventItem) {
  const tagOverlap = overlap(currentUser.tags, event.tags).length / currentUser.tags.length;
  const peopleOverlap = event.clickedUsersAttending >= 2 ? 1 : event.clickedUsersAttending === 1 ? 0.5 : 0;
  const trending = Math.min(event.velocity6h / Math.max(event.velocityAverage, 1), 2) / 2;
  const proximity = 1 - event.distanceKm / currentUser.radiusKm;

  return Number(
    (tagOverlap * 0.4 + peopleOverlap * 0.3 + trending * 0.2 + proximity * 0.1).toFixed(3),
  );
}

function fomoSignals(event: EventItem, mode: IntentMode, rsvpOffset = 0) {
  const filled = (event.rsvps + rsvpOffset) / event.capacity;
  const sharedInterestTags = overlap(currentUser.tags, event.attendeeInterests);
  const topLifeTag = Object.entries(event.lifeComposition).find(
    ([tag, ratio]) => currentUser.lifeTags.includes(tag) && ratio >= 0.4,
  );

  const signals = [
    event.clickedUsersAttending > 0
      ? {
          priority: 1,
          label:
            mode === "Networking"
              ? "A professional you may Click with is attending"
              : "Someone you might Click with is going",
        }
      : null,
    sharedInterestTags.length >= 2
      ? {
          priority: 2,
          label:
            mode === "Dating"
              ? `Popular with singles who love ${sharedInterestTags.slice(0, 2).join(" and ")}`
              : `People who love ${sharedInterestTags.slice(0, 2).join(" and ")} are going`,
        }
      : null,
    topLifeTag
      ? {
          priority: 3,
          label: `Mostly ${topLifeTag[0]} joining this event`,
        }
      : null,
    filled >= 0.85
      ? {
          priority: 4,
          label: `Almost full - ${Math.max(event.capacity - event.rsvps - rsvpOffset, 0)} spots left`,
        }
      : null,
    event.velocity6h >= event.velocityAverage * 2
      ? {
          priority: 5,
          label: "Trending this week - booking fast",
        }
      : null,
  ].filter(Boolean) as { priority: number; label: string }[];

  return signals.sort((a, b) => a.priority - b.priority).slice(0, 2);
}

function peopleScore(candidate: PeopleCandidate, mode: IntentMode) {
  const sharedTags = overlap(currentUser.tags, candidate.tags);
  const tagOverlap =
    sharedTags.length / Math.sqrt(currentUser.tags.length * candidate.tags.length);
  const lifeBonus =
    overlap(currentUser.lifeTags, candidate.lifeTags).length * 0.1 +
    (candidate.lifeTags.includes("New to Town") &&
    currentUser.lifeTags.includes("New to Town")
      ? 0.12
      : 0) +
    (currentUser.availability.includes(candidate.availability) ||
    candidate.availability === "Both"
      ? 0.1
      : 0);
  const musicBonus = Math.min(overlap(currentUser.musicTags, candidate.musicTags).length * 0.04, 0.12);
  const eventOverlap = Math.min(candidate.sharedPastEvents * 0.15, 0.3);
  const personaBonus =
    (candidate.persona.socialEnergy === currentUser.persona.socialEnergy ||
    candidate.persona.socialEnergy === "Ambivert"
      ? 0.12
      : candidate.persona.socialEnergy === "Introvert" &&
          currentUser.persona.socialEnergy === "Extrovert"
        ? 0
        : 0.06) +
    (candidate.persona.openness === "Ready" && currentUser.persona.openness === "Ready"
      ? 0.1
      : 0.04) +
    (candidate.persona.pace === currentUser.persona.pace
      ? 0.08
      : mode === "Dating" &&
          candidate.persona.pace === "Relaxed" &&
          currentUser.persona.pace === "Fast-moving"
        ? -0.05
        : 0.02) +
    (candidate.persona.intentPrimary === mode ? 0.15 : 0);
  const modeEligibility = candidate.intents.includes(mode) ? 0.18 : mode === "Exploring" ? 0.08 : -0.2;

  return {
    sharedTags,
    total: Number((tagOverlap + lifeBonus + musicBonus + eventOverlap + personaBonus + modeEligibility).toFixed(3)),
    tagOverlap: Number(tagOverlap.toFixed(2)),
    lifeBonus: Number(lifeBonus.toFixed(2)),
    musicBonus: Number(musicBonus.toFixed(2)),
    eventOverlap: Number(eventOverlap.toFixed(2)),
    personaBonus: Number(personaBonus.toFixed(2)),
  };
}

function selectedMerchantInsights(event: EventItem) {
  const matchingUsers = Math.round(
    event.tags.filter((tag) => currentUser.tags.includes(tag)).length * 820 +
      event.lifeComposition["Creative Professional"] * 980 +
      event.velocity6h * 24,
  );

  return {
    matchingUsers,
    tagMix: event.tags.slice(0, 4),
    suggestedTags: ["First-timers welcome", "Conversation-led", "Shared tables"].filter(
      (tag) => !event.tags.includes(tag),
    ),
    fomoPreview: fomoSignals(event, "Friendship").map((signal) => signal.label),
  };
}

export default function Home() {
  const [intentMode, setIntentMode] = useState<IntentMode>("Friendship");
  const [savedEvents, setSavedEvents] = useState<string[]>(["jazz-rooftop"]);
  const [rsvpOffsets, setRsvpOffsets] = useState<Record<string, number>>({});
  const [waitlistedEvents, setWaitlistedEvents] = useState<string[]>([]);
  const [clickedProfiles, setClickedProfiles] = useState<string[]>([]);
  const [dismissedProfiles, setDismissedProfiles] = useState<string[]>([]);
  const [mutualCandidateId, setMutualCandidateId] = useState<string | null>(null);
  const [unlockedCandidateId, setUnlockedCandidateId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState(events[0].id);

  const rankedEvents = useMemo(
    () =>
      [...events]
        .map((event) => ({
          event,
          score: eventScore(event, intentMode, rsvpOffsets[event.id] ?? 0),
          radar: radarScore(event),
        }))
        .sort((a, b) => b.score.total - a.score.total),
    [intentMode, rsvpOffsets],
  );

  const radarEvents = useMemo(
    () => [...rankedEvents].sort((a, b) => b.radar - a.radar).slice(0, 5),
    [rankedEvents],
  );

  const peopleCards = useMemo(
    () =>
      [...peopleCandidates]
        .filter((candidate) => !dismissedProfiles.includes(candidate.id))
        .map((candidate) => ({
          candidate,
          score: peopleScore(candidate, intentMode),
        }))
        .sort((a, b) => b.score.total - a.score.total)
        .slice(0, 3),
    [dismissedProfiles, intentMode],
  );

  const activeEvent =
    rankedEvents.find(({ event }) => event.id === activeEventId)?.event ??
    rankedEvents[0].event;
  const merchantInsights = selectedMerchantInsights(activeEvent);
  const mutualCandidate = peopleCandidates.find(
    (candidate) => candidate.id === mutualCandidateId,
  );
  const unlockedCandidate = peopleCandidates.find(
    (candidate) => candidate.id === unlockedCandidateId,
  );
  const mutualSuggestions = rankedEvents
    .filter(({ event }) =>
      mutualCandidate
        ? overlap(event.tags, mutualCandidate.tags).length >= 2
        : false,
    )
    .slice(0, 3);

  function toggleSave(eventId: string) {
    setSavedEvents((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  }

  function rsvpToEvent(event: EventItem) {
    const offset = rsvpOffsets[event.id] ?? 0;
    const remaining = event.capacity - event.rsvps - offset;

    if (remaining <= 0) {
      setWaitlistedEvents((current) =>
        current.includes(event.id) ? current : [...current, event.id],
      );
      return;
    }

    setRsvpOffsets((current) => ({
      ...current,
      [event.id]: (current[event.id] ?? 0) + 1,
    }));

    if (
      mutualCandidate &&
      mutualSuggestions.some(({ event: suggestedEvent }) => suggestedEvent.id === event.id)
    ) {
      setUnlockedCandidateId(mutualCandidate.id);
    }
  }

  function clickProfile(candidate: PeopleCandidate) {
    setClickedProfiles((current) =>
      current.includes(candidate.id) ? current : [...current, candidate.id],
    );

    if (candidate.hasClickedViewer) {
      setMutualCandidateId(candidate.id);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#111111]">
      <section className="bg-[#101820] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>$2.4M in booking fees redirected to community causes through Click-hosted events</p>
          <div className="flex gap-4 text-white/75">
            <a href="#events" className="hover:text-white">
              Find events
            </a>
            <a href="#merchant" className="hover:text-white">
              Host events
            </a>
            <a href="#algorithm" className="hover:text-white">
              Intelligence layer
            </a>
          </div>
        </div>
      </section>

      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="#" className="flex items-center gap-3" aria-label="Click home">
            <span className="grid size-10 place-items-center rounded-md bg-[#111111] text-lg font-black text-white">
              C
            </span>
            <span className="text-2xl font-black tracking-tight">Click</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-bold text-black/65 md:flex">
            <a href="#events" className="hover:text-black">
              Events
            </a>
            <a href="#radar" className="hover:text-black">
              Radar
            </a>
            <a href="#people" className="hover:text-black">
              People
            </a>
            <a href="#merchant" className="hover:text-black">
              Merchant insights
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button className="hidden rounded-full border border-black/20 px-4 py-2 text-sm font-bold sm:block">
              Host login
            </button>
            <a
              href="#events"
              className="rounded-full bg-[#12b886] px-4 py-2 text-sm font-black text-[#08130f] shadow-sm shadow-[#12b886]/20"
            >
              Get tickets
            </a>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#111111] text-white">
        <Image
          src="/media/concert.jpg"
          alt="Crowd at a live music event"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.62),rgba(0,0,0,0.18))]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-black">
              Featured by the Click Matching Engine
            </p>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-normal sm:text-7xl">
              Events ranked for real-world connection.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-white/82">
              Click turns event discovery into a personalised social feed: AI-ranked
              experiences, anonymous mutual clicks, FOMO signals, and merchant audience
              intelligence all working from the same algorithm layer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#events"
                className="rounded-full bg-[#ffcf3f] px-6 py-3 text-sm font-black text-black"
              >
                Explore suggested events
              </a>
              <a
                href="#people"
                className="rounded-full border border-white/60 px-6 py-3 text-sm font-black text-white"
              >
                See who you might Click with
              </a>
            </div>
          </div>

          <div className="grid gap-3 self-end">
            {rankedEvents.slice(0, 3).map(({ event, score }, index) => (
              <button
                key={event.id}
                onClick={() => setActiveEventId(event.id)}
                className="group grid grid-cols-[92px_1fr] gap-4 rounded-md border border-white/18 bg-white/12 p-3 text-left backdrop-blur transition hover:bg-white/18"
              >
                <Image
                  src={event.image}
                  alt={event.imageAlt}
                  width={184}
                  height={144}
                  className="h-24 w-full rounded object-cover"
                />
                <span className="min-w-0">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#ffcf3f]">
                    Featured #{index + 1}
                  </span>
                  <span className="mt-1 block text-lg font-black leading-tight">
                    {event.title}
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-white/72">
                    Score {score.total} - {score.sharedTags.join(", ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-4 sm:px-6">
          {[
            "Nearby",
            "Music",
            "This week",
            "Free",
            "Food & Drink",
            "Wellness",
            "Business",
            "Creative Workshops",
            "Sydney NSW",
          ].map((chip) => (
            <a
              href="#events"
              key={chip}
              className="shrink-0 rounded-full border border-black/10 bg-[#f6f7fb] px-4 py-2 text-sm font-black text-black/72 hover:border-black/30 hover:text-black"
            >
              {chip}
            </a>
          ))}
        </div>
      </section>

      <section className="bg-[#eaf8f3]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#087f5b]">
              Intent mode
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">
              Switching mode changes the ranking weights.
            </h2>
          </div>
          <div>
            <div className="grid gap-2 rounded-md border border-[#12b886]/25 bg-white p-2 sm:grid-cols-4">
              {intentModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setIntentMode(mode)}
                  className={`rounded px-4 py-3 text-sm font-black transition ${
                    intentMode === mode
                      ? "bg-[#111111] text-white"
                      : "bg-transparent text-black/62 hover:bg-black/5"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-3 text-base font-semibold text-black/70">
              {modeTone[intentMode]}
            </p>
          </div>
        </div>
      </section>

      <section id="events" className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#e8590c]">
                Suggested for you
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-normal">
                Top events from the scoring pipeline
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-6 text-black/62">
              Candidate events are filtered by distance and availability, scored by tag
              overlap, life-tag compatibility, persona fit, people overlap, recency,
              proximity, and the selected intent mode.
            </p>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {rankedEvents.map(({ event, score }) => {
              const offset = rsvpOffsets[event.id] ?? 0;
              const remaining = event.capacity - event.rsvps - offset;
              const filled = ((event.rsvps + offset) / event.capacity) * 100;

              return (
                <article
                  key={event.id}
                  className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
                >
                  <button
                    onClick={() => setActiveEventId(event.id)}
                    className="block w-full text-left"
                  >
                    <div className="relative h-56">
                      <Image
                        src={event.image}
                        alt={event.imageAlt}
                        fill
                        sizes="(min-width: 1024px) 33vw, 100vw"
                        className="object-cover"
                      />
                      <div className="absolute left-3 top-3 rounded bg-white px-3 py-2 text-xs font-black text-black">
                        Score {score.total}
                      </div>
                      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                        {fomoSignals(event, intentMode, offset).map((signal) => (
                          <span
                            key={signal.label}
                            className="rounded bg-[#111111] px-3 py-2 text-xs font-black text-white"
                          >
                            {signal.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-[#087f5b]">
                          {event.date} - {event.time}
                        </p>
                        <h3 className="mt-2 text-2xl font-black leading-tight">
                          {event.title}
                        </h3>
                        <p className="mt-2 text-sm font-semibold text-black/58">
                          {event.venue}, {event.city} - {event.distanceKm} km
                        </p>
                      </div>
                      <span className="rounded bg-[#ffcf3f] px-3 py-2 text-sm font-black">
                        {event.price}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {event.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#f1f3f5] px-3 py-1 text-xs font-black text-black/65"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-xs font-black text-black/60">
                        <span>
                          {event.rsvps + offset}/{event.capacity} RSVP capacity
                        </span>
                        <span>{remaining > 0 ? `${remaining} left` : "Waitlist open"}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                        <div
                          className="h-full rounded-full bg-[#12b886]"
                          style={{ width: `${Math.min(filled, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => rsvpToEvent(event)}
                        className="rounded-full bg-[#111111] px-4 py-3 text-sm font-black text-white"
                      >
                        {remaining > 0 ? "RSVP" : waitlistedEvents.includes(event.id) ? "Waitlisted" : "Join waitlist"}
                      </button>
                      <button
                        onClick={() => toggleSave(event.id)}
                        className="rounded-full border border-black/15 px-4 py-3 text-sm font-black"
                      >
                        {savedEvents.includes(event.id) ? "Saved" : "Save"}
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 text-xs font-bold text-black/62">
                      <span>Tags {score.tagScore}</span>
                      <span>Life {score.lifeBonus}</span>
                      <span>Persona {score.personaFit}</span>
                      <span>People {score.peopleBonus}</span>
                      <span>Intent {score.intentBoost}</span>
                      <span>Distance -{score.distancePenalty}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="radar" className="bg-[#101820] py-12 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffcf3f]">
              Click Radar
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-normal">
              Ambient awareness, not a map.
            </h2>
            <p className="mt-4 text-base font-medium leading-7 text-white/70">
              Radar ranks nearby events by 40% tag overlap, 30% people overlap,
              20% trending velocity, and 10% proximity. The top five rotate as
              behaviour changes.
            </p>
          </div>
          <div className="grid gap-3">
            {radarEvents.map(({ event, radar }, index) => (
              <button
                key={event.id}
                onClick={() => setActiveEventId(event.id)}
                className="grid gap-4 rounded-md border border-white/15 bg-white/[0.06] p-4 text-left sm:grid-cols-[64px_1fr_auto]"
              >
                <span className="grid size-16 place-items-center rounded bg-[#ffcf3f] text-2xl font-black text-black">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-xl font-black">{event.title}</span>
                  <span className="mt-1 block text-sm font-semibold text-white/62">
                    {event.clickedUsersAttending} clicked-user overlap - {event.velocity6h} RSVPs in 6h - {event.distanceKm} km
                  </span>
                </span>
                <span className="rounded bg-white px-3 py-2 text-sm font-black text-black">
                  Radar {radar}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="people" className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5f3dc4]">
                You might Click with
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-normal">
                Anonymous people cards with no chat.
              </h2>
              <p className="mt-4 text-base font-semibold leading-7 text-black/62">
                The top three cards are cached people matches for the current intent
                mode. Names and photos stay hidden until there is a mutual click and
                both people RSVP to a suggested event.
              </p>

              {mutualCandidate ? (
                <div className="mt-6 rounded-md border border-[#12b886]/40 bg-[#eaf8f3] p-5">
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#087f5b]">
                    Mutual click detected
                  </p>
                  <h3 className="mt-2 text-2xl font-black">
                    Shared-event unlock is ready.
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-black/65">
                    {unlockedCandidate
                      ? `Identity reveal earned: ${unlockedCandidate.revealedName} is now unlocked because both RSVPed to the same suggested event.`
                      : "Identity is still private. RSVP to one suggested event below to complete the unlock flow."}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {mutualSuggestions.map(({ event }) => (
                      <button
                        key={event.id}
                        onClick={() => rsvpToEvent(event)}
                        className="rounded border border-black/10 bg-white px-4 py-3 text-left text-sm font-black"
                      >
                        {event.title} - RSVP to reveal after shared commitment
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4">
              {peopleCards.map(({ candidate, score }) => (
                <article
                  key={candidate.id}
                  className="rounded-md border border-black/10 bg-[#f6f7fb] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="grid size-14 place-items-center rounded bg-[#111111] text-lg font-black text-white">
                        {candidate.alias.replace("Verified profile ", "P")}
                      </span>
                      <div>
                        <h3 className="text-xl font-black">
                          {unlockedCandidateId === candidate.id
                            ? candidate.revealedName
                            : candidate.alias}
                        </h3>
                        <p className="text-sm font-semibold text-black/58">
                          {candidate.distanceKm} km - {candidate.availability}
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-[#ffcf3f] px-3 py-2 text-sm font-black">
                      {score.total}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {score.sharedTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white px-3 py-1 text-xs font-black text-black/65"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-black/62 sm:grid-cols-5">
                    <span>Tags {score.tagOverlap}</span>
                    <span>Life {score.lifeBonus}</span>
                    <span>Music {score.musicBonus}</span>
                    <span>Events {score.eventOverlap}</span>
                    <span>Persona {score.personaBonus}</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => clickProfile(candidate)}
                      className="rounded-full bg-[#111111] px-4 py-3 text-sm font-black text-white"
                    >
                      {clickedProfiles.includes(candidate.id) ? "Clicked privately" : "Click privately"}
                    </button>
                    <button
                      onClick={() =>
                        setDismissedProfiles((current) => [...current, candidate.id])
                      }
                      className="rounded-full border border-black/15 px-4 py-3 text-sm font-black"
                    >
                      Dismiss 14 days
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="merchant" className="bg-[#f6f7fb] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#087f5b]">
                Merchant audience intelligence
              </p>
              <h2 className="mt-3 text-4xl font-black tracking-normal">
                Tag-level demand before publishing.
              </h2>
            </div>
            <select
              value={activeEvent.id}
              onChange={(event) => setActiveEventId(event.target.value)}
              className="rounded-md border border-black/15 bg-white px-4 py-3 text-sm font-black"
              aria-label="Select event for merchant intelligence"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-4">
            <article className="rounded-md border border-black/10 bg-white p-5">
              <p className="text-sm font-black text-black/50">Click Potential Score</p>
              <p className="mt-3 text-4xl font-black">{merchantInsights.matchingUsers}</p>
              <p className="mt-2 text-sm font-semibold text-black/58">
                Active users whose tags, life stage, and distance settings match this event.
              </p>
            </article>
            <article className="rounded-md border border-black/10 bg-white p-5">
              <p className="text-sm font-black text-black/50">Audience composition</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {merchantInsights.tagMix.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#eaf8f3] px-3 py-1 text-xs font-black text-[#087f5b]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
            <article className="rounded-md border border-black/10 bg-white p-5">
              <p className="text-sm font-black text-black/50">FOMO preview</p>
              <div className="mt-3 grid gap-2 text-sm font-bold text-black/70">
                {merchantInsights.fomoPreview.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>
            </article>
            <article className="rounded-md border border-black/10 bg-white p-5">
              <p className="text-sm font-black text-black/50">Suggested tags</p>
              <div className="mt-3 grid gap-2 text-sm font-bold text-black/70">
                {merchantInsights.suggestedTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-5 rounded-md border border-black/10 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              {Object.entries(activeEvent.conversion).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">
                    {label}
                  </p>
                  <p className="mt-1 text-3xl font-black">{value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="algorithm" className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#e8590c]">
              Technical requirements coverage
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-normal">
              The page exposes the algorithm layer as product UI.
            </h2>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "Database and cache model",
                items: [
                  "clicks with intent-mode mutual detection",
                  "event_tag_scores for feed ranking",
                  "match_candidates top-10 cache",
                  "fomo_signals refreshed from RSVP data",
                  "behaviour_log for RSVP, save, click, and feedback events",
                ],
              },
              {
                title: "Edge jobs and realtime",
                items: [
                  "score-event-feed on 4-hour cron plus dashboard open",
                  "score-people-feed for active users",
                  "compute-fomo-signals on RSVP changes",
                  "waitlist promotion when capacity opens",
                  "realtime capacity, attendee count, and notifications",
                ],
              },
              {
                title: "Privacy rules",
                items: [
                  "anonymous cards until mutual event RSVP",
                  "target user identity hidden before unlock",
                  "FOMO uses aggregate cohorts only",
                  "candidate cache stores UUID and score, not profile PII",
                  "clicks expire after 30 days and dismissals suppress cards",
                ],
              },
            ].map((group) => (
              <article
                key={group.title}
                className="rounded-md border border-black/10 bg-[#f6f7fb] p-5"
              >
                <h3 className="text-2xl font-black">{group.title}</h3>
                <ul className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-black/65">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-[#12b886]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#101820] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div>
            <p className="text-2xl font-black">Click</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/60">
              AI-powered social discovery built around events, privacy, and real-world
              connection outcomes.
            </p>
          </div>
          {[
            ["Find events", "Nearby", "Music", "Wellness", "This weekend"],
            ["Host events", "Audience insights", "FOMO previews", "Pricing"],
            ["Use Click", "Intent modes", "Click Radar", "Privacy"],
          ].map(([title, ...items]) => (
            <div key={title}>
              <p className="font-black">{title}</p>
              <div className="mt-3 grid gap-2 text-sm font-semibold text-white/60">
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
