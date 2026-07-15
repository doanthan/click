import * as React from "react";

export interface ToggleProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string | null;
  /** Helper text - e.g. the locked visibility consequence string. */
  helper?: string | null;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** On/off switch - purple when on. Used for the visibility toggle. */
export declare function Toggle(props: ToggleProps): React.JSX.Element;
