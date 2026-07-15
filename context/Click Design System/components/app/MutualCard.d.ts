import * as React from "react";

export interface MutualCardProps {
  /** Other person's first name. */
  name: string;
  src?: string | null;
  /** Shared event name. */
  event?: string;
  yourIntent?: string;
  /** Both parties opened to dating → appends "· both open to dating" to the intent line. */
  dating?: boolean;
  /** Up to 2 shared-interest tags (neutral pills). */
  tags?: string[];
  /** preEvent → "you're both going to"; postEvent → "you were both at". */
  variant?: "preEvent" | "postEvent";
  ctaLabel?: string | null;
  onCta?: () => void;
  onDecline?: () => void;
  style?: React.CSSProperties;
}

/**
 * The "You clicked with each other" payoff card.
 * @startingPoint section="App" subtitle="Mutual-click payoff notification" viewport="400x440"
 */
export declare function MutualCard(props: MutualCardProps): React.JSX.Element;
