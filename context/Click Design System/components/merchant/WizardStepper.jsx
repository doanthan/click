import React from "react";

/**
 * WizardStepper - numbered progress dots joined by hairlines, used by merchant
 * multi-step flows (become a host, create event). Completed steps turn Sage
 * with a check and become clickable; the current step is Deep Purple.
 */
export function WizardStepper({ steps = [], current = 0, onStep = null, showLabels = true, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", ...style }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && <span style={{ flex: 1, height: 1.5, background: i <= current ? "var(--purple-400)" : "var(--border-mid)" }} />}
          <button
            onClick={() => onStep && i < current && onStep(i)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", padding: 0, cursor: onStep && i < current ? "pointer" : "default" }}
          >
            <span style={{ width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i < current ? "var(--sage)" : i === current ? "var(--purple-600)" : "var(--white)", color: i <= current ? "#fff" : "var(--text-muted)", border: i > current ? "1.5px solid var(--border-mid)" : "none" }}>
              {i < current
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                : i + 1}
            </span>
            {showLabels && <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: i === current ? "var(--purple-700)" : "var(--text-faint)" }}>{s}</span>}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
