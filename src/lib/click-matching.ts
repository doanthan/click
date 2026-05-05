import type { EventItem, PeopleRecommendation } from "./click-data";

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
  "people",
]);

export function queryTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2 && !queryStopWords.has(term));
}

export function scoreEvent(event: EventItem, query: string) {
  const terms = queryTerms(query);
  const haystack = [
    event.title,
    event.group,
    event.category,
    event.location,
    event.description,
    event.relationshipGoal,
    event.fomo,
    ...event.tags,
    ...event.lifeSignals,
  ]
    .join(" ")
    .toLowerCase();

  const exactMatches = terms.filter((term) => haystack.includes(term)).length;
  const friendBoost =
    terms.some((term) =>
      ["friend", "friends", "lonely", "new", "mate", "mates"].includes(term),
    ) && event.tags.some((tag) => ["friends", "community", "new to town"].includes(tag))
      ? 4
      : 0;
  const fitnessBoost =
    terms.some((term) =>
      ["crossfit", "fitness", "gym", "workout", "training", "strong"].includes(term),
    ) && event.category === "Fitness"
      ? 5
      : 0;
  const relationshipBoost =
    terms.some((term) =>
      ["date", "dating", "relationship", "relationships", "single", "singles"].includes(term),
    ) && event.category === "Relationships"
      ? 5
      : 0;
  const momentum = event.attendees / event.capacity;

  return exactMatches + friendBoost + fitnessBoost + relationshipBoost + momentum;
}

export function scorePerson(person: PeopleRecommendation, query: string) {
  const terms = queryTerms(query);
  const haystack = [
    person.name,
    person.neighborhood,
    person.intent,
    person.persona,
    person.bio,
    person.matchReason,
    ...person.tags,
  ]
    .join(" ")
    .toLowerCase();

  const exactMatches = terms.filter((term) => haystack.includes(term)).length;
  const friendBoost =
    terms.some((term) =>
      ["friend", "friends", "lonely", "new", "mate", "mates"].includes(term),
    ) && person.tags.some((tag) => ["friends", "community", "new to town"].includes(tag))
      ? 5
      : 0;
  const fitnessBoost =
    terms.some((term) =>
      ["crossfit", "fitness", "gym", "workout", "training", "strong"].includes(term),
    ) && person.tags.includes("crossfit")
      ? 6
      : 0;
  const relationshipBoost =
    terms.some((term) =>
      ["date", "dating", "relationship", "relationships", "single", "singles"].includes(term),
    ) && person.tags.includes("relationships")
      ? 6
      : 0;

  return exactMatches + friendBoost + fitnessBoost + relationshipBoost;
}

export function categoryFromPrompt(prompt: string) {
  const lower = prompt.toLowerCase();

  if (lower.includes("crossfit") || lower.includes("fitness")) return "Fitness";
  if (lower.includes("dating") || lower.includes("relationship")) return "Relationships";
  if (lower.includes("coffee") || lower.includes("dinner") || lower.includes("brunch")) {
    return "Food";
  }
  if (lower.includes("career") || lower.includes("business")) return "Career";
  if (lower.includes("creative") || lower.includes("making")) return "Creative";
  return "All";
}

export function formatCapacity(event: EventItem) {
  const remaining = Math.max(event.capacity - event.attendees, 0);
  if (event.status === "Locked") return "RSVP to unlock";
  if (remaining === 0 || event.status === "Waitlist") return "Waitlist open";
  return `${remaining} spots left`;
}
