(function () {
  /* Click - the mechanic flow. NO chat anywhere; anonymous until mutual; intent-neutral. */
  const { useState: useStateM, useEffect: useEffectM, CAT: CATM, Icon: IconM, Logo: LogoM, Spark: SparkM, Cmark: CmarkM, Btn: BtnM, ClickBtn: ClickBtnM, Toggle: ToggleM, Avatar: AvatarM, Stack: StackM, Tag: TagM, Badge: BadgeM, Status: StatusM, IntentLine: IntentLineM, Cover: CoverM, PeopleCard: PeopleCardM, CommonalityLine: CommonalityLineM } = window.CK;
  const { EVENTS: EVM, byId: byIdM } = window.DATA;

  function Centered({ children, web, max = 560 }) {
    return <div style={{ maxWidth: web ? max : "none", margin: "0 auto", minHeight: "100%" }}>{children}</div>;
  }
  function TopBar({ back, label }) {
    return <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 22px 0" }}>
    {back && <button onClick={back} style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconM name="chevL" size={20} w={2.4} color="var(--purple-700)" /></button>}
    {label && <span style={{ font: "var(--role-overline)", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>}
  </div>;
  }

  /* neutral interest chip - white fill, mist hairline, ink text (never status colour) */
  function Chip({ children }) {
    return <TagM>{children}</TagM>;
  }

  /* PEOPLE CARD - the curated daily pool. Delegates to the ONE canonical CK.PeopleCard so the
     discovery rows read identically to the dashboard / who-was-there / attendee surfaces;
     only the action LAYOUT (wide right-column row vs narrow bottom-row) adapts to width. */
  function PersonClickCard({ p, web, clicked, onClick, onView, row }) {
    return <PeopleCardM p={p} web={web} layout="row" action="click" clicked={clicked} onClick={onClick} onView={onView} />;
  }

  /* PROFILE VIEW - the focused in-flow panel (bio + prompt + full tags live ONLY here).
     Opened via "View profile"; back returns to the list. No page navigation. */
  /* MODE B - VIEWING SOMEONE: a CENTERED MODAL over a dimmed page (was an in-flow panel).
     Public subset only; the ONE place age appears. Esc / scrim / ✕ dismiss - never navigates. */
  function PersonProfileModal({ p, web, clicked, onClick, onClose, hideAction }) {
    const first = p.name.split(" ")[0];
    useEffectM(() => {const k = (e) => {if (e.key === "Escape") onClose();};window.addEventListener("keydown", k);return () => window.removeEventListener("keydown", k);}, [onClose]);
    const intents = (p.intent || "").split("·").join(",").split(",").map((s) => s.trim()).filter(Boolean);
    /* map interest tags → warm-graded Cover scenes so the gallery reads as real lifestyle photos */
    const TAGCAT = { Ceramics: "ceramics", Pottery: "ceramics", Glass: "art", Design: "art", Film: "art", "Natural wine": "wine", Wine: "wine", Cocktails: "wine", Vinyl: "music", "Live music": "music", Cooking: "cooking", Pasta: "cooking", Coffee: "cooking", "Run clubs": "run", Running: "run", Cycling: "run", Hiking: "run", Plants: "wellness", Markets: "wellness", Books: "art" };
    const photoCats = [...new Set((p.tags || []).map((t) => TAGCAT[t]).filter(Boolean))].slice(0, 3);
    while (photoCats.length < 3) photoCats.push(["wine", "ceramics", "cooking"][photoCats.length]);
    const Venn = ({ s = 16 }) => <span style={{ marginTop: 1, flex: "none", display: "inline-flex" }}><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="var(--purple-500)" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></svg></span>;
    return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "color-mix(in srgb,var(--ink) 44%,transparent)", display: "flex", alignItems: web ? "center" : "stretch", justifyContent: "center", padding: web ? 24 : 0 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ position: "relative", width: "100%", maxWidth: web ? 580 : "none", maxHeight: web ? "85vh" : "none", height: web ? "auto" : "100%", display: "flex", flexDirection: "column", background: "var(--white)", borderRadius: web ? "var(--radius-2xl)" : 0, boxShadow: web ? "var(--shadow-xl)" : "none", overflow: "hidden" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 14, right: 16, zIndex: 2, width: 36, height: 36, borderRadius: "50%", background: "var(--white)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconM name="x" size={18} w={2.2} color="var(--text-muted)" /></button>
        <div style={{ flex: 1, overflowY: "auto", padding: web ? "28px 30px 24px" : "22px 22px 24px" }}>
          {/* header - avatar · name · age · suburb */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", flex: "none", boxShadow: "0 0 0 3px var(--white), 0 0 0 4px var(--lavender-300)" }}><CoverM category={photoCats[0]} h={80} photo={`${first} - warm portrait`} tone="warm" /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-h1)", fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--ink)", letterSpacing: "-.02em", lineHeight: 1.2 }}>{first} · {p.age}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginTop: 7 }}><IconM name="pin" size={14} w={1.9} color="var(--text-muted)" />{p.suburb ? p.suburb + " · " : ""}<span style={{ color: "var(--purple-600)", fontWeight: 600 }}>been to {p.been} Click events</span></div>
            </div>
          </div>
          <div style={{ height: 1, background: "#EDE9F2", margin: "0 0 20px" }} />
          {/* why you're seeing - shared framing only (no one-sided loose chips), just under header */}
          <div style={{ background: "var(--lavender-wash)", borderRadius: "var(--radius-lg)", padding: "15px 17px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 9 }}>Why you're seeing {first}</div>
            {(() => {
              const cm = window.CK.commonality(p, false);
              if (cm) { const g = cm.icon === "pin" ? <IconM name="pin" size={15} w={1.9} color="var(--purple-500)" style={{ marginTop: 2, flex: "none" }} /> : cm.icon === "music" ? <IconM name="music" size={15} w={1.9} color="var(--purple-500)" style={{ marginTop: 2, flex: "none" }} /> : <Venn />;
                return <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--text-body)", lineHeight: 1.5 }}>{g}<span>{cm.lead}<b style={{ color: "var(--text-strong)" }}>{cm.term}</b>.</span></div>; }
              return <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--text-body)", lineHeight: 1.5 }}><Venn /><span>You're both here for similar things.</span></div>;
            })()}
          </div>
          {p.bio && <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>{p.bio}</p>}
          {p.prompt && <div style={{ marginBottom: 20, paddingLeft: 14, borderLeft: "2px solid var(--lavender-300)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 3 }}>{p.prompt.q}</div>
            <div style={{ fontSize: 14.5, color: "var(--text-strong)", lineHeight: 1.5 }}>{p.prompt.a}</div>
          </div>}
          {/* here for - Lavender intent display chips (rank above interests) */}
          {intents.length > 0 && <><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-600)", marginBottom: 10 }}>Here for</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>{intents.map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", height: 28, padding: "0 13px", fontSize: 13, fontFamily: "var(--font-sans)", fontWeight: 600, lineHeight: 1, borderRadius: "var(--radius-pill)", background: "var(--lavender-wash)", border: "1px solid var(--lavender-300)", color: "var(--ink)", whiteSpace: "nowrap" }}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>)}</div></>}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-600)", marginBottom: 10 }}>Into</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>{p.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
          {/* photos */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-600)", marginBottom: 10 }}>Photos</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>{photoCats.map((c, i) => <div key={i} style={{ width: 88, height: 88, flex: "none", borderRadius: "var(--radius-md)", overflow: "hidden" }}><CoverM category={c} h={88} photo={`${first} - ${c}`} tone={["bright", "cool", "dusk"][i % 3]} /></div>)}</div>
        </div>
        {/* sticky action - suppressed when opened from an event (read-only context) */}
        {!hideAction && <div style={{ flex: "none", padding: web ? "14px 30px 18px" : "12px 22px 18px", borderTop: "1px solid var(--border-soft)", background: "var(--white)" }}>
          {p.mutual ? <ClickBtnM state="mutual" full size="lg" /> :
          clicked ? <ClickBtnM state="pending" full size="lg" /> :
          <BtnM full size="lg" onClick={onClick}>{`click with ${first}`}</BtnM>}
          {clicked && !p.mutual && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, lineHeight: 1.5 }}><IconM name="lock" size={14} w={1.9} color="var(--text-muted)" />Clicking is anonymous - we'll only show you if it's mutual.</p>}
        </div>}
      </div>
    </div>;
  }

  /* ---------------- E · YOUR CLICKS - the hub, grouped by state (not a queue) ---------------- */
  function ClicksTab({ web, route, onHow, open }) {
    const CL = window.DATA.CLICKS;
    const live = CL.filter((c) => c.state === "mutual");
    const plans = CL.filter((c) => c.state === "plan");
    const past = CL.filter((c) => c.state === "connected" || c.state === "released");
    const connectedPast = past.filter((c) => c.state === "connected");
    const releasedPast = past.filter((c) => c.state === "released");
    const Group = ({ title, hint, sub, children }) => <div style={{ marginBottom: 30 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: sub ? 4 : 12 }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(1.014375rem, 0.953rem + 0.26cqi, 1.15rem)", fontWeight: 600, color: "var(--text-strong)" }}>{title}</h2>
      {hint && <span style={{ fontSize: 12.5, color: "var(--text-faint)", fontWeight: 500 }}>{hint}</span>}
    </div>
    {sub && <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.5 }}>{sub}</p>}
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
  </div>;
    const Row = ({ c }) => {
      const released = c.state === "released";
      const fn = released ? "Someone from " + c.suburb : c.name.split(" ")[0];
      const common = (c.tags || []).slice(0, 2);
      /* ONE card, ONE earned accent: a soft --lavender-wash FILL on YOUR-MOVE cards only (open / their-proposal / save-your-spot) so they read at a glance; waiting, Plans, and past = the clean neutral white card (the section header carries their state). One emphasis mechanism - no left-rule. Low-chroma wash, never a full-strength fill; all card content stays as-is (Slate on wash = 4.74:1, AA). */
      /* coord_state status line is YOUR move (deep-purple) or a calm honest wait (slate) - never a verdict/passive pile.
         OPEN is ALWAYS actionable (no dormant): a system suggestion fills it when available, else a quiet prompt - never empty/hanging. */
      const sug = c.suggestion;
      const CO = {
        open: sug ?
        { a: "Suggest it →", s: `We think you'd both like ${sug.name}`, when: sug.when, suggest: 1 } :
        { a: "Suggest a plan →", s: "Pick something you'd both enjoy", muted: 1 },
        their_turn: { a: "See their plan →", s: `${fn} suggested ${c.event}`, when: c.when, mine: 1 },
        yoursave: { a: "Save your spot →", s: `${fn}'s in - save your spot`, mine: 1 },
        proposed_waiting: { a: `Waiting on ${fn}`, waiting: 1 }
      };
      const co = c.state === "mutual" ? CO[c.coord] || CO.open : null;
      const action = co ? { label: co.a, variant: co.variant || "primary", waiting: co.waiting } :
      c.state === "plan" ? { label: "See the plan →", variant: "secondary" } :
      c.state === "connected" ? { label: "We clicked 👍", variant: "secondary" } : null;
      const yourMove = !!co && !co.waiting;
      const actionEl = action ? (action.waiting ? <button onClick={() => route(c)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: "var(--radius-md)", border: "none", background: "var(--surface-tint)", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)", cursor: "pointer", whiteSpace: "nowrap", width: web ? "auto" : "100%" }}><IconM name="clock" size={14} w={1.9} color="var(--text-muted)" />{action.label}</button> : <BtnM size="sm" variant={action.variant} full={!web} onClick={() => route(c)}>{action.label}</BtnM>) : null;
      return <div style={{ display: "flex", flexDirection: web ? "row" : "column", alignItems: web ? "center" : "stretch", gap: web ? 18 : 12, background: yourMove ? "var(--lavender-wash)" : "var(--white)", border: "1px solid " + (yourMove ? "var(--lavender-300)" : "var(--border-soft)"), borderRadius: "var(--radius-xl)", padding: web ? "16px 20px" : "14px 16px", boxShadow: released ? "none" : "var(--shadow-sm)", opacity: released ? .7 : 1 }}>
      <div style={{ display: "flex", alignItems: web ? "center" : "flex-start", gap: web ? 18 : 13, flex: 1, minWidth: 0 }}>
      <AvatarM name={released ? "·" : c.name} size={52} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: web ? 17.5 : 16, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2 }}>{fn}</span>
          {!released && c.intent && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.3 }}>{`You're both here for ${c.intent}${c.dating ? " · both open to dating" : ""}`}</span>}
        </div>
        {released && <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.45 }}>Still out there - if you cross paths again, you can pick it back up.</div>}
        {co && co.s && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: co.muted ? "var(--text-muted)" : co.mine ? "var(--purple-700)" : "var(--text-strong)" }}>{co.suggest ? <IconM name="calendar" size={13} w={1.9} color="var(--purple-500)" style={{ flex: "none" }} /> : null}{co.s}{co.when ? ` · ${co.when}` : ""}</span>
          {co.sub && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{co.sub}</span>}
        </div>}
        {c.state === "mutual" && <CommonalityLineM p={c} postMutual />}
        {c.state === "mutual" && common.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {common.map((t) => <TagM key={t} dense>{t}</TagM>)}
        </div>}
        {c.state === "plan" && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.4, minWidth: 0 }}><IconM name="calendar" size={14} w={1.9} color="var(--purple-500)" style={{ flex: "none" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>You're both going to {c.event} <span aria-hidden="true">🎉</span></span></div>}
        {c.state === "connected" && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.4, minWidth: 0 }}><IconM name="check" size={14} w={2} color="var(--sage)" style={{ flex: "none" }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.plan ? `You went to ${c.plan} together · ${c.when}` : `You clicked at ${c.event} · ${c.when}`}</span></div>}
      </div>
      </div>
      {actionEl && <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: web ? "flex-end" : "stretch" }}>{actionEl}</div>}
    </div>;
    };
    const empty = live.length + plans.length + past.length === 0;
    const pool = window.DATA.CLICK_SUGGEST;
    const [clicked, setClicked] = useStateM(() => new Set());
    const [viewing, setViewing] = useStateM(null);
    const [showReleased, setShowReleased] = useStateM(false);
    const isClicked = (p) => clicked.has(p.name);
    const doClick = (p) => setClicked((s) => new Set(s).add(p.name));
    return <div style={{ padding: web ? "8px 0 40px" : "0 0 24px" }}>
    <div style={{ maxWidth: web ? 1060 : "none", margin: "0 auto", padding: web ? "0 40px" : "0 22px" }}>
    <div style={{ maxWidth: web ? 720 : "none" }}>
      <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--text-strong)" }}>click with someone</h1>
      <p style={{ margin: "8px 0 30px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55, fontWeight: 500 }}>{onHow && <span onClick={onHow} style={{ color: "var(--purple-600)", fontWeight: 600, cursor: "pointer", borderBottom: "1px solid color-mix(in srgb,var(--purple-600) 30%,transparent)" }}>How clicking works →</span>}</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(1.071875rem, 0.991rem + 0.35cqi, 1.25rem)", fontWeight: 600, lineHeight: 1.4, color: "var(--text-strong)" }}>3 people you might click with today</h2>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-body)", lineHeight: 1.5, fontWeight: 500 }}>Three new people, every day.</p>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 7, lineHeight: 1.5 }}><IconM name="lock" size={14} w={1.9} color="var(--text-muted)" />Clicking is anonymous - we'll only show you if it's mutual.</p>
      <div style={{ marginBottom: 14 }}>
        {web ?
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{pool.map((p, i) => <PersonClickCard key={i} p={p} web row clicked={isClicked(p)} onClick={() => doClick(p)} onView={() => setViewing(p)} />)}</div> :
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>{pool.map((p, i) => <PersonClickCard key={i} p={p} clicked={isClicked(p)} onClick={() => doClick(p)} onView={() => setViewing(p)} />)}</div>}
      </div>
      <div style={{ height: 1, background: "var(--border-soft)", margin: "0 0 26px" }}></div>
      <div id="click-radar" style={{ margin: "0 0 13px", scrollMarginTop: 16 }}>
        <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontSize: "clamp(1.071875rem, 0.991rem + 0.35cqi, 1.25rem)", fontWeight: 600, lineHeight: 1.4, letterSpacing: "-.01em", color: "var(--text-strong)" }}>click radar</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.5 }}>People like you are showing up to these.</p>
      </div>
      <div style={{ marginBottom: 32 }}>{window.ScreensDash.Radar({ web, open: open || (() => {}) })}</div>
      <h2 style={{ margin: "0 0 18px", fontFamily: "var(--font-display)", fontSize: "clamp(1.108125rem, 1.021rem + 0.37cqi, 1.3rem)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>Your clicks</h2>
      {empty ?
        <div style={{ background: "var(--surface-tint)", borderRadius: "var(--radius-xl)", padding: "40px 26px", textAlign: "center" }}><div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><SparkM size={32} /></div><p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.5 }}>No clicks yet - your next event is where it happens.</p></div> :
        <>
          {live.length > 0 && <Group title="Live mutuals" sub="You both clicked. Now plan something you'd both enjoy.">{live.map((c) => <Row key={c.id} c={c} />)}</Group>}
          {plans.length > 0 && <Group title="Plans" hint="you're both going">{plans.map((c) => <Row key={c.id} c={c} />)}</Group>}
          {(connectedPast.length > 0 || releasedPast.length > 0) && <Group title="Past clicks" hint="">
            {connectedPast.map((c) => <Row key={c.id} c={c} />)}
            {releasedPast.length > 0 && (showReleased
              ? releasedPast.map((c) => <Row key={c.id} c={c} />)
              : <button onClick={() => setShowReleased(true)} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", cursor: "pointer", padding: "2px 2px", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)" }}><IconM name="plus" size={15} w={2.2} color="var(--text-muted)" />{releasedPast.length} past click{releasedPast.length > 1 ? "s" : ""}</button>)}
          </Group>}
        </>}
    </div>
    </div>
    {viewing && <PersonProfileModal p={viewing} web={web} clicked={isClicked(viewing)} onClick={() => doClick(viewing)} onClose={() => setViewing(null)} />}
  </div>;
  }



  window.ScreensB = { ClicksTab, PersonProfileModal };

})();