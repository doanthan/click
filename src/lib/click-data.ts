export type EventStatus = "Featured" | "Live" | "Waitlist" | "Locked" | "Pending";

export type EventItem = {
  id: string;
  title: string;
  group: string;
  host: string;
  category: string;
  date: string;
  time: string;
  startsAt: string;
  location: string;
  suburb: string;
  distanceKm: number;
  lat: number;
  lng: number;
  price: string;
  attendees: number;
  capacity: number;
  image: string;
  imageAlt: string;
  description: string;
  tags: string[];
  lifeSignals: string[];
  fomo: string;
  status: EventStatus;
  booking: "Click-managed" | "External";
  relationshipGoal: string;
};

export type PeopleRecommendation = {
  id: string;
  name: string;
  initials: string;
  neighborhood: string;
  intent: string;
  persona: string;
  bio: string;
  tags: string[];
  matchReason: string;
  nextEventId: string;
  accent: string;
};

export const navItems = [
  { label: "Discover", href: "/discover" },
  { label: "Events", href: "/events" },
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

export const categories = [
  "All",
  "Social",
  "Fitness",
  "Relationships",
  "Food",
  "Creative",
  "Career",
  "Community",
];

export const clickEvents: EventItem[] = [
  {
    id: "new-friends-barangaroo",
    title: "New Friends Picnic at Barangaroo",
    group: "Sydney First-Timers Social Club",
    host: "Maya Chen",
    category: "Social",
    date: "Fri, May 8",
    time: "6:30 PM",
    startsAt: "2026-05-08T18:30:00+10:00",
    location: "Barangaroo Reserve, Sydney",
    suburb: "Barangaroo",
    distanceKm: 1.4,
    lat: -33.857,
    lng: 151.201,
    price: "Free",
    attendees: 47,
    capacity: 60,
    image: "/media/open-yoga.jpg",
    imageAlt: "People gathering outdoors in a relaxed group class",
    description:
      "A hosted picnic for people who want easy conversation, shared snacks, and familiar faces for the next event.",
    tags: ["friends", "sydney", "new to town", "weekend", "low pressure"],
    lifeSignals: ["New to Town", "Ambivert", "Weekends"],
    fomo: "4 people you might Click with are already going.",
    status: "Featured",
    booking: "Click-managed",
    relationshipGoal: "Make two familiar faces before the next weekend.",
  },
  {
    id: "crossfit-coffee",
    title: "CrossFit Skills and Coffee Crew",
    group: "Inner West Fitness Mates",
    host: "Theo Morgan",
    category: "Fitness",
    date: "Sat, May 9",
    time: "8:00 AM",
    startsAt: "2026-05-09T08:00:00+10:00",
    location: "Marrickville Training Yard",
    suburb: "Marrickville",
    distanceKm: 7.8,
    lat: -33.913,
    lng: 151.155,
    price: "$12",
    attendees: 24,
    capacity: 32,
    image: "/media/yoga.jpg",
    imageAlt: "People training together in a group fitness session",
    description:
      "Technique-focused partner drills, scalable workouts, and post-session coffee for people who want consistency without gym cliques.",
    tags: ["crossfit", "fitness", "training", "coffee", "accountability"],
    lifeSignals: ["Fitness-Focused", "Active", "Morning"],
    fomo: "Popular with people building a four-week fitness streak.",
    status: "Live",
    booking: "Click-managed",
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
    startsAt: "2026-05-14T19:00:00+10:00",
    location: "Surry Hills",
    suburb: "Surry Hills",
    distanceKm: 2.5,
    lat: -33.884,
    lng: 151.212,
    price: "$29",
    attendees: 40,
    capacity: 42,
    image: "/media/networking.jpg",
    imageAlt: "People talking at a warm hosted dinner event",
    description:
      "Hosted dinner tables where singles meet through small-group conversation first, with private mutual interest after the event.",
    tags: ["dating", "relationships", "dinner", "surry hills", "low pressure"],
    lifeSignals: ["Curious", "Ready", "Weeknights"],
    fomo: "Mostly relationship-minded guests who prefer small tables.",
    status: "Waitlist",
    booking: "Click-managed",
    relationshipGoal: "Meet people through conversation before matching.",
  },
  {
    id: "ordinary-creatives",
    title: "Creative Brunch for Ordinary People",
    group: "Ordinary People Making Things",
    host: "Noah Singh",
    category: "Creative",
    date: "Sun, May 17",
    time: "10:30 AM",
    startsAt: "2026-05-17T10:30:00+10:00",
    location: "Newtown Community Hall",
    suburb: "Newtown",
    distanceKm: 4.7,
    lat: -33.897,
    lng: 151.179,
    price: "$18",
    attendees: 53,
    capacity: 70,
    image: "/media/concert.jpg",
    imageAlt: "Crowd at a warm local music and creative event",
    description:
      "A no-status brunch for writers, designers, builders, makers, and anyone who wants a recurring community around doing real things.",
    tags: ["creative", "brunch", "newtown", "friends", "community"],
    lifeSignals: ["Creative", "Weekend", "Curious Explorer"],
    fomo: "Strong overlap with makers, writers, and new locals.",
    status: "Featured",
    booking: "External",
    relationshipGoal: "Turn a hobby into a recurring group.",
  },
  {
    id: "career-walk",
    title: "Career Change Walk and Talk",
    group: "Sydney Career Switchers",
    host: "Priya Nair",
    category: "Career",
    date: "Wed, May 20",
    time: "6:00 PM",
    startsAt: "2026-05-20T18:00:00+10:00",
    location: "Circular Quay to The Rocks",
    suburb: "The Rocks",
    distanceKm: 0.9,
    lat: -33.859,
    lng: 151.209,
    price: "Free",
    attendees: 31,
    capacity: 45,
    image: "/media/networking.jpg",
    imageAlt: "People talking at a community meetup",
    description:
      "A walking meetup for people changing careers, building confidence, and looking for peers rather than formal networking.",
    tags: ["career", "confidence", "walk", "networking", "support"],
    lifeSignals: ["Busy Professional", "Balanced", "Weeknights"],
    fomo: "Good fit for people rebuilding confidence around work.",
    status: "Live",
    booking: "External",
    relationshipGoal: "Meet peers who understand the same career transition.",
  },
  {
    id: "dog-park-cleanup",
    title: "Dog Park Coffee and Cleanup",
    group: "Inner City Community Mates",
    host: "Jules Park",
    category: "Community",
    date: "Sat, May 23",
    time: "9:00 AM",
    startsAt: "2026-05-23T09:00:00+10:00",
    location: "Camperdown Memorial Rest Park",
    suburb: "Camperdown",
    distanceKm: 4.2,
    lat: -33.888,
    lng: 151.176,
    price: "Free",
    attendees: 18,
    capacity: 36,
    image: "/media/open-yoga.jpg",
    imageAlt: "Outdoor community group meeting in a park",
    description:
      "A light volunteer morning for pet owners, locals, and people who want a natural reason to talk while doing something useful.",
    tags: ["community", "pets", "coffee", "volunteering", "friends"],
    lifeSignals: ["Pet Owner", "Community", "Weekend"],
    fomo: "Popular with pet owners and people new to Camperdown.",
    status: "Locked",
    booking: "Click-managed",
    relationshipGoal: "Meet locals through a useful shared ritual.",
  },
];

export const peopleCards: PeopleRecommendation[] = [
  {
    id: "maya",
    name: "Maya",
    initials: "MC",
    neighborhood: "Barangaroo",
    intent: "New friends",
    persona: "Curious Explorer",
    bio: "Moved back to Sydney and wants a reliable weekend circle for picnics, walks, and easy conversation.",
    tags: ["friends", "sydney", "new to town", "weekend", "low pressure"],
    matchReason: "Good first match for relaxed social plans and recurring friendship groups.",
    nextEventId: "new-friends-barangaroo",
    accent: "bg-[#7edbd3]",
  },
  {
    id: "theo",
    name: "Theo",
    initials: "TM",
    neighborhood: "Marrickville",
    intent: "Fitness partner",
    persona: "Mindful Achiever",
    bio: "Training for consistency, not ego. Likes scalable CrossFit sessions and coffee after class.",
    tags: ["crossfit", "fitness", "training", "coffee", "accountability"],
    matchReason: "Best match for getting better at CrossFit without joining a clique.",
    nextEventId: "crossfit-coffee",
    accent: "bg-[#7edbd3]",
  },
  {
    id: "amelia",
    name: "Amelia",
    initials: "AH",
    neighborhood: "Surry Hills",
    intent: "Relationship-minded",
    persona: "Deep Connector",
    bio: "Prefers hosted dinners, small tables, and dating events that start with real conversation.",
    tags: ["dating", "relationships", "dinner", "surry hills", "low pressure"],
    matchReason: "Strong fit for relationship events with structure and no awkward pressure.",
    nextEventId: "slow-dating-six",
    accent: "bg-[#f65858]",
  },
  {
    id: "noah",
    name: "Noah",
    initials: "NS",
    neighborhood: "Newtown",
    intent: "Creative circle",
    persona: "Creative Free-Spirit",
    bio: "Wants ordinary makers around a table: sketchbooks, side projects, brunch, and accountability.",
    tags: ["creative", "brunch", "newtown", "friends", "community"],
    matchReason: "Useful match for hobbies, making things, and becoming familiar through repetition.",
    nextEventId: "ordinary-creatives",
    accent: "bg-[#7edbd3]",
  },
  {
    id: "priya",
    name: "Priya",
    initials: "PN",
    neighborhood: "The Rocks",
    intent: "Career support",
    persona: "Mindful Achiever",
    bio: "Changing industries and looking for peers who want practical encouragement, not stiff networking.",
    tags: ["career", "confidence", "walk", "networking", "support"],
    matchReason: "Right fit for career-change support and walking conversations.",
    nextEventId: "career-walk",
    accent: "bg-[#5f6f52]",
  },
];

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

export const roleCards = [
  {
    title: "Regular users",
    eyebrow: "Attendees",
    body: "Create a profile, choose intent modes, take the Life Quiz, RSVP, save events, and Click privately on people.",
  },
  {
    title: "Merchants",
    eyebrow: "Event hosts",
    body: "Create events, choose Click-managed or external booking, manage attendees, and watch conversion by tag.",
  },
  {
    title: "Admins",
    eyebrow: "Platform managers",
    body: "Approve merchants, moderate events, govern tags, audit payments, and keep trust controls visible.",
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
    output: "Curious, cautious, ready, rebuilding confidence.",
  },
];

export const musicTags = [
  "Pop",
  "Rock",
  "Jazz",
  "Electronic",
  "House",
  "Hip Hop",
  "R&B",
  "Indie",
  "Folk",
  "Classical",
  "Reggae",
  "Soul",
  "Funk",
  "Latin",
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

export const dashboardSections = [
  ["Upcoming", "Confirmed RSVPs with unlocked location and attendee context."],
  ["Saved and waitlist", "Bookmarks, waitlist offers, and time-sensitive confirmations."],
  ["Click with Someone", "Three rotating compatibility cards refreshed every four hours."],
  ["Click Radar", "Nearby trending events with overlapping tags and privacy-safe nudges."],
  ["Suggested for You", "Events ranked by tags, persona, availability, and RSVP behavior."],
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

export const notificationRows = [
  ["RSVP confirmation", "Successful payment or free RSVP", "Email and in-app"],
  ["Waitlist promotion", "Spot opens", "Email with 15-minute confirmation"],
  ["Mutual Click", "Two private clicks match", "In-app event suggestion"],
  ["Soft nudge", "Potential match attends a saved event", "In-app banner"],
  ["Post-event feedback", "12 hours after event end", "In-app feedback card"],
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
