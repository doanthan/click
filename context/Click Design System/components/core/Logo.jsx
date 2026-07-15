import React from "react";

/* Click - brand marks (Brand Package). Poppins wordmark with a lavender
   sparkle-pair i-dot, the bare 'c' letterform icon, and the standalone double
   spark. Keep the spark lavender; keep it singular; give it room. */

const LAV = "var(--lavender-300)";
const WORDMARK_FONT = "var(--font-wordmark, 'Poppins', sans-serif)";

function spkD(cx, cy, r, opt = {}) {
  const top = (opt.top || 1) * r, right = (opt.right || 1) * r, bot = (opt.bottom || 1) * r, left = (opt.left || 1) * r;
  const w = opt.w == null ? 0.46 : opt.w, p = opt.p == null ? 0.065 : opt.p;
  const n = (v) => Math.round(v * 100) / 100;
  return `M${n(cx)} ${n(cy - top)} C${n(cx + p * right)} ${n(cy - w * top)} ${n(cx + w * right)} ${n(cy - p * top)} ${n(cx + right)} ${n(cy)} C${n(cx + w * right)} ${n(cy + p * bot)} ${n(cx + p * right)} ${n(cy + w * bot)} ${n(cx)} ${n(cy + bot)} C${n(cx - p * left)} ${n(cy + w * bot)} ${n(cx - w * left)} ${n(cy + p * bot)} ${n(cx - left)} ${n(cy)} C${n(cx - w * left)} ${n(cy - p * top)} ${n(cx - p * left)} ${n(cy - w * top)} ${n(cx)} ${n(cy - top)} Z`;
}

/**
 * Spark - the brand signature: a large glint and a small companion drifting
 * up-right. The single spot of lavender. Use it at genuine payoff moments.
 */
export function Spark({ size = 24, color = LAV, style = {} }) {
  const off = 0.75, sx = 50 + (82 - 50) * off, sy = 50 + (32 - 50) * off;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flex: "none", ...style }} aria-hidden="true">
      <path d={spkD(46, 66, 34, { w: 0.44 })} fill={color} />
      <path d={spkD(sx, sy, 13, { w: 0.40 })} fill={color} />
    </svg>
  );
}

/**
 * Logo - the primary wordmark. Lowercase `click` in Poppins SemiBold; the i-dot
 * is the sparkle pair. The everyday signature - use it wherever space allows.
 */
export function Logo({ size = 28, cream = false, style = {} }) {
  const col = cream ? "var(--cream)" : "var(--purple-600)";
  const sp = Math.round(size * 0.40), gap = Math.round(size * -0.34);
  return (
    <span aria-label="click" style={{ fontFamily: WORDMARK_FONT, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap", fontSize: size, color: col, ...style }}>
      <span>cl</span>
      <span style={{ position: "relative", display: "inline-block" }}>
        {"\u0131"}
        <span style={{ position: "absolute", left: "50%", bottom: `calc(100% + ${gap}px)`, transform: "translateX(-42%)" }}><Spark size={sp} /></span>
      </span>
      <span>ck</span>
    </span>
  );
}

/**
 * Cmark - the bare `c` letterform cradling the sparkle pair in its aperture.
 * The basis for the app icon, favicon and avatar. Holds down to 16px.
 */
export function Cmark({ size = 40, cColor = "var(--purple-600)", accent = LAV, style = {} }) {
  return (
    <span aria-label="Click" style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontSize: size, ...style }}>
      <span style={{ fontFamily: WORDMARK_FONT, fontWeight: 600, fontSize: "1em", color: cColor, letterSpacing: "-0.02em" }}>c</span>
      <span style={{ position: "absolute", left: "0.47em", top: "0.11em", width: "0.34em", height: "0.34em", lineHeight: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d={spkD(50, 50, 44)} fill={accent} /></svg>
      </span>
      <span style={{ position: "absolute", left: "0.71em", top: "-0.1em", width: "0.15em", height: "0.15em", lineHeight: 0 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d={spkD(50, 50, 44, { w: 0.40 })} fill={accent} /></svg>
      </span>
    </span>
  );
}

/**
 * AppTile - the c-mark on a deep-purple squircle. The home-screen icon / favicon.
 */
export function AppTile({ size = 56, bg = "var(--purple-600)", cColor = "var(--cream)", accent = LAV, style = {} }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.225, background: bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)", ...style }}>
      <Cmark size={size * 0.6} cColor={cColor} accent={accent} />
    </div>
  );
}
