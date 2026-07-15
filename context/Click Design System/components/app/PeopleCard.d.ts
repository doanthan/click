import * as React from "react";

export interface PeopleCardProps {
  /** First name only - surnames and age are never shown on the card (age lives on the profile drawer). */
  name: string;
  src?: string | null;
  /** Intent label, rendered sentence-case (e.g. "here for friends"). */
  intent?: string | null;
  /** A genuinely shared event. Wins over `overlap`. NEVER fabricate one. */
  sharedEvent?: string | null;
  /** The interest overlap, e.g. "pottery & live music". Shown when there's no shared event. */
  overlap?: string | null;
  /** Shared interest tags (row shows up to 4, stack up to 3, then +N). */
  tags?: string[];
  /** One control across states - same footprint, only fill + label change. Pending = muted "clicked" (no ✨); mutual = Sage "clicked ✨". */
  state?: "default" | "pending" | "mutual" | "loading";
  /** Row = one-per-line (desktop); stack = vertical card (mobile). */
  layout?: "row" | "stack";
  /** Fires the click; render the parent in `pending` after. */
  onClick?: () => void;
  /** Opens the profile drawer (never page navigation). */
  onView?: () => void;
  style?: React.CSSProperties;
}

/**
 * The canonical "person you can click with" card - face + real overlap + one
 * intention. Reused on the people page, dashboard, and profile-drawer header.
 * @startingPoint section="App" subtitle="People card - the click-with-someone card, all states" viewport="760x300"
 */
export declare function PeopleCard(props: PeopleCardProps): React.JSX.Element;
