import React from "react";

/**
 * Badge - the ONLY place status colour lives. A rounded RECTANGLE (radius ~8px),
 * so it can never be mistaken for a pill Tag now that tags carry no dot. Status
 * text on a soft tint of the same hue. Used for event status - "Almost full",
 * "New", "You're going", "Sold out", date pills on imagery. Never a CTA, and never
 * the click state (pending/mutual live on the action button, not a badge).
 */
export function Badge({ children, tone = "neutral", icon = null, style = {} }) {
  const tones = {
    neutral: { background: "var(--sand-100)", color: "var(--text-body)" },
    purple: { background: "var(--purple-600)", color: "var(--cream)" },
    lavender: { background: "var(--lavender-100)", color: "var(--purple-700)" },
    coral: { background: "color-mix(in srgb, var(--coral) 12%, var(--white))", color: "var(--coral)" },
    amber: { background: "color-mix(in srgb, var(--amber) 16%, var(--white))", color: "#a86f12" },
    sage: { background: "color-mix(in srgb, var(--sage) 14%, var(--white))", color: "var(--sage)" },
    teal: { background: "color-mix(in srgb, var(--teal) 12%, var(--white))", color: "var(--teal)" },
    onImage: { background: "rgba(28,24,48,0.62)", color: "var(--white)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        height: "24px",
        padding: "0 8px",
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "0.005em",
        borderRadius: "8px",
        boxSizing: "border-box",
        whiteSpace: "nowrap",
        ...t,
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
