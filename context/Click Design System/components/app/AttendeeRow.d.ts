import * as React from "react";

export interface AttendeeRowProps {
  /** First name only - surnames are never shown. */
  name: string;
  src?: string | null;
  /** Intent label, e.g. "here for friends". */
  intent?: string | null;
  /** Shared interest tags (up to 3 shown). */
  tags?: string[];
  /** Quiet post-click state. */
  clicked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** A person on the Who's-going / Who-was-there list with a "Click with" action. */
export declare function AttendeeRow(props: AttendeeRowProps): React.JSX.Element;
