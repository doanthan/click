import React from "react";

/**
 * Select / dropdown - e.g. the suburb dropdown on the waitlist form. Styled
 * native select with a chevron, matching Input's field treatment.
 */
export function Select({ label = null, helper = null, options = [], id, style = {}, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || (label ? "sel-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px", fontFamily: "var(--font-sans)" }}>
      {label && (
        <label htmlFor={selId} style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>
          {label}
        </label>
      )}
      <div
        style={{
          position: "relative",
          background: "var(--white)",
          border: "1.5px solid " + (focus ? "var(--lavender-400)" : "var(--border-mid)"),
          borderRadius: "var(--radius-md)",
          boxShadow: focus ? "0 0 0 4px color-mix(in srgb, var(--lavender-400) 22%, transparent)" : "var(--shadow-xs)",
          transition: "border-color .15s ease, box-shadow .15s ease",
        }}
      >
        <select
          id={selId}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: "100%",
            appearance: "none",
            WebkitAppearance: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            padding: "13px 40px 13px 14px",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "var(--text-strong)",
            cursor: "pointer",
            ...style,
          }}
          {...rest}
        >
          {options.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const lab = typeof o === "string" ? o : o.label;
            return (
              <option key={val} value={val}>
                {lab}
              </option>
            );
          })}
        </select>
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </div>
      {helper && <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>{helper}</span>}
    </div>
  );
}
