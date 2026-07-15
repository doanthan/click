import React from "react";

/**
 * StatCard - merchant portal KPI tile. One hero (Deep Purple) tile per row max;
 * the rest are plain white. Always period-scoped via `note` (never a bare number).
 */
export function StatCard({ label = "", value = "", note = null, hero = false, style = {} }) {
  const base = hero
    ? { background: "var(--purple-600)", border: "1px solid var(--purple-600)" }
    : { background: "var(--white)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)" };
  return (
    <div style={{ ...base, borderRadius: "var(--radius-lg)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 5, minWidth: 0, fontFamily: "var(--font-sans)", ...style }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: hero ? "var(--lavender-300)" : "var(--text-faint)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 600, lineHeight: 1.05, color: hero ? "var(--cream)" : "var(--text-strong)" }}>{value}</span>
      {note && <span style={{ fontSize: 12, color: hero ? "rgba(253,250,246,.75)" : "var(--text-muted)" }}>{note}</span>}
    </div>
  );
}
