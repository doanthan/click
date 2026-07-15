import * as React from "react";

export interface CapacityMeterProps {
  /** Confirmed bookings. */
  confirmed: number;
  /** Event capacity. */
  cap: number;
  /** Max bar width in px (default 96). */
  maxWidth?: number;
  style?: React.CSSProperties;
}

/**
 * Capacity count + slim fill bar; Coral above 85% full, otherwise Purple.
 * @startingPoint section="Merchant" subtitle="Capacity meter - coral when nearly full" viewport="160x60"
 */
export declare function CapacityMeter(props: CapacityMeterProps): React.JSX.Element;
