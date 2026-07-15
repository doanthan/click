import * as React from "react";

export type MerchantStatus =
  | "live" | "ended" | "pending" | "cancelled"
  | "confirmed" | "waitlist" | "draft" | "paid" | "refunded";

export interface StatusPillProps {
  /** Merchant status key - events (live/ended/pending/cancelled/draft), bookings (confirmed/waitlist/cancelled), money (paid/refunded). */
  status: MerchantStatus;
  style?: React.CSSProperties;
}

/**
 * The single status vocabulary for merchant surfaces; wraps core Badge tones.
 * @startingPoint section="Merchant" subtitle="Status pill - events, bookings, money" viewport="140x44"
 */
export declare function StatusPill(props: StatusPillProps): React.JSX.Element;
