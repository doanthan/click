import React from "react";

/* No-photo placeholder palette - soft lavender disc + a deeper purple glyph/initial.
   A few tonal pairs so a stack of placeholders isn't monotonous. Flat, on-brand. */
const PLACEHOLDER = [
  ["var(--lavender-200)", "var(--purple-500)"],
  ["#E7DEFA", "var(--purple-600)"],
  ["var(--lavender-100)", "var(--purple-400)"],
  ["#EDE6FB", "var(--purple-500)"],
];

function initials(name = "") {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/**
 * Avatar - a person at an event. If `src` is given it shows the photo; otherwise
 * it falls back to the no-photo PLACEHOLDER: a flat person silhouette on a soft
 * lavender disc (fits Click's anonymous-until-mutual feel). Pass variant="initials"
 * for a monogram instead of the silhouette. Always round; first name only in social
 * surfaces (the product never shows surnames).
 */
export function Avatar({ name = "", src = null, size = 40, ring = false, variant = "silhouette", style = {} }) {
  const [bg, fg] = PLACEHOLDER[(name.charCodeAt(0) || 0) % PLACEHOLDER.length];
  const common = {
    width: size,
    height: size,
    borderRadius: "50%",
    flex: "none",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
    boxShadow: ring ? "0 0 0 2.5px var(--white), 0 0 0 4px var(--lavender-300)" : (style.boxShadow || "none"),
  };

  if (src) {
    return (
      <div style={{ ...common, background: "var(--sand-100)" }}>
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }

  if (variant === "initials" && name) {
    return (
      <div style={{ ...common, background: bg, color: fg, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: size * 0.36, letterSpacing: "0.01em" }}>
        {initials(name)}
      </div>
    );
  }

  return (
    <div style={{ ...common, background: bg }} role="img" aria-label={name ? `${name} - no photo yet` : "No photo yet"}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill={fg} aria-hidden="true">
        <circle cx="12" cy="8.6" r="4" />
        <path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7z" />
      </svg>
    </div>
  );
}
