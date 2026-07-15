import * as React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  tone?: "neutral" | "purple" | "lavender" | "coral" | "amber" | "sage" | "teal" | "onImage";
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Small status / marker label. */
export declare function Badge(props: BadgeProps): React.JSX.Element;
