import React from "react";

/**
 * Text input with optional label, helper and leading icon. Cream-white field,
 * lavender focus ring. Used in waitlist forms, search, profile setup.
 */
export function Input({
  label = null,
  helper = null,
  iconLeft = null,
  error = false,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? "in-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px", fontFamily: "var(--font-sans)" }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>
          {label}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          background: "var(--white)",
          border: "1.5px solid " + (error ? "var(--error)" : focus ? "var(--lavender-400)" : "var(--border-mid)"),
          borderRadius: "var(--radius-md)",
          padding: "0 14px",
          boxShadow: focus ? "0 0 0 4px color-mix(in srgb, var(--lavender-400) 22%, transparent)" : "var(--shadow-xs)",
          transition: "border-color .15s ease, box-shadow .15s ease",
        }}
      >
        {iconLeft && <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>{iconLeft}</span>}
        <input
          id={inputId}
          onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            padding: "12px 0",
            fontFamily: "var(--font-sans)",
            fontSize: "15px",
            color: "var(--text-strong)",
            minWidth: 0,
            ...style,
          }}
          {...rest}
        />
      </div>
      {helper && (
        <span style={{ fontSize: "12.5px", color: error ? "var(--error)" : "var(--text-muted)" }}>{helper}</span>
      )}
    </div>
  );
}
