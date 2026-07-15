import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /**
   * Visual style. Primary is flat deep purple - the only filled CTA.
   * `pending` ("clicked") and `mutual` ("clicked ✨") are the stateful
   * action-button treatments: they keep the SAME footprint as primary - only the
   * fill colour + label change, never a smaller pill. ✨ marks the mutual peak only.
   */
  variant?: "primary" | "secondary" | "ghost" | "onPurple" | "pending" | "mutual";
  size?: "sm" | "md" | "lg";
  /** Stretch to fill container width. */
  full?: boolean;
  disabled?: boolean;
  /** Spinner replaces the label, width held, interaction blocked, aria-busy set. */
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Click's primary action button.
 * @startingPoint section="Core" subtitle="Buttons - primary, secondary, ghost" viewport="700x150"
 */
export declare function Button(props: ButtonProps): React.JSX.Element;
