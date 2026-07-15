import React from "react";
import { AvatarStack } from "../core/AvatarStack.jsx";


/* Category is NOT colour-coded (canonical) - the cover is one calm lavender wash on
   every card; `category` survives for the label only. */
const COVER_HUE = "var(--lavender-400)";

/* Status badge - the ONLY place colour appears on a card. Rounded RECT, status text
   on a soft tint of the same hue (matches the Badge component). */
const STATUS = {
  free:      { label: "Free",       c: "var(--sage)",  t: 14 },
  almostfull:{ label: "Almost full",c: "var(--coral)", t: 12 },
  spots:     { label: "spots left", c: "var(--coral)", t: 12 },
  trending:  { label: "Trending",   c: "var(--amber)", t: 16 },
  new:       { label: "New",        c: "var(--teal)",  t: 12 },
  waitlist:  { label: "Waitlist",   c: "var(--amber)", t: 16 },
  soldout:   { label: "Sold out",   c: "var(--slate)", t: 0 },
};

function StatusBadge({ status, spotsLeft }) {
  const s = STATUS[status];
  if (!s) return null;
  const label = status === "spots" && spotsLeft != null ? `${spotsLeft} spots left` : s.label;
  const bg = status === "soldout" ? "var(--mist)" : `color-mix(in srgb, ${s.c} ${s.t}%, var(--white))`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 8px", borderRadius: 8, background: bg, color: s.c, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, lineHeight: 1, letterSpacing: ".005em" }}>{label}</span>
  );
}

/* Neutral interest tag - white fill, mist hairline, ink text, no dot (matches Tag). Compact. */
function InterestTag({ children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 9px", borderRadius: "var(--radius-pill)", background: "var(--white)", border: "1px solid var(--border-mid)", color: "var(--text-strong)", fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>{children}</span>
  );
}

function SaveBtn({ saved, onSave }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onSave && onSave(); }} aria-label={saved ? "Saved" : "Save"} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(253,250,246,.92)", boxShadow: "var(--shadow-xs)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "var(--purple-600)" : "none"} stroke={saved ? "var(--purple-600)" : "var(--text-strong)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" /></svg>
    </button>
  );
}

/**
 * EventCard - the heart of the product and the marketing feed. One component,
 * reused across discovery, dashboard, landing and My Events. Equal-height in a
 * row (flex column, the meta area grows so the price + CTA footer pins to the
 * bottom and aligns across cards). Cover carries ONE status badge + Save only.
 *
 * Venue privacy (the locked rule): before booking, the card shows
 * suburb · distance + a lock ("Venue shown when you RSVP"); once `booked`,
 * the venue name is revealed (venue · suburb).
 */
export function EventCard({
  name = "",
  venue = "",
  suburb = "",
  dist = "",
  when = "",
  category = "ceramics",
  categoryLabel = null,
  cover = null,
  tags = [],
  going = [],
  goingCount = 0,
  status = null,
  spotsLeft = null,
  price = "Free",
  booked = false,
  waitlisted = false,
  saved = false,
  onSave,
  onCta,
  onClick = () => {},
  style = {},
}) {
  const hue = COVER_HUE;
  const count = goingCount || going.length;
  const [hover, setHover] = React.useState(false);

  // CTA + price logic
  const full = status === "soldout" || status === "waitlist";
  const ctaLabel = waitlisted ? "Joined waitlist" : booked ? "View details" : full ? "Join waitlist" : "RSVP";
  const ctaPrimary = !booked && !waitlisted;
  const ctaMuted = waitlisted; // muted, same footprint - the "joined" resting state

  // up to 3 interest tags + overflow
  const shown = tags.slice(0, 3);
  const extra = tags.length - shown.length;

  const isFree = !price || price === "Free" || price === "$0";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border-soft)",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-sm)",
        overflow: "hidden",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        transition: "box-shadow .2s ease, transform .2s ease",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column",
        alignSelf: "start",
        ...style,
      }}
    >
      {/* Cover - abstract category-tinted panel; ONE status badge + Save only */}
      <div
        style={{
          position: "relative",
          height: 150,
          flex: "none",
          background: cover
            ? `center/cover no-repeat url(${cover})`
            : `radial-gradient(120% 140% at 18% 12%, color-mix(in srgb, ${hue} 38%, var(--cream)) 0%, color-mix(in srgb, ${hue} 18%, var(--cream)) 45%, var(--cream) 100%)`,
          overflow: "hidden",
        }}
      >
        {!cover && (
          <>
            <span style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: hue, opacity: 0.22, top: -28, right: 30 }} />
            <span style={{ position: "absolute", width: 84, height: 84, borderRadius: "50%", background: "var(--lavender-300)", opacity: 0.5, bottom: -24, right: -10 }} />
            <span style={{ position: "absolute", width: 56, height: 56, borderRadius: "50%", background: "var(--lavender-200)", opacity: 0.7, bottom: 16, left: 26 }} />
          </>
        )}
        {status && <div style={{ position: "absolute", top: 13, left: 13 }}><StatusBadge status={status} spotsLeft={spotsLeft} /></div>}
        <div style={{ position: "absolute", top: 13, right: 13 }}><SaveBtn saved={saved} onSave={onSave} /></div>
      </div>

      {/* Body - flex column; meta grows so the footer pins to the bottom */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column" }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".01em", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
            {when}
          </p>
          <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--card-title)", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)", lineHeight: "24px", minHeight: "48px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minWidth: 0 }}>
            {name}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
            {booked
              ? <span>{venue}{venue && suburb ? " · " : ""}{suburb}</span>
              : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{suburb}{dist ? ` · ${dist}` : ""}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Venue shown when you RSVP"><title>Venue shown when you RSVP</title><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                </span>}
          </p>
        </div>
        <div style={{ marginTop: 12 }}>
          {shown.length > 0 && (
            <div style={{ display: "flex", flexWrap: "nowrap", gap: 6, minWidth: 0, overflow: "hidden" }}>
              {shown.map((t, i) => <InterestTag key={i}>{t}</InterestTag>)}
              {extra > 0 && <InterestTag>+{extra}</InterestTag>}
            </div>
          )}

          <div style={{ marginTop: shown.length > 0 ? 8 : 0 }}>
            {count >= 3
              ? <AvatarStack people={going} max={4} size={26} label={`${count} going`} />
              : <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Be one of the first</span>}
          </div>
        </div>

        {/* Footer - 16px gap, 1px Mist hairline + 12px; price left, CTA right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--mist)" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: isFree ? "var(--success)" : "var(--text-strong)" }}>{isFree ? "Free" : price}</span>
          <button
            onClick={(e) => { e.stopPropagation(); (onCta || onClick)(); }}
            style={{
              padding: "9px 18px", borderRadius: "var(--radius-pill)", cursor: "pointer",
              fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, lineHeight: 1,
              background: ctaMuted ? "var(--lavender-100)" : ctaPrimary ? "var(--purple-600)" : "var(--white)",
              color: ctaMuted ? "var(--purple-700)" : ctaPrimary ? "var(--cream)" : "var(--purple-700)",
              border: ctaMuted ? "1.5px solid transparent" : ctaPrimary ? "1.5px solid var(--purple-600)" : "1.5px solid var(--border-mid)",
            }}
          >{ctaLabel}</button>
        </div>
      </div>
    </div>
  );
}
