import React from "react";

/**
 * CapacityMeter - "confirmed / cap" count with a slim fill bar. The single way
 * capacity renders across the merchant portal (event tables, dashboard cards).
 * Fill turns Coral above 85% (nearly full), otherwise Purple.
 */
export function CapacityMeter({ confirmed = 0, cap = 0, maxWidth = 96, style = {} }) {
  const pct = cap > 0 ? Math.min(100, Math.round((confirmed / cap) * 100)) : 0;
  const hue = cap > 0 && confirmed / cap > 0.85 ? "var(--coral)" : "var(--purple-500)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, fontFamily: "var(--font-sans)", ...style }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>{confirmed} / {cap}</span>
      <span style={{ display: "block", width: "100%", maxWidth, height: 5, borderRadius: 3, background: "var(--lavender-100)" }}>
        <span style={{ display: "block", width: pct + "%", height: "100%", borderRadius: 3, background: hue }} />
      </span>
    </div>
  );
}
