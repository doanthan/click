import * as React from "react";

export interface StatCardProps {
  /** Overline label, e.g. "Confirmed RSVPs". */
  label: string;
  /** The big number/value, e.g. "13" or "$434". Never "Free" - use "$0" + a note. */
  value: string;
  /** Period/context scope, e.g. "July · paid events". Strongly encouraged. */
  note?: string | null;
  /** Deep-Purple emphasis tile - max ONE per stat row. */
  hero?: boolean;
  style?: React.CSSProperties;
}

/**
 * Merchant KPI tile - period-scoped stats for the hosting dashboard and finances.
 * @startingPoint section="Merchant" subtitle="KPI tile - hero + plain, period-scoped note" viewport="240x110"
 */
export declare function StatCard(props: StatCardProps): React.JSX.Element;
