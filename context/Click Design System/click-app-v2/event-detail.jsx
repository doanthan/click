(function () {
  /* Click - EVENT DETAIL (responsive website). Three booking states:
     LOCKED (suburb only, venue hidden, aggregate FOMO) · WAITLIST (full, position + offer)
     · UNLOCKED (booked: venue revealed + map + attendees + manage + cancel).
     Desktop ≥1024 = two columns (content left + sticky booking panel right, NO bottom bar).
     Tablet 768–1024 = single column, panel in-flow after the title.
     Phone <768 = single column + a SLIM price+button sticky bottom bar (capacity/avatars in flow).
     NO "click with" anywhere. Aggregate social proof only. Inline styles. window.ScreensED. */
  const { useState, useEffect, CAT, Icon, Avatar, Stack, Btn, Cover, Tag, Spark, PeopleCard } = window.CK;
  const D = window.DATA;
  /* names you have an ACTIVE MUTUAL with - drives the attendee "clicked ✨" marker (mutual peak only) */
  const MUTUAL_NAMES = new Set((D.CLICKS || []).filter((c) => c.state === "mutual").map((c) => c.name));

  /* ---- helpers ---- */
  const priceNum = (p) => (p === "Free" || !p ? 0 : Number(String(p).replace(/[^0-9.]/g, "")) || 0);
  const money = (n) => (n === 0 ? "Free" : "$" + n);
  const firstName = (n = "") => n.split(/\s+/)[0].replace(/[^A-Za-z]/g, "");

  /* ---- guest-details (19_GUEST_RSVP v2): per-seat optional naming = first name + email + DOB,
     all required ONCE a seat is named; an unnamed seat is a frictionless +1; consent shows only
     when ≥1 named; DOB is the 18+ gate, nothing more (no last name, no postcode). ---- */
  const EVENT_DATE = new Date("2026-06-13");
  const PURCHASER_EMAIL = "ava.mendez@email.com";
  const emailOk = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((s || "").trim());
  const ageAt = (dob, when) => { if (!dob) return null; const d = new Date(dob); if (isNaN(d)) return null; let a = when.getFullYear() - d.getFullYear(); const m = when.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && when.getDate() < d.getDate())) a--; return a; };
  function seatError(s, all) {
    if (!s.open) return null;                                   // unnamed +1 is always valid
    if (!s.name || s.name.trim().length < 2) return { field: "name", msg: "Add their first name" };
    if (!emailOk(s.email)) return { field: "email", msg: "Add a valid email" };
    if (s.email.trim().toLowerCase() === PURCHASER_EMAIL) return { field: "email", msg: "That's your email - use theirs" };
    if (all.some((o) => o !== s && o.open && o.email && o.email.trim().toLowerCase() === s.email.trim().toLowerCase())) return { field: "email", msg: "Already added on another seat" };
    if (!s.dob) return { field: "dob", msg: "Add their date of birth" };
    if ((ageAt(s.dob, EVENT_DATE) || 0) < 18) return { field: "dob", msg: "Guests need to be 18+ for this one" };
    return null;
  }
  function guestsReady(seats, consent) {
    const named = seats.filter((s) => s.open);
    if (named.some((s) => seatError(s, seats))) return false;
    if (named.length > 0 && !consent) return false;
    return true;
  }

  /* "When you're in, you'll get" — outcome-led value block (never withholding-framed) */
  function ValueBlock() {
    const items = [
      ["pin", "The exact spot", "The full venue and address, and a map to get there."],
      ["users", "Who's going", "See who else is coming, and shared interests."],
      ["calendar", "It's in your calendar", "Add it in a tap so you don't miss it."],
    ];
    return <div style={{ margin: "0 0 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--purple-600)", marginBottom: 10 }}>When you're in, you'll get</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(([ic, t, d]) => <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <span style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", background: "var(--lavender-100)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><Icon name={ic} size={15} w={1.9} color="var(--purple-600)" /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.3 }}>{t}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 1 }}>{d}</div>
          </div>
        </div>)}
      </div>
    </div>;
  }

  const gInput = { width: "100%", boxSizing: "border-box", height: 44, padding: "0 12px", background: "var(--white)", borderWidth: "1.5px", borderStyle: "solid", borderColor: "var(--border-mid)", borderRadius: "var(--radius-md)", fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--text-strong)", outline: "none" };
  function SeatRow({ i, s, err, update }) {
    const seatNo = i + 2; // purchaser is seat 1
    if (!s.open) return <button onClick={() => update(i, { open: true })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", padding: "11px 13px", borderRadius: "var(--radius-md)", border: "1px dashed var(--border-mid)", background: "var(--white)", cursor: "pointer" }}>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-body)" }}>Seat {seatNo} · add their details <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>(optional)</span></span>
      <Icon name="plus" size={15} w={2.2} color="var(--purple-600)" />
    </button>;
    const fieldErr = (f) => err && err.field === f;
    const errStyle = { borderColor: "#B5362F" };
    const msg = (f) => fieldErr(f) ? <div style={{ fontSize: 11.5, color: "#B5362F", marginTop: 4 }}>{err.msg}</div> : null;
    return <div style={{ padding: "13px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-soft)", background: "var(--surface-tint)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>Seat {seatNo}</span>
        <button onClick={() => update(i, { open: false, name: "", email: "", dob: "" })} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>Leave as a +1</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div><input value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="First name" style={{ ...gInput, ...(fieldErr("name") ? errStyle : {}) }} />{msg("name")}</div>
        <div><input value={s.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="Email" inputMode="email" style={{ ...gInput, ...(fieldErr("email") ? errStyle : {}) }} />{msg("email")}</div>
        <div>
          <input value={s.dob} onChange={(e) => update(i, { dob: e.target.value })} type="date" aria-label="Date of birth" style={{ ...gInput, color: s.dob ? "var(--text-strong)" : "var(--text-faint)", ...(fieldErr("dob") ? errStyle : {}) }} />
          {fieldErr("dob") ? msg("dob") : <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>We just need to know everyone's 18+.</div>}
        </div>
      </div>
    </div>;
  }
  function ConsentBlock({ consent, setConsent }) {
    return <div style={{ marginTop: 4 }}>
      <button onClick={() => setConsent(!consent)} style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 0 }}>
        <span style={{ flex: "none", width: 20, height: 20, marginTop: 1, borderRadius: 6, border: "1.5px solid " + (consent ? "var(--purple-600)" : "var(--border-mid)"), background: consent ? "var(--purple-600)" : "var(--white)", display: "flex", alignItems: "center", justifyContent: "center" }}>{consent && <Icon name="check" size={13} w={3} color="var(--cream)" />}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.5 }}>I've got their OK to share these details. They'll get one invite from Click with a link to remove their details anytime.</span>
      </button>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}><Icon name="info" size={13} w={1.9} color="var(--text-muted)" style={{ marginTop: 1, flex: "none" }} />Their spot is part of your booking - refunds go to you, on the standard policy. They can hand the spot back anytime.</div>
    </div>;
  }
  /* the full guest section: seats stepper + per-seat optional naming + consent (when ≥1 named) */
  function GuestSection({ seats, setSeats, consent, setConsent, max = 4 }) {
    const n = seats.length;
    const setCount = (next) => { next = Math.max(0, Math.min(max, next)); setSeats((prev) => { const arr = prev.slice(0, next); while (arr.length < next) arr.push({ open: false, name: "", email: "", dob: "" }); return arr; }); };
    const update = (i, patch) => setSeats((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
    const anyNamed = seats.some((s) => s.open);
    const Step = ({ dir, disabled }) => <button onClick={() => !disabled && setCount(n + dir)} disabled={disabled} aria-label={dir > 0 ? "Add a guest" : "Remove a guest"} style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid var(--border-mid)", background: "var(--white)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={dir > 0 ? "plus" : "x"} size={dir > 0 ? 15 : 13} w={2.4} color="var(--purple-700)" /></button>;
    return <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 0 2px", borderTop: "1px solid var(--mist)" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Bringing anyone?</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>Add up to {max} - each is a seat</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
          <Step dir={-1} disabled={n <= 0} />
          <span style={{ minWidth: 18, textAlign: "center", fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>{n}</span>
          <Step dir={1} disabled={n >= max} />
        </div>
      </div>
      {n > 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, padding: "0 2px" }}>Adding their details saves them a spot and sends one invite from Click - so they're on the list and you're sorted.</div>}
      {seats.map((s, i) => <SeatRow key={i} i={i} s={s} err={seatError(s, seats)} update={update} />)}
      {anyNamed && <ConsentBlock consent={consent} setConsent={setConsent} />}
    </div>;
  }

  /* per-event aggregate social-proof (life-tag powered, AGGREGATE only - never WHO). */
  const FOMO = {
    ev1: { life: "A couple of locals new to the area are going", belong: null, romantic: "Some singles are going" },
    ev2: { life: "Lots of plant people going - mostly in their 30s", belong: null, romantic: null },
    ev3: { life: "3 people you might click with are going", belong: "You're not the only one - others new to the area are going too.", romantic: "Some singles are going" },
    ev4: { life: "A big, easy crowd - all paces, all ages", belong: null, romantic: null },
    ev6: { life: "3 people over 30 are going", belong: null, romantic: "A few singles are going" },
  };

  /* neutral interest pill - white fill, mist hairline, ink (Buttons_Tags) */
  /* neutral interest pill - true-white fill, Mist-strong hairline, ink (Buttons_Tags) */
  function Pill({ children, muted }) {
    return <span style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px", fontSize: 13, fontFamily: "var(--font-sans)", fontWeight: 500, lineHeight: 1, borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", background: "var(--white)", color: muted ? "var(--text-muted)" : "var(--ink)", border: "1px solid var(--mist-strong)" }}>{children}</span>;
  }
  function CircleBtn({ icon, label, onClick, active }) {
    return <button onClick={onClick} aria-label={label} title={label} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(253,250,246,.93)", boxShadow: "var(--shadow-sm)", flex: "none" }}>
      <Icon name={icon} size={18} w={2} color={active ? "var(--purple-600)" : "var(--purple-700)"} style={{ fill: active && icon === "bookmark" ? "var(--purple-600)" : "none" }} />
    </button>;
  }
  function ShareIco() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>;
  }

  /* ---- capacity bar (honest; reads count/cap = event_capacity_v) ---- */
  function CapacityBar({ e }) {
    const left = Math.max(0, e.cap - e.count);
    const pct = Math.min(100, Math.round((e.count / e.cap) * 100));
    const tight = left / e.cap < 0.15;
    const fill = tight ? "var(--coral)" : "var(--purple-600)";
    return <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{e.count} of {e.cap} spots taken</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: tight ? "var(--coral)" : "var(--text-muted)" }}>{left} left</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: "var(--mist)", overflow: "hidden" }}><div style={{ height: "100%", width: pct + "%", background: fill, borderRadius: 99 }} /></div>
    </div>;
  }

  /* ONE status tag (almost-full coral · trending amber · new teal · free sage) */
  function statusFor(e) {
    const left = e.cap - e.count, tight = left > 0 && left / e.cap < 0.15;
    if (e.price === "Free") return { label: "Free", bg: "var(--sage)" };
    if (e.status === "soldout" || e.full || left <= 0) return { label: "Full", bg: "var(--slate)" };
    if (e.status === "almostfull" || tight) return { label: "Almost full", bg: "var(--coral)" };
    if (e.status === "trending") return { label: "Trending", bg: "var(--amber)" };
    if (e.status === "new") return { label: "New", bg: "var(--teal)" };
    return null;
  }
  function StatusTag({ e, style = {} }) {
    const s = statusFor(e);
    if (!s) return null;
    return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, lineHeight: 1, borderRadius: "var(--radius-pill)", background: s.bg, color: "#fff", ...style }}>{s.label}</span>;
  }
  /* FULL (waitlist) tag - Slate, never "Almost full" */
  function FullBadge({ style = {} }) {
    return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, lineHeight: 1, borderRadius: "var(--radius-pill)", background: "var(--slate)", color: "#fff", ...style }}>Full</span>;
  }

  /* ---- a believable static street map (capture-safe; not a grey placeholder) ---- */
  function VenueMap({ label }) {
    return <div style={{ position: "relative", height: 168, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--border-soft)" }}>
      <svg width="100%" height="100%" viewBox="0 0 400 168" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }} aria-label="Map of the venue location">
        <rect width="400" height="168" fill="#EDE7DA" />
        {/* park */}
        <rect x="20" y="98" width="92" height="74" rx="6" fill="#CFE0C2" />
        {/* water */}
        <path d="M300 -10 L360 0 L344 60 L388 110 L360 178 L300 178 Z" fill="#Bcd4e6" opacity="0.8" />
        <path d="M300 -10 L360 0 L344 60 L388 110 L360 178 L300 178 Z" fill="#B9D2E6" />
        {/* blocks */}
        {[[130, 24], [196, 24], [130, 70], [196, 70], [40, 24], [262, 96], [196, 116]].map(([x, y], i) => <rect key={i} x={x} y={y} width="46" height="30" rx="3" fill="#F6F2E8" />)}
        {/* roads */}
        <g stroke="#FBF8F0" strokeWidth="11" strokeLinecap="round">
          <line x1="-10" y1="62" x2="410" y2="50" />
          <line x1="-10" y1="110" x2="300" y2="118" />
          <line x1="110" y1="-10" x2="124" y2="178" />
          <line x1="250" y1="-10" x2="262" y2="178" />
        </g>
        <g stroke="#E4DBC9" strokeWidth="1.4">
          <line x1="-10" y1="62" x2="410" y2="50" />
          <line x1="-10" y1="110" x2="300" y2="118" />
          <line x1="110" y1="-10" x2="124" y2="178" />
          <line x1="250" y1="-10" x2="262" y2="178" />
        </g>
        <g stroke="#FBF8F0" strokeWidth="5" strokeLinecap="round">
          <line x1="180" y1="-10" x2="188" y2="178" />
          <line x1="-10" y1="148" x2="300" y2="156" />
        </g>
        {/* street labels */}
        <text x="30" y="46" fontFamily="var(--font-sans)" fontSize="8" fill="#A99F88" fontWeight="600">King St</text>
        <text x="132" y="142" fontFamily="var(--font-sans)" fontSize="8" fill="#A99F88" fontWeight="600">Probert St</text>
      </svg>
      {/* deep-purple pin, centred on the venue */}
      <div style={{ position: "absolute", left: "47%", top: "50%", transform: "translate(-50%,-100%)", filter: "drop-shadow(0 4px 5px rgba(25,19,58,.3))" }}>
        <svg width="30" height="38" viewBox="0 0 30 38" fill="none"><path d="M15 1C7.8 1 2 6.7 2 13.8 2 23 15 37 15 37s13-14 13-23.2C28 6.7 22.2 1 15 1Z" fill="var(--purple-600)" /><circle cx="15" cy="14" r="5" fill="#fff" /></svg>
      </div>
      <span style={{ position: "absolute", left: 12, bottom: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: "var(--radius-pill)", background: "rgba(253,250,246,.95)", boxShadow: "var(--shadow-sm)", fontSize: 12, fontWeight: 600, color: "var(--text-strong)" }}><Icon name="pin" size={13} w={2} color="var(--purple-600)" />{label}</span>
    </div>;
  }


  /* ===== the booking content, by state - used in the right rail (desktop) / in-flow (tablet) ===== */
  function BookingBody({ e, mode, book, saved, toggleSave, barCTA, onRSVP }) {
    const kind = e.price === "Free" ? "free" : "paid";
    const [step, setStep] = useState("idle");      // idle | rsvp (waitlist join only)
    const [reminded, setReminded] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [calOpen, setCalOpen] = useState(false);
    const addr = [e.venue || "The venue", "12 Probert St", e.suburb, "NSW 2042"].filter(Boolean).join(", ");

    const Price = () => <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 14 }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-.01em", color: kind === "free" ? "var(--success)" : "var(--text-strong)" }}>{e.price}</span>
      {kind !== "free" && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>per person</span>}
    </div>;

    const QuietRow = () => <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <button onClick={toggleSave} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: saved ? "var(--purple-700)" : "var(--text-body)" }}><Icon name="bookmark" size={16} w={2} color={saved ? "var(--purple-600)" : "var(--text-muted)"} style={{ fill: saved ? "var(--purple-600)" : "none" }} />{saved ? "Saved" : "Save"}</button>
      <button style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-body)" }}><Icon name="share" size={16} w={2} color="var(--text-muted)" />Share</button>
    </div>;

    /* ---------------- UNLOCKED (booked) ---------------- */
    if (mode === "unlocked") {
      const refund = "Full refund - $" + priceNum(e.price) + " back to your card";  // >48h demo (in 3 days)
      return <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "color-mix(in srgb,var(--success) 16%,#fff)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="check" size={17} w={2.8} color="var(--success)" /></span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--text-strong)" }}>You're going</span>
        </div>
        {/* revealed venue + map (no "venue unlocked" eyebrow - the reveal is self-evident) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.4, marginBottom: 10 }}>{e.venue || "The venue"}<span style={{ display: "block", fontWeight: 500, color: "var(--text-muted)", fontSize: 13.5, marginTop: 2 }}>{["12 Probert St", e.suburb, "NSW 2042"].filter(Boolean).join(", ")}</span></div>
          <VenueMap label={e.venue || e.suburb} />
          <div style={{ display: "flex", gap: 16, marginTop: 11 }}>
            <a style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", cursor: "pointer" }}><Icon name="pin" size={15} w={2} color="var(--purple-600)" />Open in Maps</a>
            <a style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", cursor: "pointer" }}><Icon name="compass" size={15} w={2} color="var(--purple-600)" />Directions</a>
          </div>
        </div>
        {/* add to calendar - ONE button → menu */}
        <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 14, marginBottom: 12 }}>
          <button onClick={() => setCalOpen((v) => !v)} style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-body)" }}><Icon name="calendar" size={16} w={2} color="var(--purple-600)" />Add to calendar<Icon name="chevD" size={15} w={2} color="var(--text-muted)" style={{ transform: calOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} /></button>
          {calOpen && <div style={{ marginTop: 8, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>{["Google Calendar", "Apple Calendar", "Outlook", "Download .ics"].map((c, i) => <button key={c} style={{ width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderTop: i ? "1px solid var(--border-soft)" : "none", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 500, color: "var(--text-body)" }}>{c}</button>)}</div>}
        </div>
        {/* manage + share */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-body)" }}><Icon name="users" size={16} w={2} color="var(--text-muted)" />Manage +1s</button>
          <button style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 42, borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-body)" }}><Icon name="share" size={16} w={2} color="var(--text-muted)" />Share</button>
        </div>
        {/* quiet cancel + real refund */}
        {!cancelOpen ? <button onClick={() => setCancelOpen(true)} style={{ border: "none", background: "none", padding: "2px 0", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 3 }}>Cancel RSVP</button>
          : <div style={{ background: "var(--surface-tint)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-md)", padding: "13px 14px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>Cancel this RSVP?</div>
            <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.5, marginBottom: 11 }}>{kind === "free" ? "No charge - your spot frees up for someone on the waitlist." : refund + ". You're more than 48 hours out, so it's the full amount."}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setCancelOpen(false)} style={{ flex: 1, height: 40, borderRadius: "var(--radius-md)", border: "1px solid var(--border-mid)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-body)" }}>Keep my spot</button>
              <button onClick={() => setCancelOpen(false)} style={{ flex: 1, height: 40, borderRadius: "var(--radius-md)", border: "1px solid color-mix(in srgb,#B5362F 45%,transparent)", background: "var(--white)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "#B5362F" }}>Cancel RSVP</button>
            </div>
          </div>}
      </div>;
    }

    /* ---------------- WAITLIST (full) ---------------- */
    if (mode === "waitlist") {
      if (step === "rsvp") return <div>
      <Price />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: "color-mix(in srgb,var(--amber) 20%,#fff)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="clock" size={17} w={2.2} color="#a86f12" /></span>
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 3 }}>You're 3rd in line</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>We'll let you know the moment a spot opens. Nothing to pay until you're in.</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", background: "var(--lavender-100)", borderRadius: "var(--radius-md)" }}>
          <Icon name="info" size={16} w={2} color="var(--purple-600)" style={{ marginTop: 1, flex: "none" }} />
          <div style={{ fontSize: 12.5, color: "var(--purple-800)", lineHeight: 1.5 }}>If a spot opens, you'll get <b style={{ fontWeight: 700 }}>30 minutes</b> to grab it before it passes on.</div>
        </div>
        <QuietRow />
      </div>;
      return <div>
        <Price />
        <CapacityBar e={{ ...e, count: e.cap }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "13px 0" }}><FullBadge /><span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>This one's full right now.</span></div>
        {!barCTA && <Btn full size="lg" onClick={() => setStep("rsvp")}>Join waitlist</Btn>}
        <QuietRow />
      </div>;
    }

    /* ---------------- LOCKED (available) ---------------- */
    const loc = <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", background: "var(--lavender-wash)", borderRadius: "var(--radius-lg)", marginBottom: 14 }}>
      <Icon name="lock" size={16} w={2} color="var(--text-muted)" style={{ marginTop: 1, flex: "none" }} />
      <div style={{ fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}><b style={{ fontWeight: 600, color: "var(--text-strong)" }}>{e.suburb} · {e.dist}</b> - venue revealed when you RSVP.</div>
    </div>;

    return <div>
      <Price />
      {loc}
      <CapacityBar e={e} />
      {statusFor(e) && <div style={{ marginTop: 12 }}><StatusTag e={e} /></div>}
      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "13px 0 15px", fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}><Icon name="clock" size={15} w={2} color="var(--purple-500)" />{e.when}</div>
      {!barCTA && <Btn full size="lg" onClick={onRSVP}>RSVP</Btn>}
      <QuietRow />
      <button onClick={() => setReminded(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 8, height: 38, border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: reminded ? "var(--success)" : "var(--text-muted)" }}><Icon name={reminded ? "check" : "bell"} size={15} w={2} color={reminded ? "var(--success)" : "var(--text-muted)"} />{reminded ? "We'll remind you" : "Remind me"}</button>
    </div>;
  }

  /* a bordered card wrapper for the panel (desktop rail / tablet in-flow) */
  function Panel({ children }) {
    return <div style={{ background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)", padding: "20px 20px 22px" }}>{children}</div>;
  }

  /* ===== RSVP MODAL — the single booking surface, opened from the panel/bottom-bar RSVP button =====
     Value block + guest details + refund line + ONE action. Free = confirm in-modal → "View event" → unlocked page.
     Paid = "Continue to payment · $X" → hosted-redirect mock (brief handoff) → unlocked page. (canon 05_BOOKING_LIFECYCLE) */
  function RSVPModal({ e, web, onClose, onDone }) {
    const kind = e.price === "Free" ? "free" : "paid";
    const [gseats, setGseats] = useState([]);
    const [consent, setConsent] = useState(false);
    const [phase, setPhase] = useState("form");   // form | paying | success
    const seats = 1 + gseats.length;
    const total = priceNum(e.price) * seats;
    const ready = guestsReady(gseats, consent);

    useEffect(() => { const onKey = (ev) => { if (ev.key === "Escape" && phase !== "paying") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [phase, onClose]);

    const confirmFree = () => { if (ready) setPhase("success"); };
    const goPay = () => { if (!ready) return; setPhase("paying"); setTimeout(() => onDone && onDone(), 1400); };

    const scrim = { position: "fixed", inset: 0, zIndex: 70, background: "rgba(28,24,48,.5)", display: "flex", alignItems: web ? "center" : "flex-end", justifyContent: "center", padding: web ? 24 : 0 };
    const card = { width: web ? 480 : "100%", maxWidth: "100%", maxHeight: web ? "88vh" : "92vh", display: "flex", flexDirection: "column", background: "var(--white)", borderRadius: web ? 20 : "20px 20px 0 0", boxShadow: "0 12px 32px rgba(28,24,48,.14), 0 2px 6px rgba(28,24,48,.08)", overflow: "hidden" };

    /* success (free path) */
    if (phase === "success") {
      return <div style={scrim} onClick={onClose}><div style={card} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ padding: web ? "40px 28px 28px" : "32px 22px 26px", textAlign: "center", overflowY: "auto" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: "50%", background: "color-mix(in srgb,var(--success) 16%,#fff)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={30} w={2.8} color="var(--success)" /></div>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--text-strong)" }}>You're going</h2>
          <p style={{ margin: "0 0 6px", fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55 }}>The venue's unlocked - it's all on the event page now.</p>
          <p style={{ margin: "0 0 22px", fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{e.venue || "The venue"} · {e.suburb}</p>
          <Btn full size="lg" onClick={onDone}>View event</Btn>
        </div>
      </div></div>;
    }

    const header = <div style={{ flex: "none", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: web ? "20px 22px 14px" : "16px 18px 12px", borderBottom: "1px solid var(--border-soft)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{e.when} · {e.suburb}</div>
      </div>
      <button onClick={onClose} aria-label="Close" style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", border: "none", background: "var(--surface-tint)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={16} w={2.2} color="var(--text-muted)" /></button>
    </div>;

    const priceTop = <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 16 }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-.01em", color: kind === "free" ? "var(--success)" : "var(--text-strong)" }}>{e.price}</span>
      {kind !== "free" && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>per person</span>}
    </div>;

    return <div style={scrim} onClick={() => phase !== "paying" && onClose()}><div style={card} onClick={(ev) => ev.stopPropagation()}>
      {header}
      <div style={{ flex: 1, overflowY: "auto", padding: web ? "18px 22px" : "16px 18px" }}>
        {priceTop}
        <ValueBlock />
        <GuestSection seats={gseats} setSeats={setGseats} consent={consent} setConsent={setConsent} />
        {kind !== "free" && total !== priceNum(e.price) && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginTop: 14 }}><span>{seats} × {e.price}</span><span>${total}</span></div>}
      </div>
      <div style={{ flex: "none", padding: web ? "14px 22px 18px" : "12px 18px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border-soft)", background: "var(--white)" }}>
        {kind !== "free" && <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12 }}><Icon name="info" size={13} w={1.9} color="var(--text-muted)" style={{ marginTop: 1, flex: "none" }} />Full refund up to 48h before - 50% within 48h - none within 24h.</div>}
        {kind === "free" && <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12 }}><Icon name="info" size={13} w={1.9} color="var(--text-muted)" style={{ marginTop: 1, flex: "none" }} />Free to cancel any time - your spot frees up for someone else.</div>}
        {phase === "paying"
          ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 50 }}><span style={{ width: 17, height: 17, borderRadius: "50%", border: "2.5px solid var(--lavender-300)", borderTopColor: "var(--purple-600)", display: "inline-block", animation: "ckSpin .7s linear infinite" }} /><style dangerouslySetInnerHTML={{ __html: "@keyframes ckSpin{to{transform:rotate(360deg)}}" }} /><span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-body)" }}>Taking you to secure checkout…</span></div>
          : kind === "free"
            ? <Btn full size="lg" disabled={!ready} onClick={confirmFree}>RSVP</Btn>
            : <Btn full size="lg" disabled={!ready} onClick={goPay}>Continue to payment · ${total}</Btn>}
        {kind !== "free" && phase !== "paying" && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 11, fontSize: 11.5, color: "var(--text-faint)" }}><Icon name="lock" size={12} w={2} color="var(--text-faint)" />Secure checkout · powered by Stripe</div>}
      </div>
    </div></div>;
  }

  /* ===== who's going - LOCKED aggregate / UNLOCKED named attendee grid ===== */
  function WhosGoing({ e, web, mode, datingViewer, onView }) {
    const f = FOMO[e.id] || {};
    if (mode === "unlocked") {
      const att = e.attendees || [];
      return <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 13 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--text-strong)" }}>Who's going</h3>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{e.count} going</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {att.map((p) => {
            const mutual = MUTUAL_NAMES.has(p.name);
            /* the ONE canonical CK.PeopleCard - here in its no-action variant: NO "click with"
               (clicking is post-event only), the WHOLE CARD opens the profile modal, interests
               only (no intent line on the public attendee list). Same avatar/name/tags anatomy. */
            return <PeopleCard key={p.name} p={p} web={web} layout="grid" action="none" interestsOnly mutual={mutual} onOpen={() => onView && onView(p)} />;
          })}
        </div>
      </section>;
    }
    /* LOCKED - aggregate only, ≥3 floor; COMPACT: cluster+count on one line, lead with the click line, ≤2 lines */
    const second = datingViewer && f.romantic ? f.romantic : (f.belong || f.life);
    const lines = [{ text: "A few people you might click with are going" }];
    if (second) lines.push({ text: second });
    return <section style={{ background: "var(--lavender-wash)", border: "1px solid var(--lavender-300)", borderRadius: "var(--radius-lg)", padding: "16px 18px", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--purple-800)" }}>Who's going</h3>
        <Stack people={e.going} size={28} label={`${e.count} going`} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {lines.map((l, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 600, color: "var(--purple-800)", lineHeight: 1.35 }}><Icon name="users" size={15} w={2} color="var(--purple-500)" />{l.text}</div>)}
      </div>
      <p style={{ margin: "11px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--purple-800)", opacity: .82 }}>Same room, same reason - that's where you click.</p>
    </section>;
  }

  /* ===== photo nudge (only when viewer has no photo; dismissible) ===== */
  function PhotoNudge({ onClose }) {
    return <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6, background: "var(--lavender-wash)", border: "1px solid var(--lavender-300)", borderRadius: "var(--radius-lg)", padding: "14px 16px", marginBottom: 20 }}>
      <button onClick={onClose} aria-label="Dismiss" style={{ position: "absolute", top: 8, right: 8, border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex" }}><Icon name="x" size={15} w={2} color="var(--purple-500)" /></button>
      <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="camera" size={16} w={1.9} color="var(--purple-600)" /></span>
      <a style={{ fontSize: 14, fontWeight: 600, color: "var(--purple-800)", lineHeight: 1.35, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>Add a photo so people recognise you <Icon name="arrowR" size={15} w={2} color="var(--purple-600)" /></a>
      <div style={{ fontSize: 12.5, color: "var(--purple-800)", opacity: .82, lineHeight: 1.4 }}>A face helps people place you when you click after the event.</div>
    </div>;
  }

  /* ===== mobile slim sticky bar (price + one button) - opens the RSVP modal as a bottom sheet ===== */
  function MobileBar({ e, mode, book, onRSVP }) {
    const kind = e.price === "Free" ? "free" : "paid";
    const [joined, setJoined] = useState(false);
    if (mode === "unlocked") return null;
    const bar = { position: "sticky", bottom: 0, left: 0, right: 0, background: "var(--cream)", borderTop: "1px solid var(--mist)", padding: "12px 18px calc(12px + env(safe-area-inset-bottom))", zIndex: 30 };

    if (mode === "waitlist") {
      if (joined) return <div style={bar}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Icon name="clock" size={18} w={2.2} color="#a86f12" /><span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>You're 3rd in line · 30 min to claim a spot</span></div></div>;
      return <div style={bar}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-strong)", flex: "none" }}>{e.price}</span><Btn full onClick={() => setJoined(true)}>Join waitlist</Btn></div></div>;
    }

    return <div style={bar}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: kind === "free" ? "var(--success)" : "var(--text-strong)", flex: "none" }}>{e.price}</span>
        <Btn full onClick={onRSVP}>RSVP</Btn>
      </div>
    </div>;
  }

  /* ===================== PAGE ===================== */
  function EventDetail({ e, web, width, back, booked, book, saved, toggleSave, waitlist, planWith, datingViewer = true }) {
    const mode = booked ? "unlocked" : waitlist ? "waitlist" : "locked";
    const layout = !web ? "phone" : width >= 1024 ? "desktop" : "tablet";
    const [nudge, setNudge] = useState(true);
    const allTags = (e.tags || []).filter((t) => t.toLowerCase() !== (CAT[e.category]?.label || "").toLowerCase());

    /* attendee tap → the SHARED profile modal (window.ScreensB.PersonProfileModal) - same
       component the click-with list opens. They're both at this event, so frame it as shared. */
    const [viewing, setViewing] = useState(null);
    const [clickedSet, setClickedSet] = useState(() => new Set());
    const [rsvpOpen, setRsvpOpen] = useState(false);
    const toProfile = (p) => {
      const rich = (D.CLICK_SUGGEST || []).find((s) => s.name === p.name) || {};
      return { ...rich, ...p, sharedEvent: e.name, overlap: null, mutual: MUTUAL_NAMES.has(p.name), prompt: p.prompt || rich.prompt };
    };
    const PM = window.ScreensB && window.ScreensB.PersonProfileModal;
    const onDone = () => { setRsvpOpen(false); book && book(); };
    const modal = <React.Fragment>
      {viewing && PM
        ? <PM p={viewing} web={web} hideAction clicked={clickedSet.has(viewing.name)} onClick={() => setClickedSet((s) => new Set(s).add(viewing.name))} onClose={() => setViewing(null)} />
        : null}
      {rsvpOpen ? <RSVPModal e={e} web={web} onClose={() => setRsvpOpen(false)} onDone={onDone} /> : null}
    </React.Fragment>;

    /* plan banner - shown when arrived from a coordination proposal; this booking
       counts toward confirmed_together (coord_group_id carried in via planWith) */
    const PlanBanner = () => planWith ? <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--lavender-100)", border: "1px solid var(--lavender-300)", borderRadius: "var(--radius-lg)", padding: "13px 15px", marginBottom: 14 }}>
      <span style={{ flex: "none", width: 32, height: 32, borderRadius: "50%", background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="spark" size={17} color="var(--purple-600)" /></span>
      {mode === "unlocked"
        ? <div style={{ minWidth: 0, fontSize: 13.5, lineHeight: 1.4, color: "var(--purple-800)" }}><b style={{ fontWeight: 700 }}>You're going with {firstName(planWith)}</b><span style={{ display: "block", fontWeight: 500, opacity: .82, marginTop: 1 }}>We'll let {firstName(planWith)} know - you're both set.</span></div>
        : <div style={{ minWidth: 0, fontSize: 13.5, lineHeight: 1.4, color: "var(--purple-800)" }}><b style={{ fontWeight: 700 }}>RSVP to lock in your plan with {firstName(planWith)}</b><span style={{ display: "block", fontWeight: 500, opacity: .82, marginTop: 1 }}>You're both set the moment you save your spot.</span></div>}
    </div> : null;

    /* ---- hero (lives in the left/content column) ---- */
    const Hero = () => <div style={{ position: "relative", borderRadius: layout === "phone" ? 0 : "var(--radius-xl)", overflow: "hidden" }}>
      <Cover category={e.category} h={layout === "phone" ? 220 : 300} radius={0} photo={e.photo} />
      <button onClick={back} aria-label="Back" style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(253,250,246,.93)", border: "none", boxShadow: "var(--shadow-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="chevL" size={20} w={2.4} color="var(--purple-700)" /></button>
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        <button aria-label="Share" style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(253,250,246,.93)", border: "none", boxShadow: "var(--shadow-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ShareIco /></button>
        <CircleBtn icon="bookmark" label="Save" onClick={toggleSave} active={saved} />
      </div>
      <div style={{ position: "absolute", bottom: 14, left: 16, display: "flex", gap: 8 }}>
        {mode === "unlocked" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, lineHeight: 1, borderRadius: "var(--radius-pill)", background: "var(--sage)", color: "#fff" }}><Icon name="check" size={13} w={2.8} />You're going</span> : mode === "waitlist" ? <FullBadge /> : <StatusTag e={e} />}
      </div>
    </div>;

    /* ---- the title + tags + a single quiet context strip (facts live in the panel, not here) ---- */
    const TitleBlock = () => <div>
      <h1 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--text-strong)" }}>{e.name}</h1>
      {/* category + ALL interest tags - the one surface that shows every tag (no meta strip; the panel owns date/time/location) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 11px", fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 600, lineHeight: 1, borderRadius: "var(--radius-pill)", background: "var(--lavender-100)", color: "var(--purple-700)", whiteSpace: "nowrap" }}>{CAT[e.category]?.label || "Event"}</span>
        {allTags.map((t) => <Tag key={t} dense>{t}</Tag>)}
      </div>
    </div>;
    const About = ({ pad }) => <p style={{ margin: pad || "20px 0 24px", fontSize: 15, lineHeight: 1.65, color: "var(--text-body)", textWrap: "pretty" }}>{e.blurb}</p>;

    const Content = ({ withTitle }) => <div>
      {withTitle && <TitleBlock />}
      <WhosGoing e={e} web={web} mode={mode} datingViewer={datingViewer} onView={(p) => setViewing(toProfile(p))} />
      {mode === "unlocked" && nudge && <PhotoNudge onClose={() => setNudge(false)} />}
    </div>;


    /* ---------- DESKTOP: two columns ---------- */
    if (layout === "desktop") {
      return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "8px 40px 56px" }}>
        {modal}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 372px", gap: 36, alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 24 }}><Hero /></div>
            <TitleBlock />
            <About />
            <WhosGoing e={e} web={web} mode={mode} datingViewer={datingViewer} onView={(p) => setViewing(toProfile(p))} />
            {mode === "unlocked" && nudge && <PhotoNudge onClose={() => setNudge(false)} />}
          </div>
          <div style={{ position: "sticky", top: 24 }}><PlanBanner /><Panel><BookingBody e={e} mode={mode} book={book} saved={saved} toggleSave={toggleSave} onRSVP={() => setRsvpOpen(true)} /></Panel></div>
        </div>
      </div>;
    }

    /* ---------- TABLET: single column, panel in-flow after the title ---------- */
    if (layout === "tablet") {
      return <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 32px 48px" }}>
        {modal}
        <div style={{ marginBottom: 22 }}><Hero /></div>
        <TitleBlock />
        <div style={{ margin: "26px 0" }}><PlanBanner /><Panel><BookingBody e={e} mode={mode} book={book} saved={saved} toggleSave={toggleSave} onRSVP={() => setRsvpOpen(true)} /></Panel></div>
        <About pad="0 0 24px" />
        <WhosGoing e={e} web={web} mode={mode} datingViewer={datingViewer} onView={(p) => setViewing(toProfile(p))} />
        {mode === "unlocked" && nudge && <PhotoNudge onClose={() => setNudge(false)} />}
      </div>;
    }

    /* ---------- PHONE: single column + slim sticky bottom bar ---------- */
    return <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {modal}
      <div style={{ flex: 1 }}>
        <Hero />
        <div style={{ padding: "20px 22px 16px" }}>
          <TitleBlock />
          {/* the panel is the single home for the facts - in-flow near the top on mobile (CTA lives in the slim bottom bar for locked/waitlist) */}
          <div style={{ margin: "22px 0 24px" }}><PlanBanner /><Panel><BookingBody e={e} mode={mode} book={book} saved={saved} toggleSave={toggleSave} barCTA={mode !== "unlocked"} onRSVP={() => setRsvpOpen(true)} /></Panel></div>
          <About pad="0 0 24px" />
          <WhosGoing e={e} web={web} mode={mode} datingViewer={datingViewer} onView={(p) => setViewing(toProfile(p))} />
          {mode === "unlocked" && nudge && <PhotoNudge onClose={() => setNudge(false)} />}
        </div>
      </div>
      <MobileBar e={e} mode={mode} book={book} onRSVP={() => setRsvpOpen(true)} />
    </div>;
  }

  window.ScreensED = { EventDetail };
})();
