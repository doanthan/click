import React from "react";
import { Badge } from "../core/Badge.jsx";

/* Canonical merchant status → Badge tone map. Sage = live/money-good, Amber =
   waiting states, Coral = cancelled, Lavender = confirmed bookings, neutral = past. */
const MAP = {
  live: ["sage", "Live"],
  ended: ["cream", "Ended"],
  pending: ["amber", "Pending"],
  cancelled: ["coral", "Cancelled"],
  confirmed: ["lavender", "Confirmed"],
  waitlist: ["amber", "Waitlist"],
  draft: ["cream", "Draft"],
  paid: ["sage", "Paid"],
  refunded: ["cream", "Refunded"],
};

/**
 * StatusPill - the single status vocabulary for merchant surfaces (events,
 * bookings, transactions). Wraps core Badge so tones stay consistent.
 */
export function StatusPill({ status = "live", style = {} }) {
  const [tone, label] = MAP[status] || ["cream", status];
  return <Badge tone={tone} style={style}>{label}</Badge>;
}
