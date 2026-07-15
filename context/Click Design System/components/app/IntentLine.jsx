import React from "react";

/**
 * Intent line - the locked legibility guarantee shown on every mutual click and
 * on the meeting-point screen. Two variants: equal intents and different
 * intents (the "they're open to" framing states the other's intent without
 * pressure). Never force symmetry.
 */
export function IntentLine({ yourIntent = "friends", theirIntent = null, style = {} }) {
  const equal = !theirIntent || theirIntent === yourIntent;
  return (
    <p
      style={{
        margin: 0,
        fontFamily: "var(--font-sans)",
        fontSize: "14.5px",
        fontWeight: 500,
        lineHeight: 1.45,
        color: "var(--text-body)",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        background: "var(--lavender-100)",
        borderRadius: "var(--radius-pill)",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "15px" }}>✨</span>
      {equal ? (
        <span>You're both here for <b style={{ color: "var(--purple-700)", fontWeight: 700 }}>{yourIntent}</b>.</span>
      ) : (
        <span>
          You're here for <b style={{ color: "var(--purple-700)", fontWeight: 700 }}>{yourIntent}</b> · they're open to <b style={{ color: "var(--purple-700)", fontWeight: 700 }}>{theirIntent}</b>.
        </span>
      )}
    </p>
  );
}
