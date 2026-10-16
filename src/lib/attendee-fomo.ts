// The aggregate "who's going" lines: counts only, never a name or a face, so they
// can sit on an event page for someone who has not booked yet and on the click
// radar. ONE builder for every surface that prints them - the event page's Who's
// going (bug board #236/#258) and the dashboard and /people radars (#172) - so a
// line can no longer exist on one surface and not on another.
//
// The DS privacy rails (context/Click Design System/README.md, event detail and
// radar; docs/Click_Design_Prompt_Dashboard.md): nothing about WHAT the people
// going are like until three are going, and the romantic line only to a viewer
// who is open to dating themselves, and only once three going are. Below the
// floor, "1 person going also likes Hiking" next to a two-person room points at
// someone. Life tags never feed these lines - with one deliberate exception, the
// belonging signal below (08 §4.4a), which is computed apart from them.
export const FOMO_FLOOR = 3;

/** 09 §9 rule 2: the shared-interest line needs at least this many attendees
 *  sharing the tag - "1 person going also likes X" points at someone. */
export const SHARED_INTEREST_MIN = 2;

/** 09 §10 Dimension 3: confirmed bookings in the last 24 hours, capped at 10,
 *  as 0-100. Test bookings never count (the caller's query excludes them). */
export function trendingScore(recentBookings: number): number {
  if (!Number.isFinite(recentBookings) || recentBookings <= 0) return 0;
  return Math.min(recentBookings / 10, 1) * 100;
}

/** 09 §13: "Trending near you" shows only at a trending_score of 80 or more. */
export const TRENDING_LINE_MIN_SCORE = 80;
export const TRENDING_LINE = "Trending near you";

/** 08 §4.4a: shown only to a viewer who holds the identity tag, only once 4 OTHER
 *  confirmed attendees hold it too - never a number, never who. */
export const BELONGING_MIN_OTHERS = 4;
export const BELONGING_LINE =
  "You're not the only one - others from the LGBTQ+ community are going too.";

/** An age's decade for the crowd line (30 for 34), or null under twenty - nobody
 *  says "in their 10s", and 18-19 is two years, not a crowd. */
export function decadeOf(age: number | null | undefined): number | null {
  if (age == null || !Number.isFinite(age) || age < 20) return null;
  return Math.floor(age / 10) * 10;
}

/** The decade most of the room is in: at least FOMO_FLOOR people, and more than
 *  half of everyone whose age is known. Null when no decade holds the room. */
export function majorityDecade(ages: Array<number | null | undefined>): number | null {
  const counts = new Map<number, number>();
  let known = 0;
  for (const age of ages) {
    if (age == null || !Number.isFinite(age)) continue;
    known += 1;
    const decade = decadeOf(age);
    if (decade != null) counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  // A strict majority can only belong to one decade, so the first hit is it.
  for (const [decade, count] of counts) {
    if (count >= FOMO_FLOOR && count * 2 > known) return decade;
  }
  return null;
}

export type AttendeeFomoInput = {
  // Seats taken by people going - getEventAttendeePreview's totalConfirmed.
  confirmed: number;
  topSharedInterest: { label: string; count: number } | null;
  datingCount: number;
  viewerOpenToDating: boolean;
  // The room's majorityDecade and the viewer's own decade. The age line shows
  // only when they match: "if you're in your 30s... mostly in their 30s" (the
  // click-mechanic Loom, 2026-09-30) - a reason to come, never a warning off.
  crowdDecade?: number | null;
  viewerDecade?: number | null;
  // The radar's "N going so far" when nothing more specific applies. The event
  // page already prints its own headcount, so it leaves this off.
  countFallback?: boolean;
  // trendingScore() of the event, for the radar's "Trending near you" line.
  trending?: number;
  // The viewer holds the identity tag and BELONGING_MIN_OTHERS others going do
  // too (computed server-side for this viewer only). Event page only.
  belonging?: boolean;
};

export function attendeeFomoSignals({
  confirmed,
  topSharedInterest,
  datingCount,
  viewerOpenToDating,
  crowdDecade = null,
  viewerDecade = null,
  countFallback = false,
  trending = 0,
  belonging = false,
}: AttendeeFomoInput): string[] {
  const signals: string[] = [];
  // Nothing at all below the floor (09 §9 privacy rails) - not a social line,
  // not a count. `confirmed` is the viewer's side of the test line only.
  if (confirmed >= FOMO_FLOOR) {
    if (topSharedInterest && topSharedInterest.count >= SHARED_INTEREST_MIN) {
      signals.push(`${topSharedInterest.count} going also like ${topSharedInterest.label}`);
    }
    // Its own line, not a tail on the interest one: the decade is the whole
    // room's, and "5 going also like Plants - mostly in their 30s" would pin it
    // on the five.
    if (crowdDecade != null && crowdDecade === viewerDecade) {
      signals.push(`Most going are in their ${crowdDecade}s`);
    }
    // The DS line (event detail, "A few singles are going"): no count, still
    // only for a viewer open to dating themselves and only from the floor.
    if (viewerOpenToDating && datingCount >= FOMO_FLOOR) {
      signals.push("A few singles are going");
    }
    // 08 §4.4a. No number in it, and the caller only sets it for a viewer who
    // holds the tag themselves.
    if (belonging) signals.push(BELONGING_LINE);
    // The lowest-priority social line (09 §9 rule 6, §13): booking velocity,
    // and only when nothing above applies. Never a city name (14.6).
    if (signals.length === 0 && trending >= TRENDING_LINE_MIN_SCORE) {
      signals.push(TRENDING_LINE);
    }
    if (signals.length === 0 && countFallback) signals.push(`${confirmed} going so far`);
  }
  return signals;
}
