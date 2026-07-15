(function () {
  /* Click - the post-event click surface (Who was there), the mutual reveal, and the
     no-chat coordination flow. WEB-only; anonymous-until-mutual; no timer ever shown.
     Inline styles; primitives from window.CK; events from window.DATA. */
  const { useState, useEffect, Icon, Spark, Cmark, Btn, ClickBtn, Avatar, Cover, Tag, PeopleCard } = window.CK;
  const useRefC = React.useRef;
  const FitTags = window.CK.FitTags;
  const D = window.DATA;
  const byId = D.byId;

  /* attendance-gated pool - only people who actually attended + are visible (window.DATA). */
  const WERE_THERE = D.WERE_THERE;
  const first = (n) => n.split(" ")[0];

  /* once-for-the-screen anonymous reassurance line */
  function AnonLine({ how }) {
    return <p style={{ margin: "0", fontSize: 13, color: "var(--text-muted)", display: "inline-flex", alignItems: "flex-start", gap: 7, lineHeight: 1.5 }}>
    <Icon name="lock" size={14} w={1.9} color="var(--text-muted)" style={{ marginTop: 1, flex: "none" }} />
    <span>Clicking is anonymous - we'll only show you if it's mutual. {how && <span onClick={how} style={{ color: "var(--purple-600)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>How clicking works →</span>}</span>
  </p>;
  }

  /* one attendee = the ONE canonical CK.PeopleCard (identical to discovery / dashboard); the
     post-event grid uses the narrow "grid" layout (paired bottom action row). Pre-mutual, so
     postMutual=false - the commonality line is event / music / proximity only, never a life tag. */
  function Tile({ p, clicked, onClick, onView }) {
    /* p.mutual is the simulation flag ("this one will be mutual once you click") - pre-click the
       card must render the DEFAULT state; the Sage "clicked ✨" only appears after your click. */
    return <PeopleCard p={p} layout="grid" action="click" postMutual={false} mutual={clicked && !!p.mutual} clicked={clicked} onClick={onClick} onView={onView} />;
  }

  /* ============================ WHO WAS THERE (Process 2) ============================ */
  function WhoWasThere({ web, event, mode = "default", datingViewer = false, onMutual, onClose, onDiscover, onConnected, onSuggest, onHow }) {
    const e = event || byId(D.RECENT);
    const [clicked, setClicked] = useState(() => new Set());
    const [viewing, setViewing] = useState(null); // person whose profile modal is open
    const PAGE = 12; // initial batch; "Show more" lazy-loads the rest
    const [shown, setShown] = useState(PAGE);
    const PM = window.ScreensB && window.ScreensB.PersonProfileModal;
    const doClick = (p) => {
      setClicked((s) => {const n = new Set(s);n.add(p.name);return n;});
      if (p.mutual && onMutual) setTimeout(() => onMutual(p.name, "friends"), 950);
    };
    const rel = (D.RECENT_REL || "Yesterday").toLowerCase();
    /* canonical quiet back link - same form/position as every other sub-page (Settings, Booking) */
    const back = <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", cursor: "pointer", padding: "6px 0", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}><Icon name="chevL" size={18} w={2.4} color="var(--text-muted)" />Back</button>;
    /* ONE shared signed-in container (matches Dashboard / My Events): max ~1060 centred with
       40px gutters; the page content sits LEFT-aligned within it (capped at `max`), whitespace
       to the right - never a narrow column floating in the middle. */
    const Page = ({ max, children }) => <div style={{ padding: web ? "10px 0 48px" : "4px 0 24px" }}>
    <div style={{ maxWidth: web ? 1060 : "none", margin: "0 auto", padding: web ? "0 40px" : "0 22px" }}>
      <div style={{ maxWidth: web ? max : "none" }}>{children}</div>
    </div>
  </div>;

    /* shared-context first (a real commonality line - event / music / proximity), then the rest */
    const hasCtx = (x) => !!(x.sharedEvent || x.sharedMusic || x.proximity);
    const people = WERE_THERE.slice().sort((a, b) => (hasCtx(b) ? 1 : 0) - (hasCtx(a) ? 1 : 0));
    const datingCount = people.filter((p) => p.dating).length;
    const visible = people.slice(0, shown);
    const remaining = people.length - visible.length;

    return <Page max={880}>
    {/* back link - canonical quiet link, top-left, own row (one left edge for the whole header) */}
    <div style={{ marginBottom: web ? 16 : 14 }}>{back}</div>
    {/* header: eyebrow (event context) -> title -> subline, left-aligned */}
    <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--purple-600)", marginBottom: 8 }}>{rel} · {e.name}</div>
    <h1 style={{ margin: "0 0 9px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--text-strong)" }}>Did you click with anyone?</h1>
    <p style={{ margin: "0 0 14px", fontSize: web ? 15 : 14, color: "var(--text-body)", lineHeight: 1.55 }}>Click anyone worth a second hang - we'll do the rest.</p>

    {/* anonymity reassurance - once, BEFORE the grid */}
    <div style={{ marginBottom: datingViewer && datingCount >= 3 ? 12 : 20 }}><AnonLine how={onHow} /></div>

    {/* romantic overlay - dating-mode viewers only, aggregate (≥3), never on a named card */}
    {people.length > 0 && datingViewer && datingCount >= 3 &&
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--purple-700)", display: "inline-flex", alignItems: "center", gap: 7, lineHeight: 1.5, fontWeight: 500 }}>
        <Spark size={15} /> A few people here are open to dating too.
      </p>}

    {people.length === 0 ?
      <div style={{ background: "var(--surface-tint)", borderRadius: "var(--radius-xl)", padding: "44px 26px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Spark size={30} /></div>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: "clamp(1.14375rem, 1.073rem + 0.30cqi, 1.3rem)", fontWeight: 600, color: "var(--text-strong)" }}>Quiet one</h2>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55 }}>No one to click with here. Your next event is where it happens.</p>
        </div> :
      <>
          {/* aggregate count - never singles anyone out */}
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600, marginBottom: 13 }}>{people.length} people were there</div>
          <div style={{ display: "grid", gridTemplateColumns: web ? "1fr 1fr" : "1fr", gap: 16 }}>
            {visible.map((p, i) => <Tile key={p.name} p={p} clicked={clicked.has(p.name)} onClick={() => doClick(p)} onView={() => setViewing(p)} />)}
          </div>
          {remaining > 0 &&
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
              <Btn variant="secondary" onClick={() => setShown((s) => s + PAGE)}>Show more ({remaining})</Btn>
            </div>}
        </>}

    {/* View profile → the SHARED profile modal (same component the discovery list opens);
           they were both at this event, so frame it as shared */}
    {viewing && PM && <PM p={{ ...viewing, sharedEvent: e.name }} web={web} clicked={clicked.has(viewing.name)} onClick={() => {doClick(viewing);setViewing(null);}} onClose={() => setViewing(null)} />}
  </Page>;
  }

  /* ============================ MUTUAL REVEAL (the signature moment) ============================ */
  /* one-shot confetti burst - canvas + rAF (immune to re-render restarts, unlike CSS
     animations in this app); brand palette; honours prefers-reduced-motion; ~2s then stops. */
  function ConfettiBurst() {
    const ref = useRefC(null);
    useEffect(() => {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cv = ref.current; if (!cv) return;
      const box = cv.parentElement.getBoundingClientRect();
      const W = cv.width = Math.max(1, Math.round(box.width));
      const H = cv.height = Math.max(1, Math.round(box.height));
      const ctx = cv.getContext("2d");
      const COLORS = ["#3B2F81", "#C8B8F8", "#8CA88F", "#E8B04B", "#F0ECF4"];
      const N = 90;
      const parts = Array.from({ length: N }, () => {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const sp = 4 + Math.random() * 7.5;
        return { x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.34, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: 5 + Math.random() * 4, h: 8 + Math.random() * 5, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.28, c: COLORS[Math.random() * COLORS.length | 0], delay: Math.random() * 8 };
      });
      let frame = 0, raf;
      const tick = () => {
        frame++;
        ctx.clearRect(0, 0, W, H);
        let alive = false;
        const fade = frame > 95 ? Math.max(0, 1 - (frame - 95) / 35) : 1;
        for (const p of parts) {
          if (frame < p.delay) { alive = true; continue; }
          p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          if (p.y < H + 20 && fade > 0) alive = true;
          ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
        }
        if (alive && frame < 132) raf = requestAnimationFrame(tick);else ctx.clearRect(0, 0, W, H);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }} />;
  }
  function MutualReveal({ web, name = "Mia R.", intent, tags, dating, onSuggest, onClose, onHow }) {
    const mc = (window.DATA.CLICKS || []).find((c) => c.name === name) || {};
    const it = intent || mc.intent || "friends";
    const tg = (tags || mc.tags || []).slice(0, 2);
    const dt = dating != null ? dating : !!mc.dating;
    return <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: web ? 28 : 18, background: "rgba(28,24,48,.55)" }}>
    <div style={{ position: "relative", width: "100%", maxWidth: 420, background: "var(--white)", borderRadius: "var(--radius-2xl)", padding: web ? "36px 32px 30px" : "30px 24px 26px", textAlign: "center", overflow: "hidden", boxShadow: "var(--shadow-xl)" }}>
      <ConfettiBurst />
      <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(28,24,48,.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}><Icon name="x" size={16} w={2.2} color="var(--text-muted)" /></button>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 13, marginBottom: 16 }}>
          <span style={{ width: 74, height: 74, borderRadius: "50%", background: "color-mix(in srgb,var(--purple-600) 9%,var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}><Spark size={42} big="var(--purple-600)" small="var(--purple-600)" /></span>
          <Avatar name={name} size={54} ring />
        </div>
        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text-strong)" }}>You clicked with {(name || "").split(" ")[0]}.</h2>
        {mc.event && <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>You were both at <b style={{ fontWeight: 600, color: "var(--text-body)" }}>{mc.event}</b>{mc.met ? ` on ${mc.met}` : ""}</p>}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: "var(--radius-pill)", background: "color-mix(in srgb,var(--sage) 14%,var(--white))", marginBottom: tg.length ? 12 : 16 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sage)" }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--sage)" }}>You're both here for {it}{dt ? " · both open to dating" : ""}</span>
        </div>
        {tg.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 16 }}>
          {tg.map((t) => <Tag key={t} dense>{t}</Tag>)}
        </div>}
        <p style={{ margin: "0 0 22px", fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55 }}>Find a thing you'd both enjoy, and just show up.</p>
        <Btn full size="lg" onClick={onSuggest}>Suggest a plan</Btn>
        <button onClick={onClose} style={{ margin: "12px auto 2px", display: "block", background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)", cursor: "pointer" }}>Maybe later</button>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}><span onClick={onHow} style={{ color: "var(--purple-600)", fontWeight: 600, cursor: "pointer" }}>How clicking works →</span></p>
      </div>
    </div>
  </div>;
  }

  /* ============================ COORDINATION (no-chat planning) ============================ */
  function Coordinate({ web, start = "suggest", name = "Mia R.", onClose, onHow, onRSVP, onOpenEvent }) {
    const [step, setStep] = useState(start);
    useEffect(() => {setStep(start);}, [start]);
    const [evIdx, setEvIdx] = useState(0);
    const [customEv, setCustomEv] = useState(null); // chosen via "Suggest your own" picker
    const [picker, setPicker] = useState(false); // event picker open
    const [preview, setPreview] = useState(false); // read-only event-detail preview
    const [previewBooked, setPreviewBooked] = useState(false); // preview the UNLOCKED (booked) view (both-going)
    const [savedPlan, setSavedPlan] = useState(false); // in-flow bookmark from the suggest preview (zero commitment)
    const [q, setQ] = useState(""); // picker search
    const [qDeb, setQDeb] = useState(""); // debounced picker search (typeahead)
    useEffect(() => { const t = setTimeout(() => setQDeb(q), 250); return () => clearTimeout(t); }, [q]);
    const pool = ["ev2", "ev4", "ev3"].map(byId);
    const ev = customEv || pool[evIdx % pool.length];
    const fn = first(name);
    const goingTo = (id) => (D.BOOKINGS || []).includes(id);
    const Shell = ({ children, eyebrow = "Suggest a plan" }) => <div style={{ position: "fixed", inset: 0, zIndex: 62, display: "flex", alignItems: web ? "center" : "flex-end", justifyContent: "center", padding: web ? 28 : 0, background: "rgba(28,24,48,.55)" }}>
    <div style={{ position: "relative", width: "100%", maxWidth: web ? 520 : "none", maxHeight: web ? "88vh" : "94vh", overflowY: "auto", background: "var(--white)", borderRadius: web ? "var(--radius-2xl)" : "var(--radius-2xl) var(--radius-2xl) 0 0", boxShadow: "var(--shadow-xl)", padding: web ? "20px 28px 28px" : "16px 20px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{eyebrow}</span>
        <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(28,24,48,.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={16} w={2.2} color="var(--text-muted)" /></button>
      </div>
      {children}
    </div>
  </div>;

    /* mini event card used across steps; pass onTap to make it open the Event Detail page */
    const EventMini = ({ e, dim, onTap }) => {
      const style = { display: "flex", alignItems: "center", gap: 14, background: "var(--white)", border: "1px solid #EDE9F2", borderRadius: "var(--radius-lg)", padding: 13, boxShadow: dim ? "none" : "var(--shadow-sm)", opacity: dim ? .6 : 1 };
      const inner = <React.Fragment>
      <div style={{ width: 60, height: 60, borderRadius: 12, overflow: "hidden", flex: "none" }}><Cover category={e.category} h={60} photo={e.photo} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>{[e.when, e.suburb, e.price].filter(Boolean).join(" · ")}</div>
      </div>
      {onTap && <Icon name="chevR" size={18} w={2.2} color="var(--text-muted)" style={{ flex: "none" }} />}
    </React.Fragment>;
      return onTap ?
      <button onClick={onTap} aria-label={`View ${e.name} details`} style={{ ...style, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>{inner}</button> :
      <div style={style}>{inner}</div>;
    };

    /* one-line interest tags with +N overflow (matches the People/Event card rule) */
    const TagRow = ({ tags = [], max = 2 }) => {
      const show = tags.slice(0, max),extra = tags.length - show.length;
      if (show.length === 0) return null;
      return <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", overflow: "hidden", minWidth: 0 }}>
      {show.map((t) => <span key={t} style={{ flex: "none", display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", fontSize: 11.5, fontFamily: "var(--font-sans)", fontWeight: 600, borderRadius: "var(--radius-pill)", background: "var(--white)", border: "1px solid var(--border-mid)", color: "var(--text-strong)", whiteSpace: "nowrap" }}>{t}</span>)}
      {extra > 0 && <span style={{ flex: "none", fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>+{extra}</span>}
    </div>;
    };

    /* proposal card - the canonical COMPACT Event Card mini: small banner thumbnail (~110px),
       date · title · suburb+distance · price · tags. This card IS the preview - no separate overlay. */
    const ProposalCard = ({ e }) => <div style={{ display: "block", width: "100%", textAlign: "left", background: "var(--white)", border: "1px solid #EDE9F2", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
    <div style={{ position: "relative" }}>
      <Cover category={e.category} h={110} photo={e.photo} />
    </div>
    <div style={{ padding: "13px 15px 15px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4 }}><Icon name="calendar" size={13} w={1.9} color="var(--text-muted)" /><span>{e.when}</span></div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.25, marginBottom: 5 }}>{e.name}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, display: "inline-flex", gap: 5, alignItems: "center", marginBottom: 11 }}><Icon name="pin" size={13} w={1.9} color="var(--text-muted)" /><span>{[e.suburb, e.dist].filter(Boolean).join(" · ")} · {e.price}</span></div>
      <TagRow tags={e.tags} />
    </div>
  </div>;

    const Peak = ({ icon, tone, title, sub, eyebrow, children }) => <Shell eyebrow={eyebrow}>
    <div style={{ textAlign: "center", padding: web ? "14px 0 0" : "6px 0 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>{icon}</div>
      <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: "clamp(1.36rem, 1.205rem + 0.66cqi, 1.7rem)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{title}</h1>
      <p style={{ margin: "0 auto 22px", maxWidth: 380, fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55 }}>{sub}</p>
      {children}
    </div>
  </Shell>;

    /* PREVIEW overlay - the ONE in-drawer preview: a COMPACT read-only summary of the suggested
       event (small thumbnail + facts + tags + short description + what-you-get). The ONLY actions
       are "← Back to suggesting" + a quiet in-place "Save". NEVER a full Event Detail or RSVP here;
       every post-decision card taps through to the REAL Event Detail page via onOpenEvent. */
    /* "Suggest your own" picker - debounced typeahead + curated sections (no full-catalogue load) */
    if (step === "suggest" && picker) {
      const ql = qDeb.trim().toLowerCase();
      const match = (e) => (e.name + " " + (e.suburb || "")).toLowerCase().includes(ql);
      /* curated short sections by default; a debounced typeahead (capped ~20) when searching -
         never render or filter the whole catalogue at once (that was the lag) */
      const curated = [
      ["Events you're going to", (D.BOOKINGS || []).map(byId).filter(Boolean)],
      ["Saved", (D.SAVED || []).map(byId).filter(Boolean)],
      ["You'd both like", (D.SUGGEST_B || []).map(byId).filter(Boolean).slice(0, 4)]];
      const results = ql ? D.EVENTS.filter(match).slice(0, 20) : null;

      const Row = ({ e, going }) => <button onClick={() => {setCustomEv(e);setPicker(false);}} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", cursor: "pointer", background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", padding: 11, marginBottom: 8, boxShadow: "var(--shadow-xs)" }}>
      <div style={{ width: 54, height: 54, borderRadius: 11, overflow: "hidden", flex: "none" }}><Cover category={e.category} h={54} photo={e.photo} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, marginTop: 2 }}>{[e.when, e.suburb, e.price].filter(Boolean).join(" · ")}</div>
        {going && <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 11.5, fontWeight: 600, color: "var(--sage)" }}><Icon name="check" size={12} w={2.6} color="var(--sage)" />You're going to this</div>}
      </div>
      <Icon name="chevR" size={17} w={2.2} color="var(--text-muted)" style={{ flex: "none" }} />
    </button>;
      const seen = new Set();
      return <Shell>
      <button onClick={() => setPicker(false)} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-700)", marginBottom: 12, padding: 0 }}><Icon name="chevL" size={17} w={2.4} color="var(--purple-700)" />Back</button>
      <h1 style={{ margin: "0 0 14px", fontFamily: "var(--font-display)", fontSize: "clamp(1.21625rem, 1.110rem + 0.45cqi, 1.45rem)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>Choose an event for {fn}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--white)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-md)", padding: "10px 13px", marginBottom: 18 }}>
        <Icon name="search" size={16} w={2} color="var(--text-muted)" style={{ flex: "none" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events" style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--text-strong)" }} />
      </div>
      {results ?
        (results.length > 0 ?
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 9 }}>Results</div>
            {results.map((e) => <Row key={e.id} e={e} going={goingTo(e.id)} />)}
          </div> :
          <p style={{ margin: "6px 2px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>No events match "{qDeb.trim()}" - try another search.</p>) :
        curated.map(([label, list]) => {
          const rows = list.filter((e) => {if (seen.has(e.id)) return false;seen.add(e.id);return true;});
          if (rows.length === 0) return null;
          return <div key={label} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 9 }}>{label}</div>
          {rows.map((e) => <Row key={e.id} e={e} going={goingTo(e.id)} />)}
        </div>;
        })}
    </Shell>;
    }

    /* C1 - suggest an event (proposal) */
    if (step === "suggest") return <Shell>
    <h1 style={{ margin: "0 0 7px", fontFamily: "var(--font-display)", fontSize: "clamp(1.251875rem, 1.116rem + 0.58cqi, 1.55rem)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>Suggest something to do with {fn}</h1>
    <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55 }}>Pick something you'd both enjoy - no back-and-forth, just a plan.</p>
    <div style={{ marginBottom: 10 }}><ProposalCard e={ev} /></div>
    {goingTo(ev.id) ?
      <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--sage)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} w={2.6} color="var(--sage)" /> <span>You're going to this - once {fn}'s in, only they need to RSVP.</span></p> :
      <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple-400)", flex: "none" }} /> You're both into this - and it's nearby.</p>}
    {onOpenEvent && <button onClick={() => onOpenEvent(ev)} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "none", cursor: "pointer", padding: 0, margin: "0 0 18px", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)" }}>See full details <Icon name="arrowR" size={15} w={2.2} color="var(--purple-600)" /></button>}
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Btn full onClick={() => setStep("onein")}>{`Suggest this to ${fn}`}</Btn>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="secondary" full onClick={() => {setCustomEv(null);setEvIdx((i) => i + 1);}}>Show another</Btn>
        <Btn variant="ghost" full onClick={() => {setQ("");setPicker(true);}}>Suggest your own →</Btn>
      </div>
    </div>
  </Shell>;

    /* C2 - suggested, waiting for their reply (proposer; NOBODY booked yet - no "save your spot" here) */
    if (step === "onein") return <Peak
      icon={<span style={{ width: 60, height: 60, borderRadius: "50%", background: "color-mix(in srgb,var(--lavender-300) 28%,var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="clock" size={24} w={2} color="var(--purple-600)" /></span>}
      title={`Suggested to ${fn}`}
      sub={`We'll let ${fn} know, and tell you the moment it's confirmed - no rush.`}>
    <div style={{ marginBottom: 18, textAlign: "left" }}><EventMini e={ev} onTap={() => onOpenEvent && onOpenEvent(ev)} /></div>
    <Btn full onClick={onClose}>Back to your clicks</Btn>
  </Peak>;

    /* C2b - they're in, now you both RSVP (this is where the proposer books) */
    if (step === "rsvp") return <Peak
      icon={<span style={{ width: 60, height: 60, borderRadius: "50%", background: "color-mix(in srgb,var(--sage) 14%,var(--white))", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={26} w={2.6} color="var(--sage)" /></span>}
      title={`${fn}'s keen - save your spot`}
      sub={`${fn}'s saved their spot - grab yours and you're both set.`}>
    <div style={{ marginBottom: 18, textAlign: "left" }}><EventMini e={ev} /></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* deep-links to Event Detail carrying the proposal context (coord_group_id) so the page
            shows the plan banner and the booking counts toward confirmed_together */}
      <Btn full onClick={() => onRSVP ? onRSVP(ev, name) : setStep("both")}>Save my spot · RSVP</Btn>
      <Btn variant="ghost" full onClick={onClose}>Back to your clicks</Btn>
    </div>
  </Peak>;

    /* C3 - both going (a peak) */
    if (step === "both") return <Peak
      eyebrow="Plan confirmed"
      icon={<span style={{ width: 64, height: 64, borderRadius: "50%", background: "color-mix(in srgb,var(--purple-600) 9%,var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}><Spark size={38} big="var(--purple-600)" small="var(--purple-600)" /></span>}
      title="You're both going."
      sub={`You and ${fn} are set for ${ev.name}. See you there.`}>
    <div style={{ marginBottom: 18, textAlign: "left" }}><EventMini e={ev} onTap={() => onOpenEvent && onOpenEvent(ev)} /></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Btn full onClick={onClose}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="calendar" size={17} w={2} color="var(--cream)" /> Add to calendar</span></Btn>
      <Btn variant="ghost" full onClick={onClose}>Done</Btn>
    </div>
  </Peak>;

    /* recovery - seat filled first (NOT an error - neutral recovery, never coral/red) */
    if (step === "seatfilled") return <Peak
      icon={<span style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--lavender-100)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="compass" size={26} w={1.9} color="var(--purple-500)" /></span>}
      title="That one just filled up."
      sub={`No drama - there's always another. Find one you'll both like.`}>
    <div style={{ marginBottom: 18, textAlign: "left" }}><EventMini e={ev} dim /></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Btn full onClick={() => setStep("suggest")}>Find another together</Btn>
      <Btn variant="secondary" full onClick={() => setStep("onein")}>Join the waitlist together</Btn>
    </div>
  </Peak>;

    /* terminal - connected / closure (the win, a peak) */
    if (step === "connected") return <Peak
      eyebrow="Past clicks"
      icon={<span style={{ width: 64, height: 64, borderRadius: "50%", background: "color-mix(in srgb,var(--purple-600) 9%,var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}><Spark size={38} big="var(--purple-600)" small="var(--purple-600)" /></span>}
      title="Love that."
      sub="That's what Click's for. This one rests in your past clicks - pick it back up anytime.">
    <Btn full onClick={onClose}>Back to your clicks</Btn>
  </Peak>;

    /* terminal - soft-release (a click goes quiet - NOT a peak, no ✨) */
    if (step === "released") return <Peak
      icon={<span style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--surface-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="clock" size={24} w={1.9} color="var(--text-muted)" /></span>}
      title="Still out there"
      sub="If you cross paths again, you can pick it back up. No rush - these things have their own timing.">
    <Btn full onClick={onClose}>Back to your clicks</Btn>
  </Peak>;

    return null;
  }

  window.ScreensMech = { WhoWasThere, MutualReveal, Coordinate };
})();