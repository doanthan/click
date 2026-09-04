export type EventStatus =
  | "Featured"
  | "Live"
  | "Waitlist"
  | "Locked"
  | "Pending"
  | "Rejected"
  | "Cancelled";

export type EventItem = {
  id: string;
  title: string;
  group: string;
  host: string;
  category: string;
  date: string;
  time: string;
  startsAt: string;
  // ISO end time when the event has a known duration. Optional because the
  // bundled demo catalogue below predates durations; DB-backed events always
  // carry it. Use formatEventTimeRange() to render a start-end label.
  endsAt?: string | null;
  location: string;
  suburb: string;
  /** null when the event has no pinned coordinates - not 0, which read as
   *  "at the CBD" and won the Nearest sort. */
  distanceKm: number | null;
  /** null on any surface that withholds the venue (21 §B5.5 / runbook B5 item 5).
   *  A lat/lng pair IS the address, so the explore payload nulls them for a caller
   *  who has not booked and leaves distanceKm - already suburb-rounded - to sort. */
  lat: number | null;
  lng: number | null;
  price: string;
  attendees: number;
  // Up to 3 avatar URLs of confirmed attendees, for the "who's going" social-
  // proof preview on event cards. Optional: only DB-backed events populate it
  // (the bundled demo catalogue below predates it).
  attendeeAvatars?: string[];
  capacity: number;
  image: string;
  imageAlt: string;
  description: string;
  tags: string[];
  lifeSignals: string[];
  /** null when the host wrote none - never a stand-in claim about attendance. */
  fomo: string | null;
  status: EventStatus;
  booking: "Click-managed" | "External";
  relationshipGoal: string;
};

// Renders a "6:30 - 8:30 PM" range when the event has a known end, otherwise
// just the start time. Both ends are formatted in Australia/Sydney so the end
// label matches the server-formatted `time` string already on the item.
const sydneyTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

export function formatEventTimeRange(event: Pick<EventItem, "time" | "endsAt">) {
  if (!event.endsAt) return event.time;
  const end = new Date(event.endsAt);
  if (Number.isNaN(end.getTime())) return event.time;
  return `${event.time} - ${sydneyTimeFormatter.format(end)}`;
}

export type PeopleRecommendation = {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  neighborhood: string;
  intent: string;
  persona: string;
  bio: string;
  tags: string[];
  matchReason: string;
  nextEventId: string;
  accent: string;
};

/**
 * Curated portrait photos from Unsplash. Cycled deterministically by person id
 * so the same person always shows the same face. All images are 200x200,
 * face-cropped, and served via Unsplash's image CDN.
 */
const unsplashPortraits = [
  "1494790108377-be9c29b29330",
  "1500648767791-00dcc994a43e",
  "1438761681033-6461ffad8d80",
  "1517841905240-472988babdf9",
  "1531123897727-8f129e1688ce",
  "1506794778202-cad84cf45f1d",
  "1502823403499-6ccfcf4fb453",
  "1487412720507-e7ab37603c6f",
  "1539571696357-5a69c17a67c6",
  "1552058544-f2b08422138a",
  "1519085360753-af0119f7cbe7",
  "1521119989659-a83eee488004",
  "1534528741775-53994a69daeb",
  "1492562080023-ab3db95bfbce",
  "1463453091185-61582044d556",
  "1564564321837-a57b7070ac4f",
  "1546961342-091cbcb40d8d",
  "1504593811423-6dd665756598",
  "1513956589380-bad6acb9b9d4",
  "1573496359142-b8d87734a5a2",
];

function hashId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarFor(person: { id: string; avatar?: string }) {
  if (person.avatar) return person.avatar;
  const photo = unsplashPortraits[hashId(person.id) % unsplashPortraits.length];
  return `https://images.unsplash.com/photo-${photo}?w=200&h=200&fit=crop&crop=faces&auto=format&q=80`;
}

export const navItems = [
  { label: "Discover", href: "/discover" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Merchant", href: "/merchant" },
  { label: "Admin", href: "/admin" },
];

export const animatedPrompts = [
  "I want to meet new friends in Newtown",
  "Find people for weekend coffee in Surry Hills",
  "I just moved to Marrickville and want a social group",
  "Show me low-pressure dinners in Bondi",
  "I want a fitness friend around Redfern",
  "Help me meet creative people in Glebe",
  "Find a walking group near Barangaroo",
  "I want to make friends in Parramatta",
];

export const starterPrompts = animatedPrompts.slice(0, 4);

// Mirrors the public rows of the DB `tag_categories` table (internal_only =
// false). The DB is the source of truth - the `/categories` index reads it
// live via getEventCategories() - but this static list still drives the
// `/categories/<slug>` landing pages (generateStaticParams + categoryFromSlug)
// and the discover rail ordering, so it must stay in sync or events in a
// missing category get dropped / their landing page 404s. The internal-only
// `Life` and `Music` categories are matching signals, not browsable event
// lanes, so they're intentionally excluded. When an admin adds a public
// category, add it here too.
export const categories = [
  "All",
  "Social",
  "Fitness",
  "Relationships",
  "Food",
  "Creative",
  "Career",
  "Community",
  "Family",
  "Games",
  "Learning",
  "Nightlife",
  "Outdoors",
  "Sports",
  "Travel",
  "Wellness",
];

// URL slug <-> display name for category browse pages (/categories/<slug>).
// Slugs are lowercased display names; keep the mapping centralized so the
// discover rails and the category landing pages never drift apart.
export function categorySlug(category: string): string {
  return category.toLowerCase();
}

// Resolve a slug back to the canonical display name (case-insensitive),
// returning null for unknown categories so callers can 404.
export function categoryFromSlug(slug: string): string | null {
  const match = categories.find(
    (category) => category !== "All" && categorySlug(category) === slug.toLowerCase(),
  );
  return match ?? null;
}

// Demo event catalogue was removed so the site starts fresh. Events now come
// solely from Postgres; when the DB is unreachable this fallback is an honest
// empty state rather than 66 seeded placeholder events.
export const clickEvents: EventItem[] = [];

// Demo people recommendations were removed so the site starts fresh. The
// /people surface renders real profiles via live DB queries; this fallback
// stays empty (an honest empty state) rather than seeding placeholder people.
export const peopleCards: PeopleRecommendation[] = [];

export const groups = [
  {
    name: "Sydney First-Timers Social Club",
    members: "8,420",
    category: "Social",
    focus: "Making friends after moving, breakups, new jobs, or fresh starts.",
    cadence: "3 weekly events",
  },
  {
    name: "Inner West Fitness Mates",
    members: "3,180",
    category: "Fitness",
    focus: "CrossFit, running, climbing, and accountability partners.",
    cadence: "2 morning crews",
  },
  {
    name: "Real Conversations Sydney",
    members: "5,930",
    category: "Relationships",
    focus: "Relationship-minded dinners, walks, workshops, and quiet socials.",
    cadence: "Hosted tables",
  },
  {
    name: "Ordinary People Making Things",
    members: "2,760",
    category: "Creative",
    focus: "Creative hobbies, brunches, accountability circles, and local showcases.",
    cadence: "Monthly brunch",
  },
];

export const onboardingSteps = [
  "Intent selection",
  "Basic information",
  "Interest tags",
  "Optional social enrichment",
  "Email and photo verification",
  "Dashboard activation",
];

export const interestTagCategories = [
  ["Music", "Live Jazz", "House", "Karaoke", "Acoustic"],
  ["Arts", "Pottery", "Painting", "Life Drawing", "Crafts"],
  ["Food", "Brunch", "Wine Tasting", "Vegan Eats", "Cooking Classes"],
  ["Wellness", "Yoga", "Meditation", "Breathwork", "Ice Baths"],
  ["Fitness", "Pilates", "Boxing", "Running", "Rock Climbing"],
  ["Outdoors", "Beach Days", "Hiking", "Camping", "Kayaking"],
  ["Games", "Trivia", "Board Games", "Escape Rooms"],
  ["Community", "Dog Parks", "Volunteering", "Cleanups"],
];

export const lifeQuizSections = [
  {
    title: "Life stage and identity",
    output: "Life tags like New to Town, Pet Owner, New Parent, Traveller.",
  },
  {
    title: "Personality style",
    output: "Social energy: introvert, ambivert, extrovert.",
  },
  {
    title: "Availability",
    output: "Weeknights, weekends, morning, flexible schedule.",
  },
  {
    title: "Event style",
    output: "Small table, active, creative, high-energy, quiet setting.",
  },
  {
    title: "Energy and mood",
    output: "Curious, cautious, ready.",
  },
];

// Music taste, used as a subtle matching signal. Each genre maps to an
// admin-managed `tags` row (tag_type = 'music') seeded in
// database/029_seed_music_tags.sql - the `slug` here MUST match that seed and
// is the value submitted by the profile-edit picker. `jazz`/`indie` reuse the
// rows from database/002_seed.sql; `house-music` is suffixed to avoid colliding
// with the `house` *interest* tag (slug is globally unique in `tags`).
export const musicTags: { label: string; slug: string }[] = [
  { label: "Pop", slug: "pop" },
  { label: "Rock", slug: "rock" },
  { label: "Jazz", slug: "jazz" },
  { label: "Electronic", slug: "electronic" },
  { label: "House", slug: "house-music" },
  { label: "Hip Hop", slug: "hip-hop" },
  { label: "R&B", slug: "rnb" },
  { label: "Indie", slug: "indie" },
  { label: "Folk", slug: "folk" },
  { label: "Classical", slug: "classical" },
  { label: "Reggae", slug: "reggae" },
  { label: "Soul", slug: "soul" },
  { label: "Funk", slug: "funk" },
  { label: "Latin", slug: "latin" },
];

export const personaCards = [
  {
    title: "The Curious Explorer",
    body: "Socially flexible, open to trying new things, and comfortable in mixed groups.",
  },
  {
    title: "The Deep Connector",
    body: "Reflective, small-group oriented, and drawn to slower conversation.",
  },
  {
    title: "The Social Adventurer",
    body: "Outgoing, spontaneous, and pulled toward high-energy plans.",
  },
  {
    title: "The Mindful Achiever",
    body: "Goal-oriented, structured, and motivated by growth-based events.",
  },
];

export const merchantModules = [
  ["Overview", "Total events, attendees, revenue, and conversion by booking model."],
  ["Event management", "Create, edit, price, tag, and submit events for review."],
  ["Attendees", "RSVP, payment, waitlist, and export-ready attendee status."],
  ["Analytics", "Views to RSVPs, popular tags, and audience composition."],
  ["Settings", "Business profile, payout method, notification preferences."],
];

export const adminModules = [
  ["Merchant management", "Approve or reject hosts, review verification, track compliance."],
  ["Event moderation", "Check tag accuracy, duplicates, photos, spam, and publish readiness."],
  ["User oversight", "Review verification, flags, profile reports, and suspensions."],
  ["Tag management", "Create, merge, archive, and govern Interest Tags."],
  ["Financial review", "Audit Stripe transactions, refunds, and merchant payouts."],
  ["System logs", "Track admin actions, merchant edits, and security events."],
];

export const architectureLayers = [
  ["Hosted starts", "Every event needs a named host, a clear start time, and a simple reason for strangers to talk."],
  ["Familiar paths", "Recurring groups, shared rituals, and nearby suggestions make it easier to show up a second time."],
  ["Private sparks", "Clicks stay private until mutual, then point people toward a real event instead of an empty chat thread."],
];

export const securityRows = [
  ["Anonymous Clicks", "Clicks stay private until mutual and unlock an event suggestion, not a chat thread."],
  ["Verification gates", "Email and photo verification required before RSVP or Click actions."],
  ["RLS and RBAC", "Users, merchants, and admins see only the scopes their role permits."],
  ["Audit trails", "Admin approvals, overrides, financial edits, and moderation actions are logged."],
];

export const roadmapItems = [
  "React Native app with push notifications",
  "Behavior-based matching model",
  "Group RSVP and shared planning",
  "Merchant QR check-in tools",
  "Corporate and community partner portals",
];

// Connection-intent slugs are stored lowercase with underscores (e.g.
// "new_in_town"). Humanize them for display so a Pill never shows the raw slug:
// Pills uppercase via CSS, so we only need to turn underscores/hyphens into
// spaces ("new_in_town" → "new in town" → rendered "NEW IN TOWN").
export function formatIntent(slug: string): string {
  return slug.replace(/[_-]+/g, " ").trim();
}
