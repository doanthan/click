import * as React from "react";

export interface IntentLineProps {
  /** Lowercased intent label, e.g. "friends". */
  yourIntent?: string;
  /** Omit (or equal) for the same-intent variant. */
  theirIntent?: string | null;
  style?: React.CSSProperties;
}

/** Locked mutual-click intent line - both variants. */
export declare function IntentLine(props: IntentLineProps): React.JSX.Element;
