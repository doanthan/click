import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | null;
  helper?: string | null;
  iconLeft?: React.ReactNode;
  error?: boolean;
}

/** Labelled text input with lavender focus ring. */
export declare function Input(props: InputProps): React.JSX.Element;
