import React from "react";

/**
 * Click's action control. Filled Deep Purple = primary (the ONLY filled CTA);
 * secondary / ghost step down. States (hover / pressed / focus-visible / disabled
 * / loading) are REAL CSS - see components.css - so every button behaves the same
 * on mouse, touch and keyboard. Flat purple: never a glow or gradient.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  loading = false,
  iconLeft = null,
  iconRight = null,
  className = "",
  style = {},
  ...rest
}) {
  const cls = [
    "ck-btn",
    "ck-btn--" + variant,
    "ck-btn--" + size,
    full ? "ck-btn--full" : "",
    loading ? "ck-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      style={style}
      {...rest}
    >
      <span className="ck-btn__label">
        {iconLeft}
        {children}
        {iconRight}
      </span>
      {loading && <span className="ck-btn__spinner" aria-hidden="true" />}
    </button>
  );
}
