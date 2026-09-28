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
// someone. Life tags never feed this: the life quiz stores sensitive answers
// under the same tag_type and there is no way to tell a light one apart.
export const FOMO_FLOOR = 3;

export type AttendeeFomoInput = {
  // Seats taken by people going - getEventAttendeePreview's totalConfirmed.
  confirmed: number;
  topSharedInterest: { label: string; count: number } | null;
  datingCount: number;
  viewerOpenToDating: boolean;
  // The radar's "N going so far" when nothing more specific applies. The event
  // page already prints its own headcount, so it leaves this off.
  countFallback?: boolean;
};

export function attendeeFomoSignals({
  confirmed,
  topSharedInterest,
  datingCount,
  viewerOpenToDating,
  countFallback = false,
}: AttendeeFomoInput): string[] {
  const signals: string[] = [];
  if (confirmed >= FOMO_FLOOR) {
    if (topSharedInterest && topSharedInterest.count > 0) {
      signals.push(
        topSharedInterest.count === 1
          ? `1 person going also likes ${topSharedInterest.label}`
          : `${topSharedInterest.count} going also like ${topSharedInterest.label}`,
      );
    }
    if (viewerOpenToDating && datingCount >= FOMO_FLOOR) {
      signals.push(`${datingCount} open to dating`);
    }
  }
  if (signals.length === 0 && countFallback && confirmed > 0) {
    signals.push(confirmed === 1 ? "1 person going so far" : `${confirmed} going so far`);
  }
  return signals;
}
