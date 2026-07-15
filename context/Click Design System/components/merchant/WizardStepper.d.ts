import * as React from "react";

export interface WizardStepperProps {
  /** Step labels in order, e.g. ["Basics","When & where","Tickets","Review"]. */
  steps: string[];
  /** 0-indexed current step. */
  current: number;
  /** Click handler for COMPLETED steps only (jump back to edit). */
  onStep?: ((index: number) => void) | null;
  /** Hide labels on narrow layouts (dots + lines only). */
  showLabels?: boolean;
  style?: React.CSSProperties;
}

/**
 * Numbered wizard progress - sage checks for done, purple for current.
 * @startingPoint section="Merchant" subtitle="Wizard stepper - multi-step flows" viewport="560x60"
 */
export declare function WizardStepper(props: WizardStepperProps): React.JSX.Element;
