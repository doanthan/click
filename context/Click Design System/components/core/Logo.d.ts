import * as React from "react";

export interface LogoProps {
  /** Font size of the wordmark in px. */
  size?: number;
  /** Reverse for dark/purple grounds (cream wordmark). */
  cream?: boolean;
  style?: React.CSSProperties;
}

export interface SparkProps {
  size?: number;
  /** Defaults to lavender - the brand rule is to keep the spark lavender. */
  color?: string;
  style?: React.CSSProperties;
}

export interface CmarkProps {
  size?: number;
  /** Colour of the `c` letterform. */
  cColor?: string;
  /** Colour of the nested sparkle pair (default lavender). */
  accent?: string;
  style?: React.CSSProperties;
}

export interface AppTileProps {
  size?: number;
  bg?: string;
  cColor?: string;
  accent?: string;
  style?: React.CSSProperties;
}

/**
 * The Click wordmark - lowercase `click` in Poppins SemiBold, the i-dot set as
 * the lavender sparkle pair. The everyday brand signature.
 * @startingPoint section="Brand" subtitle="Wordmark, c-mark, spark & app icon" viewport="700x280"
 */
export declare function Logo(props: LogoProps): React.JSX.Element;

/** The sparkle pair - a large glint and a small companion. The one spot of lavender. */
export declare function Spark(props: SparkProps): React.JSX.Element;

/** The bare `c` letterform cradling the sparkle pair - app icon, favicon, avatar. */
export declare function Cmark(props: CmarkProps): React.JSX.Element;

/** The c-mark on a deep-purple squircle - the app/home-screen icon. */
export declare function AppTile(props: AppTileProps): React.JSX.Element;
