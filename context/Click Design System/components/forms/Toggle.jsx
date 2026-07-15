import React from "react";

/**
 * Toggle switch - the visibility control ("Show me in event attendee lists")
 * and other on/off settings. Purple when on, with an optional locked helper.
 */
export function Toggle({ checked = false, onChange = () => {}, label = null, helper = null, disabled = false, style = {} }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "13px",
        fontFamily: "var(--font-sans)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span
        onClick={() => !disabled && onChange(!checked)}
        style={{
          flex: "none",
          width: 46,
          height: 28,
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--accent)" : "var(--sand-300)",
          position: "relative",
          transition: "background .18s ease",
          marginTop: 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--white)",
            boxShadow: "var(--shadow-sm)",
            transition: "left .18s cubic-bezier(.3,.7,.4,1)",
          }}
        />
      </span>
      {(label || helper) && (
        <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {label && <span style={{ fontSize: "14.5px", fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.3 }}>{label}</span>}
          {helper && <span style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.45, maxWidth: 360 }}>{helper}</span>}
        </span>
      )}
    </label>
  );
}
