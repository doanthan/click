import * as React from "react";

export interface AvatarProps {
  /** First name (surnames are never shown in social surfaces). */
  name?: string;
  src?: string | null;
  /** Pixel diameter. */
  size?: number;
  /** Lavender ring (e.g. a mutual click). */
  ring?: boolean;
  /** No-photo fallback look: "silhouette" (default, person glyph) or "initials" (monogram). */
  variant?: "silhouette" | "initials";
  style?: React.CSSProperties;
}

/** Round person avatar - photo if `src`, else a flat no-photo placeholder (silhouette / initials). */
export declare function Avatar(props: AvatarProps): React.JSX.Element;
