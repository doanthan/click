import * as React from "react";

export interface TagProps {
  children: React.ReactNode;
  /** Selected state: Deep Purple fill + leading check (onboarding grids / filters only). */
  selected?: boolean;
  /** Dense 24px height (default 28px). */
  dense?: boolean;
  /** Force the selectable hover affordance even without onClick. */
  selectable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/** Interest / category chip - one neutral look everywhere; purple only when selected. */
export declare function Tag(props: TagProps): React.JSX.Element;
