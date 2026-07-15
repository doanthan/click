import * as React from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string | null;
  helper?: string | null;
  options: (string | SelectOption)[];
}

/** Styled native select with chevron. */
export declare function Select(props: SelectProps): React.JSX.Element;
