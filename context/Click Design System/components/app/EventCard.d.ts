import * as React from "react";
import { Person } from "../core/AvatarStack";

export type EventStatus = "free" | "almostfull" | "spots" | "trending" | "new" | "waitlist" | "soldout";

export interface EventCardProps {
  name: string;
  /** Venue name - revealed only when `booked` (the locked privacy rule). */
  venue?: string;
  suburb?: string;
  /** Distance label shown while locked, e.g. "1.4km". */
  dist?: string;
  /** Human date/time string, e.g. "Sat · 6:30pm". */
  when?: string;
  category?:
    | "ceramics"
    | "run"
    | "wine"
    | "cooking"
    | "music"
    | "art"
    | "wellness"
    | "trivia"
    | "outdoors"
    | "markets"
    | "coffee"
    | "workshops";
  categoryLabel?: string | null;
  /** Optional cover image; falls back to an abstract lavender panel (category is not colour-coded). */
  cover?: string | null;
  /** Up to 3 neutral interest tags render in the body; the rest collapse to "+N". */
  tags?: string[];
  going?: (string | Person)[];
  /** Override count if not passing the full `going` array. */
  goingCount?: number;
  /** The single coloured badge on the cover. Status colour lives ONLY here. */
  status?: EventStatus | null;
  /** Number for the "N spots left" status. */
  spotsLeft?: number | null;
  /** Price label, e.g. "$110". "Free"/"$0"/empty render the Sage "Free". */
  price?: string;
  /** Booked → reveals venue + CTA becomes the quiet "View details". */
  booked?: boolean;
  /** Joined the waitlist → CTA becomes the muted "Joined waitlist" (same footprint). */
  waitlisted?: boolean;
  saved?: boolean;
  onSave?: () => void;
  /** Footer CTA handler (RSVP / Join waitlist / View details). Falls back to onClick. */
  onCta?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * Event card - discovery, dashboard, landing & My Events.
 * Equal-height in a row; cover carries one status badge + Save; venue hidden
 * until booked; footer pins price (left) + CTA (right).
 * @startingPoint section="App" subtitle="Event card - venue-locked, status badge, footer CTA" viewport="380x380"
 */
export declare function EventCard(props: EventCardProps): React.JSX.Element;
