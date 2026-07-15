import * as React from "react";

export interface Person {
  name: string;
  src?: string | null;
}

export interface AvatarStackProps {
  /** First names or {name, src} objects. */
  people: (string | Person)[];
  max?: number;
  size?: number;
  /** Trailing label, e.g. "12 going". */
  label?: string | null;
  style?: React.CSSProperties;
}

/** Overlapping avatar cluster + count - Who's-going social proof. */
export declare function AvatarStack(props: AvatarStackProps): React.JSX.Element;
