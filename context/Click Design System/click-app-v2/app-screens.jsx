(function () {
  /* Click - marketing + profile + the SHARED EventCard. Reads primitives from window.CK, data from window.DATA.
     ONE-PAGE-PER-CONCEPT (structure audit, 28 Jun): this file owns only Landing, Profile, and the
     canonical EventCard (used by dashboard / discovery / myevents / quiz). The former duplicate
     Home / Discover / Saved page components were removed - the routed canon lives in
     dashboard.jsx (ScreensDash.Dashboard), discovery.jsx (ScreensDisc.Discover), myevents.jsx
     (ScreensME.MyEvents). Do NOT re-add page components here. */
  const { useState, CAT, STATUS, Icon, Logo, Spark, Cmark, AppTile, Btn, Field, Toggle, Avatar, Stack, Tag, FitTags, Badge, Status, IntentLine, Cover } = window.CK;
  const { EVENTS, BOOKINGS, SAVED, CLICKS, byId } = window.DATA;

  /* ---------------- shared bits ---------------- */
  function Eyebrow({ children, color = "var(--purple-600)" }) {
    return <p style={{ margin: 0, font: "var(--role-overline)", fontWeight: 700, letterSpacing: "var(--tracking-overline)", textTransform: "uppercase", color }}>{children}</p>;
  }
  function SaveBtn({ saved, onClick, light }) {
    return <button onClick={(e) => {e.stopPropagation();onClick && onClick();}} aria-label="Save for later" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: light ? "rgba(253,250,246,.92)" : "var(--white)", boxShadow: "var(--shadow-sm)", flex: "none" }}>
    <Icon name="bookmark" size={18} w={2} color={saved ? "var(--purple-600)" : "var(--ink-muted)"} style={{ fill: saved ? "var(--purple-600)" : "none" }} />
  </button>;
  }

  /* ---------------- event card (all status states) ---------------- */
  function EventCard({ e, onClick, saved, onSave, booked, radarLine, mini }) {
    const [hov, setHov] = useState(false);
    const isBooked = booked != null ? booked : window.DATA.BOOKINGS.includes(e.id);
    const full = e.status === "soldout" || e.full || (e.cap != null && e.count >= e.cap);
    const free = e.price === "Free";
    const tags = e.tags || [];
    const go = (ev) => {ev.stopPropagation();onClick && onClick();};

    /* ONE status badge, top-left (booked > full > status > free) */
    let badge = null;
    if (isBooked) badge = <Status kind="going" />;else
    if (full) badge = <Status kind="full" />;else
    if (e.status && e.status !== "free") badge = <Status kind={e.status} />;else
    if (free) badge = <Status kind="free" />;

    /* MOBILE MINI (2-up): 16:9 banner · date · title(2) · suburb · price + N going.
       No inline RSVP, no tag row - the whole card taps through to the event detail. */
    if (mini) return <div onClick={onClick} style={{ display: "flex", flexDirection: "column", background: "var(--white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)", overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", flex: "none" }}>
        <Cover category={e.category} aspect="16/9" dim={full} photo={e.photo} />
        {badge && <div style={{ position: "absolute", top: 8, left: 8, transform: "scale(.9)", transformOrigin: "top left" }}>{badge}</div>}
        <div style={{ position: "absolute", top: 8, right: 8 }}><SaveBtn saved={saved} onClick={onSave} light /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
          <Icon name="calendar" size={12} w={1.9} color="var(--text-muted)" /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.when}</span>
        </div>
        <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--card-title)", fontWeight: 600, letterSpacing: "-.01em", lineHeight: "22px", color: "var(--text-strong)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minWidth: 0 }}>{e.name}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, marginTop: 5, fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
          <Icon name="pin" size={12} w={1.9} color="var(--text-muted)" /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[e.suburb, e.dist].filter(Boolean).join(" · ")}</span>
        </div>
        <div style={{ marginTop: "auto", paddingTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: free ? "var(--success)" : "var(--text-strong)" }}>{e.price}</span>
          {e.count >= 3 && <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{e.count} going</span>}
        </div>
      </div>
    </div>;


    return <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{ display: "flex", flexDirection: "column", background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-soft)", boxShadow: hov ? "var(--shadow-lg)" : "var(--shadow-sm)", overflow: "hidden", cursor: "pointer", transition: "box-shadow .2s,transform .2s", transform: hov ? "translateY(-3px)" : "none" }}>
      <div style={{ position: "relative", flex: "none" }}>
        <Cover category={e.category} aspect="16/9" dim={full} photo={e.photo} />
        {badge && <div style={{ position: "absolute", top: 13, left: 13 }}>{badge}</div>}
        <div style={{ position: "absolute", top: 13, right: 13 }}><SaveBtn saved={saved} onClick={onSave} light /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: 14 }}>
        {/* Block 1 - date eyebrow · title · location (tight) */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
            <Icon name="calendar" size={13} w={1.9} color="var(--text-muted)" /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.when}</span>
          </div>
          <h3 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--card-title)", fontWeight: 600, letterSpacing: "-.01em", lineHeight: "24px", color: "var(--text-strong)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minWidth: 0 }}>{e.name}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, marginTop: 6, fontSize: 13.5, color: "var(--text-muted)", fontWeight: 500 }}>
            <Icon name="pin" size={14} w={1.9} color="var(--text-muted)" /><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isBooked ? [e.venue, e.suburb].filter(Boolean).join(" · ") : [e.suburb, e.dist].filter(Boolean).join(" · ")}</span>
            {!isBooked && <span title="Venue shown when you RSVP" aria-label="Venue shown when you RSVP" style={{ flex: "none", display: "inline-flex", marginLeft: 1 }}><Icon name="lock" size={11} w={2} color="var(--text-faint)" /></span>}
          </div>
        </div>
        {/* Block 2 - tags · going row (8px below block 1, ~8px internal) */}
        <div style={{ marginTop: 8 }}>
          {tags.length > 0 && <div style={{ minWidth: 0 }}><FitTags tags={tags} max={3} /></div>}
          <div style={{ marginTop: tags.length > 0 ? 8 : 0 }}>{e.count >= 3 ? <Stack people={e.going} size={24} label={`${e.count} going`} /> : <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Be one of the first</span>}</div>
          {radarLine && <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--purple-700)", lineHeight: 1.3 }}>
            <Icon name={radarLine.icon || "spark"} size={14} w={1.9} color="var(--purple-500)" /><span>{radarLine.line}</span>
          </div>}
        </div>
        {/* Footer - pinned to bottom; 1px Mist hairline + 12px; price left, CTA right */}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--mist)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: free ? "var(--success)" : "var(--text-strong)" }}>{e.price}</span>
          {isBooked ?
          <Btn variant="secondary" size="sm" onClick={go}>View details</Btn> :
          full ?
          <Btn size="sm" onClick={go}>Join waitlist</Btn> :
          <Btn size="sm" onClick={go}>RSVP</Btn>}
        </div>
      </div>
    </div>;
  }

  /* ---------------- candid "real life is happening" band - backlit warm gathering,
     people PRESENT but faces turned/cropped (silhouettes, never identifiable). ---------------- */
  function GatheringScene() {
    const figs = [70, 200, 330, 470, 600, 725];
    return <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} viewBox="0 0 800 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="rlSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F4C56B" /><stop offset=".6" stopColor="#D8924E" /><stop offset="1" stopColor="#7A4A2E" /></linearGradient>
        <radialGradient id="rlGlow" cx=".5" cy=".3" r=".55"><stop offset="0" stopColor="#FFE6A8" stopOpacity=".9" /><stop offset="1" stopColor="#FFE6A8" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="800" height="360" fill="url(#rlSky)" />
      <rect x="120" y="18" width="560" height="180" rx="12" fill="#FBE3A0" opacity=".5" />
      <ellipse cx="400" cy="120" rx="330" ry="150" fill="url(#rlGlow)" />
      {[80, 180, 300, 430, 560, 690, 745].map((x, i) => <circle key={i} cx={x} cy={28 + i % 3 * 10} r={4 - i % 2} fill="#FFEFC4" opacity=".8" />)}
      <rect x="0" y="250" width="800" height="110" fill="#5E3A24" /><rect x="0" y="240" width="800" height="14" fill="#7A4A2E" />
      {[120, 250, 400, 540, 670].map((x, i) => <g key={i}><ellipse cx={x} cy="246" rx="20" ry="5" fill="#3E2418" /><rect x={x - 5} y="214" width="10" height="30" rx="3" fill="#C98A55" opacity=".5" /><path d={`M${x - 8} 214 q8 -6 16 0 z`} fill="#F4C56B" opacity=".6" /></g>)}
      {figs.map((x, i) => {const hy = 150 + i % 2 * 8;return <g key={i} fill="#3A2014"><ellipse cx={x} cy={hy} rx="26" ry="20" /><path d={`M${x - 44} 250 q4 -54 44 -56 q40 2 44 56 z`} /></g>;})}
      <g stroke="#F4C56B" strokeWidth="6" strokeLinecap="round"><path d="M250 150 l18 -34" /><path d="M330 150 l-18 -34" /></g>
      <ellipse cx="270" cy="112" rx="9" ry="6" fill="#FBE3A0" /><ellipse cx="310" cy="112" rx="9" ry="6" fill="#FBE3A0" />
    </svg>;
  }
  function RealLifeBand({ web }) {
    return <div style={{ ...{ maxWidth: web ? "var(--container-max)" : "none", margin: "0 auto", padding: web ? "8px 40px 18px" : "8px 22px 14px" }, padding: "20px 40px 40px" }}>
      <div style={{ position: "relative", borderRadius: web ? 24 : 18, overflow: "hidden", minHeight: web ? 300 : 320, display: "flex", alignItems: "flex-end", boxShadow: "var(--shadow-md)" }}>
        <GatheringScene />
        <span style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(38,20,10,.66),rgba(38,20,10,.14) 58%,transparent)" }} />
        <div style={{ position: "relative", padding: web ? "36px 40px" : "24px 22px", maxWidth: 520 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: web ? "clamp(22px,2.6cqi,30px)" : 21, fontWeight: 600, lineHeight: 1.2, color: "var(--cream)", textWrap: "balance" }}>Real things, real people - across inner Sydney.</p>
          <p style={{ margin: "10px 0 0", fontSize: web ? 15.5 : 14, lineHeight: 1.55, color: "rgba(249,246,240,.92)", maxWidth: 420 }}>What's on this week across Newtown, Surry Hills &amp; Redfern - small groups, real places, every week.</p>
        </div>
      </div>
    </div>;
  }

  /* ---------------- 1 · LANDING (marketing, pre-signup) ---------------- */
  function Landing({ web, enter, auth }) {
    const [postcode, setPostcode] = useState("");const [email, setEmail] = useState("");const [mode, setMode] = useState("pre");const [open, setOpen] = useState(false);const [sent, setSent] = useState(false);
    const steps = [["compass", "Find something on", "Real venues, real things to do - this week, near you. Browse what's on and RSVP."], ["users", "Show up", "The activity is the icebreaker. You're in the room with people who chose the same thing."], ["spark", "If you click, you both find out", "Quietly note who you clicked with. Nothing happens unless they feel the same."]];
    return <div style={{ minHeight: "100%", background: "var(--cream)", fontFamily: "var(--font-sans)" }}>
    {/* marketing header - minimal: pre-launch shows NO auth nav, post-launch shows Log in + Sign up (no app nav on marketing pages) */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: web ? "22px 40px" : "16px 20px", maxWidth: web ? "var(--container-max)" : "none", margin: "0 auto" }}>
      <span aria-hidden="true" />
      <div style={{ display: "inline-flex", alignItems: "center", gap: web ? 16 : 10 }}>
        {/* mockup-only state toggle (demonstrates pre vs post launch) */}
        <div style={{ display: "inline-flex", background: "var(--white)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
          {[["pre", "Pre-launch"], ["post", "Post-launch"]].map(([k, l]) => {const on = mode === k;return <button key={k} onClick={() => {setMode(k);setOpen(false);setSent(false);}} style={{ border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "6px 12px", fontFamily: "var(--font-display)", fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? "var(--purple-600)" : "transparent", color: on ? "var(--cream)" : "var(--text-body)" }}>{l}</button>;})}
        </div>
        {/* post-launch: the only marketing-header nav is Log in + Sign up. pre-launch: none. */}
        {mode === "post" && <div style={{ display: "inline-flex", alignItems: "center", gap: web ? 8 : 4 }}>
          <button onClick={() => auth ? auth("signin") : enter()} style={{ border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500, color: "var(--text-body)", padding: "8px 10px" }}>Log in</button>
          <Btn size="sm" onClick={() => auth ? auth("signup") : enter()}>Sign up</Btn>
        </div>}
      </div>
    </div>
    {/* hero - dictionary entry + action */}
    <div style={{ maxWidth: web ? "var(--container-max)" : "none", margin: "0 auto", padding: web ? "clamp(24px,5cqi,56px) 40px 56px" : "14px 22px 36px", display: web ? "grid" : "block", gridTemplateColumns: web ? "1.1fr .9fr" : "none", gap: web ? 72 : 0, alignItems: "start" }}>
      {/* the definition */}
      <div style={{ maxWidth: 560 }}>
        <Logo size={web ? 104 : 74} />
        <p style={{ margin: web ? "18px 0 0" : "14px 0 0", fontSize: web ? 19 : 16, color: "var(--text-muted)" }}>/klɪk/ · <span style={{ fontStyle: "italic" }}>verb</span></p>
        <div style={{ display: "flex", gap: 12, margin: "18px 0 0" }}>
          <span style={{ flex: "none", fontFamily: "var(--font-display)", fontSize: web ? "clamp(22px,2.6cqi,28px)" : 21, fontWeight: 600, lineHeight: 1.5, color: "var(--purple-500)" }}>1.</span>
          <p style={{ margin: 0, fontSize: web ? "clamp(22px,2.6cqi,28px)" : 21, lineHeight: 1.5, color: "var(--text-strong)", textWrap: "pretty" }}>to connect effortlessly with someone through shared curiosity, energy, or experience.</p>
        </div>
        <p style={{ margin: "12px 0 0 36px", fontSize: web ? 16 : 14.5, fontStyle: "italic", lineHeight: 1.55, color: "var(--text-muted)", textWrap: "pretty" }}>&ldquo;we met at pickleball and just clicked!&rdquo;</p>
        <hr style={{ border: "none", borderTop: "1px solid var(--border-mid)", margin: "28px 0 0", width: 110, marginLeft: 0 }} />
        <p style={{ margin: "24px 0 0", fontFamily: "var(--font-display)", fontSize: web ? 19 : 17, fontWeight: 500, lineHeight: 1.45, color: "var(--text-strong)", maxWidth: 440, textWrap: "pretty" }}>We help people click in real life - not just online.</p>
      </div>
      {/* action column */}
      <div style={{ marginTop: web ? 6 : 34 }}>
        {mode === "pre" ? sent ? <div style={{ maxWidth: 420 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "color-mix(in srgb,var(--success) 16%,#fff)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}><Icon name="check" size={24} w={2.6} color="var(--success)" /></div>
          <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontSize: web ? 24 : 21, fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>You're on the list.</h2>
          <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)" }}>We'll be in touch when your suburb opens. No rush - good things are worth showing up for.</p>
          <div style={{ background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <Eyebrow color="var(--text-muted)">Want in sooner?</Eyebrow>
            <p style={{ margin: "10px 0 14px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-strong)" }}>Invite friends - every one moves you up. <b>Three guarantees you a spot in the first round.</b></p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--cream)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "10px 12px" }}><code style={{ flex: 1, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 13, color: "var(--text-strong)" }}>click.au/i/ava-m</code><span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--purple-600)" }}>Copy link</span></div>
          </div>
          <div style={{ marginTop: 18 }}><Btn variant="secondary" onClick={enter} icon="arrowR">Take me in</Btn></div>
        </div> : <div style={{ maxWidth: 400 }}>
          {!open ?
            <Btn size="lg" onClick={() => setOpen(true)}>Request an invite</Btn> :
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field placeholder="you@email.com" icon="bell" value={email} onChange={setEmail} />
                <Field placeholder="Suburb or postcode" icon="pin" value={postcode} onChange={setPostcode} />
                <Btn full size="lg" onClick={() => setSent(true)}>Request an invite</Btn>
              </div>}
          <p style={{ margin: "18px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: 380 }}><b style={{ color: "var(--text-strong)" }}>Invite-only.</b> Launching first in Sydney. 40+ events already in the works.</p>
          <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: 380 }}>Somewhere else? Join anyway - we'll tell you the moment Click reaches you.</p>
          <span onClick={enter} style={{ display: "inline-block", marginTop: 18, fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500, color: "var(--purple-600)", borderBottom: "1px solid color-mix(in srgb,var(--purple-600) 30%,transparent)", paddingBottom: 1, cursor: "pointer" }}>How clicking works →</span>
        </div> : <div>
          <Btn size="lg" onClick={() => auth ? auth("signup") : enter()}>Get in</Btn>
          <p style={{ margin: "16px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: 380 }}>Free to join. Live in Sydney. Somewhere else? Join anyway - we'll tell you the moment Click reaches you.</p>
          <span onClick={enter} style={{ display: "inline-block", marginTop: 18, fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 500, color: "var(--purple-600)", borderBottom: "1px solid color-mix(in srgb,var(--purple-600) 30%,transparent)", paddingBottom: 1, cursor: "pointer" }}>How clicking works →</span>
        </div>}
      </div>
    </div>
    {mode === "post" && <div style={{ maxWidth: web ? "var(--container-max)" : "none", margin: "0 auto", padding: web ? "8px 40px 12px" : "0 22px 8px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(1.14375rem, 0.982rem + 0.69cqi, 1.5rem)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>What's on near you this week</h2>
        <span onClick={enter} style={{ flex: "none", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", cursor: "pointer", whiteSpace: "nowrap" }}>See everything on →</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(auto-fill,minmax(280px,1fr))" : "repeat(2,1fr)", gap: web ? 22 : 12 }}>
        {EVENTS.slice(0, 3).map((e) => <EventCard key={e.id} e={e} mini={!web} onClick={enter} saved={false} onSave={() => {}} />)}
      </div>
    </div>}
    {mode === "post" && <RealLifeBand web={web} />}
  </div>;
  }

  /* ---------------- Profile (with visibility opt-out) ---------------- */
  /* neutral interest/intent chip - white fill, Mist hairline, Ink (per Buttons_Tags) */
  function SelChip({ active, onClick, children }) {
    return <button onClick={onClick} style={{ padding: "7px 15px", fontSize: 13, fontWeight: 600, borderRadius: "var(--radius-pill)", cursor: "pointer", border: `1.5px solid ${active ? "var(--purple-600)" : "var(--border-mid)"}`, background: active ? "var(--purple-600)" : "var(--white)", color: active ? "var(--cream)" : "var(--text-body)", fontFamily: "var(--font-sans)", transition: "all .15s" }}>{children}</button>;
  }
  function NeutralChip({ children }) {
    return <Tag>{children}</Tag>;
  }
  function SectionLabel({ children }) {
    return <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-600)" }}>{children}</p>;
  }

  function Profile({ web, onEdit }) {
    /* warm-graded lifestyle photos (the app's canonical real-photo stand-in) - never empty dashed slots */
    const PHOTOS = [["ceramics", "Ava at the wheel", "bright"], ["run", "Sunrise run, Marrickville", "cool"], ["wine", "Wine bar evening", "warm"], ["music", "Open-decks night", "dusk"]];
    const HISTORY = [
    ["Wheel throwing - two mugs", "Posy Ceramics, Newtown · Thu 6:30pm"],
    ["Sunrise run + coffee, 5k", "Marrickville · Sat 6:15am"],
    ["Native cocktails, four pours", "Surry Hills · Fri 7pm"]];

    return <div style={{ padding: web ? "8px 0 40px" : "0 0 24px" }}>
    <div style={{ maxWidth: web ? 1060 : "none", margin: "0 auto", padding: web ? "0 40px" : "0 22px" }}>
    <div style={{ maxWidth: web ? 660 : "none" }}>

      {/* ONE profile card - the SAME light card the viewer modal renders, here on cream */}
      <div style={{ background: "var(--white)", borderRadius: 18, border: "1px solid #EDE9F2", boxShadow: "0 2px 10px rgba(28,24,48,.05)", padding: web ? 30 : 22, marginTop: 8 }}>

        {/* header - avatar · text column · action, all on one axis */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: web ? 18 : 14, minWidth: 0 }}>
            <div style={{ width: web ? 80 : 64, height: web ? 80 : 64, borderRadius: "50%", overflow: "hidden", flex: "none", boxShadow: "0 0 0 3px var(--white), 0 0 0 4px var(--lavender-300)" }}><Cover category="wine" h={web ? 80 : 64} photo="Ava - warm portrait" tone="warm" /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-600)" }}>Your profile</span>
              <div style={{ fontSize: "var(--text-h1)", fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--ink)", lineHeight: 1.2 }}>Ava · 28</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: web ? 14 : 13, color: "var(--text-muted)", fontWeight: 500, marginTop: 7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Icon name="pin" size={14} w={1.9} color="var(--text-muted)" style={{ flex: "none" }} />Newtown · <span style={{ color: "var(--purple-600)", fontWeight: 600 }}>{web ? "been to 6 events" : "6 events"}</span></div>
            </div>
          </div>
          <Btn size="sm" onClick={onEdit}>{web ? "Edit profile" : "Edit"}</Btn>
        </div>

        <div style={{ height: 1, background: "#EDE9F2", margin: "20px 0" }} />

        {/* Bio */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Bio</SectionLabel>
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: "var(--text-strong)" }}>Moved back to Sydney and after a steady weekend circle - pottery, runs, easy company.</p>
        </div>

        {/* Here for - Lavender-wash intent chips (rank above interests; never filter-button styled) */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Here for</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["Here for friends", "Open to activities"].map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 13px", fontSize: 13, fontFamily: "var(--font-sans)", fontWeight: 600, lineHeight: 1, borderRadius: "var(--radius-pill)", background: "var(--lavender-wash)", border: "1px solid var(--lavender-300)", color: "var(--ink)", whiteSpace: "nowrap" }}>{t}</span>)}</div>
        </div>

        {/* Into - neutral chips */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Into</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{["Pottery", "Run clubs", "Live music", "Wine", "Plants", "Cocktails"].map((t) => <NeutralChip key={t}>{t}</NeutralChip>)}</div>
        </div>

        {/* Photos - warm-graded gallery w/ tonal variety; ONE warm add-card as the empty state */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Photos</SectionLabel>
          {PHOTOS.length > 0
            ? <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(4,1fr)" : "repeat(3,1fr)", gap: 10 }}>
                {PHOTOS.map(([cat, desc, tone], i) => <div key={i} style={{ aspectRatio: "1", borderRadius: "var(--radius-md)", overflow: "hidden" }}><Cover category={cat} aspect="1" photo={desc} tone={tone} /></div>)}
              </div>
            : <div style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--lavender-100)", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
                <span style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="camera" size={20} w={1.9} color="var(--purple-600)" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.3 }}>Add a few photos so people can put a face to the name</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>A face helps people place you when you click after an event.</div>
                </div>
                <Btn size="sm" variant="secondary" icon="plus">Add photos</Btn>
              </div>}
        </div>

        {/* Events - hairline-divided ROWS inside the card (no cards-in-cards) */}
        <div>
          <SectionLabel>Events you've been to</SectionLabel>
          <div>
            {HISTORY.map(([name, meta], i) => <div key={name} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderTop: i ? "1px solid #EDE9F2" : "none" }}>
              <span style={{ flex: "none", width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--lavender-100)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="calendar" size={17} w={1.9} color="var(--purple-500)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{meta}</div>
              </div>
              <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, color: "var(--success)", background: "color-mix(in srgb,var(--success) 12%,var(--white))", border: "1px solid color-mix(in srgb,var(--success) 24%,transparent)", borderRadius: "var(--radius-pill)" }}>Attended</span>
            </div>)}
          </div>
        </div>

      </div>
    </div>
    </div>
  </div>;
  }

  window.ScreensA = { Landing, EventCard, Profile, Eyebrow };

})();