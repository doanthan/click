import React from "react";

/**
 * Tag - interest / category chip. ONE neutral look on every surface (true-white
 * fill, Mist-strong #DDD7EA hairline, Ink text, NO dot) so a tag always reads as a
 * tag and lifts off the warm cream canvas. The only time
 * a tag goes purple is when `selected` (Deep Purple fill + leading check) - used
 * in onboarding grids and filters. Status colour NEVER appears on a tag - that
 * lives on Badge. Pill shape + ~28px height keep it visibly lighter than a button.
 */
export function Tag({
  children,
  selected = false,
  dense = false,
  selectable = false,
  style = {},
  ...rest
}) {
  const interactive = selectable || rest.onClick;
  const cls = ["ck-tag", interactive && !selected ? "ck-tag--select" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={cls}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        height: (dense && !selected) ? "22px" : "24px",
        padding: dense ? "0 8px" : "0 10px",
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        background: selected ? "var(--purple-600)" : "var(--white)",
        color: selected ? "var(--cream)" : "var(--ink)",
        border: "1px solid " + (selected ? "transparent" : "var(--mist-strong)"),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
