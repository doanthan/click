import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Tag } from "../core/Tag.jsx";
import { Button } from "../core/Button.jsx";

/**
 * PeopleCard - the canonical "person you can click with" card. ONE component,
 * reused identically on the Click-with-someone page (one per line), the dashboard
 * "click with someone" section, and as the profile-drawer header. Distinct from the
 * EventCard: a face + the real overlap + one intention - no banner, no price, no RSVP.
 *
 * The hook is the OVERLAP, never a bio. Bios/prompts/full interests live in the
 * profile drawer (opened via "View profile") - never on the card.
 *
 * The click action is ONE control across states (default → pending → mutual): the
 * Button keeps an identical footprint, only its fill + label change. Pending is a
 * muted "clicked" (no ✨, unresolved); mutual is Sage "clicked ✨" (✨ = the peak).
 * Name only - no age (age lives on the profile drawer). No anonymous helper on the
 * card; that reassurance shows once at the top of the section.
 */

const sentence = (s = "") => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* plain overlap glyph (a venn) - NEVER a ✨; the sparkle is reserved for the button state */
function VennGlyph({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--purple-500)"
      strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ flex: "none", marginTop: "1px" }}>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}
function PinGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--purple-500)"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "2px" }}>
      <path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/* shared-context line - CONDITIONAL, never fabricated. Shared event wins; else the
   interest overlap; else nothing renders (NEVER a bare "You were both at"). */
function ContextLine({ sharedEvent, overlap }) {
  if (!sharedEvent && !overlap) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "7px", fontSize: "13px", color: "var(--text-body)", lineHeight: 1.45 }}>
      {sharedEvent ? <PinGlyph /> : <VennGlyph />}
      <span>
        {sharedEvent
          ? <>You were both at <b style={{ color: "var(--text-strong)", fontWeight: 600 }}>{sharedEvent}</b></>
          : <>Both into <b style={{ color: "var(--text-strong)", fontWeight: 600 }}>{overlap}</b></>}
      </span>
    </div>
  );
}

function TagRow({ tags = [], max }) {
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  if (!tags.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {shown.map((t) => <Tag key={t} dense>{t}</Tag>)}
      {extra > 0 && <Tag dense>+{extra}</Tag>}
    </div>
  );
}

/* the stateful action - ONE footprint across default → pending → mutual. Pending =
   muted "clicked" (no ✨); mutual = Sage "clicked ✨". No helper line on the card. */
function ClickAction({ name, state, onClick, onView, full }) {
  if (state === "mutual")
    return <Button variant="mutual" size="sm" full={full} onClick={onView}>clicked <span aria-hidden="true">✨</span></Button>;
  if (state === "pending")
    return <Button variant="pending" size="sm" full={full}>clicked</Button>;
  return <Button variant="primary" size="sm" full={full} onClick={onClick}>click with {name}</Button>;
}

/* loading skeleton - matches THIS card's shape, not a spinner */
function Bar({ w, h = 12 }) {
  return <span style={{ display: "block", width: w, height: h, borderRadius: "6px", background: "var(--mist)" }} />;
}
function PeopleCardSkeleton({ layout }) {
  const row = layout === "row";
  const shell = {
    display: "flex", gap: row ? "20px" : "14px", alignItems: row ? "center" : "flex-start",
    flexDirection: row ? "row" : "column",
    background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)",
    boxShadow: "var(--shadow-sm)", padding: row ? "18px 22px" : "18px", fontFamily: "var(--font-sans)",
  };
  return (
    <div style={shell} aria-busy="true">
      <span style={{ width: row ? 66 : 56, height: row ? 66 : 56, borderRadius: "50%", background: "var(--mist)", flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "9px", width: "100%" }}>
        <Bar w="140px" h={15} />
        <Bar w="180px" />
        <div style={{ display: "flex", gap: "6px" }}><Bar w="64px" h={20} /><Bar w="80px" h={20} /></div>
      </div>
      <div style={{ width: row ? 152 : "100%" }}><Bar w="100%" h={36} /></div>
    </div>
  );
}

export function PeopleCard({
  name = "",
  src = null,
  intent = null,
  sharedEvent = null,
  overlap = null,
  tags = [],
  state = "default",
  layout = "row",
  onClick = () => {},
  onView = () => {},
  style = {},
}) {
  if (state === "loading") return <PeopleCardSkeleton layout={layout} />;

  const first = name.split(" ")[0];
  const row = layout === "row";

  const identity = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 600, lineHeight: "24px", color: "var(--text-strong)", letterSpacing: "-0.01em" }}>
          {first}
        </span>
        {intent && <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }}>{sentence(intent)}</span>}
      </div>
    </>
  );

  if (row) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "20px", background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "18px 22px", fontFamily: "var(--font-sans)", ...style }}>
        <Avatar name={name} src={src} size={66} ring={state === "mutual"} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {identity}
          <ContextLine sharedEvent={sharedEvent} overlap={overlap} />
          <TagRow tags={tags} max={4} />
        </div>
        <div style={{ flex: "none", width: "172px", display: "flex", flexDirection: "column", gap: "9px" }}>
          <ClickAction name={first} state={state} onClick={onClick} onView={onView} full />
          {state !== "mutual" && (
            <Button variant="secondary" size="sm" full onClick={onView}>View profile</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "11px", background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "18px", fontFamily: "var(--font-sans)", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <Avatar name={name} src={src} size={56} ring={state === "mutual"} />
        <div style={{ minWidth: 0 }}>{identity}</div>
      </div>
      <ContextLine sharedEvent={sharedEvent} overlap={overlap} />
      <TagRow tags={tags} max={3} />
      <div style={{ paddingTop: "2px" }}>
        {state === "default" ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <ClickAction name={first} state="default" onClick={onClick} full />
            <Button variant="secondary" size="sm" onClick={onView}>View profile</Button>
          </div>
        ) : (
          <>
            <ClickAction name={first} state={state} onClick={onClick} onView={onView} full />
            {state !== "mutual" && (
              <div style={{ marginTop: "9px" }}><Button variant="secondary" size="sm" full onClick={onView}>View profile</Button></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
