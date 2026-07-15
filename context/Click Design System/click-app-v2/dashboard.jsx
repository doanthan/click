(function () {
  /* Click - signed-in HOME dashboard. A calm, activity-first feed (NOT a data dashboard).
     Mode A = first-time (exactly 4 sections, progressive disclosure).
     Mode B = returning (conditional, ordered by time-sensitivity).
     Whitespace groups sections - never cards-in-boxes. Inline styles; primitives from window.CK. */
  const { useState, CAT, Icon, Spark, Btn, ClickBtn, Avatar, Stack, Status, Cover, Tag, PeopleCard } = window.CK;
  const D = window.DATA;
  const { byId } = D;
  const EventCard = window.ScreensA.EventCard;

  /* ---------------- section scaffold (whitespace-grouped, not boxed) ---------------- */
  function Section({ web, first, title, sub, action, onAction, narrow, children }) {
    return <section style={{ marginTop: first ? web ? 30 : 20 : web ? 56 : 26, maxWidth: narrow && web ? 760 : undefined }}>
      {(title || action) &&
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: web ? 18 : 14 }}>
          <div>
            {title && <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(1.071875rem, 0.968rem + 0.44cqi, 1.3rem)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{title}</h2>}
            {sub && <p style={{ margin: "5px 0 0", fontSize: web ? 14 : 13.5, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.5, maxWidth: 520 }}>{sub}</p>}
          </div>
          {action && <button onClick={onAction} style={{ flex: "none", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", padding: "11px 8px", margin: "-11px -8px" }}>{action}<Icon name="arrowR" size={15} w={2.2} /></button>}
        </div>}
      {children}
    </section>;
  }

  /* ---------------- event row - 3-up grid (web) / horizontal scroll-row (mobile) ---------------- */
  function EventRow({ web, events, open, saved, toggleSave }) {
    if (web) return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 22 }}>
      {events.map((e) => <EventCard key={e.id} e={e} onClick={() => open(e)} saved={saved.has(e.id)} onSave={() => toggleSave(e.id)} />)}
    </div>;
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
      {events.map((e) => <EventCard key={e.id} e={e} mini onClick={() => open(e)} saved={saved.has(e.id)} onSave={() => toggleSave(e.id)} />)}
    </div>;
  }

  /* ---------------- MOMENT BANNER - ONE consistent shell for EVERY time-sensitive top moment
       (post-event prompt + all coordination states). Same lavender wash, radius, padding and
       structure: icon-circle left · eyebrow · title · one subline · ONE action right. The
       finish-setting-up card is deliberately a DIFFERENT, quieter (white) treatment. ---------------- */
  function BannerIcon({ name }) {
    return <span style={{ flex: "none", width: 44, height: 44, borderRadius: "50%", background: "var(--lavender-200)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={name} size={20} w={2} color="var(--purple-700)" /></span>;
  }
  function MomentBanner({ web, lead, eyebrow, title, sub, actions }) {
    return <div style={{ display: "flex", flexDirection: web ? "row" : "column", alignItems: web ? "center" : "stretch", gap: web ? 22 : 16, background: "var(--surface-section)", border: "1px solid var(--lavender-300)", borderRadius: "var(--radius-xl)", padding: web ? "20px 24px" : "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        {lead}
        <div style={{ minWidth: 0 }}>
          {eyebrow && <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--purple-700)", marginBottom: 6 }}>{eyebrow}</div>}
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(1.108125rem, 1.021rem + 0.37cqi, 1.3rem)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--purple-800)", lineHeight: 1.2 }}>{title}</h2>
          {sub && <p style={{ margin: "5px 0 0", fontSize: web ? 14 : 13.5, lineHeight: 1.5, color: "var(--purple-800)", opacity: .8, maxWidth: 460 }}>{sub}</p>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, flex: "none" }}>{actions}</div>
    </div>;
  }

  /* ---------------- 1 · POST-EVENT PROMPT (Mode B, conditional, leads when present) ---------------- */
  function PostEventPrompt({ web, event, onYes, onLater }) {
    return <MomentBanner web={web}
    lead={<BannerIcon name="calendar" />}
    eyebrow={(D.RECENT_REL || "Yesterday") + " · " + event.name}
    title="Did you click with anyone?"
    sub="Click anyone worth a second hang - we'll do the rest."
    actions={<><Btn onClick={onYes}>See who was there</Btn><Btn variant="ghost" onClick={onLater}>Maybe later</Btn></>} />;
  }

  /* ---------------- CLICK WITH SOMEONE - EXACTLY ONE rotated person (the wall lives on the
       Click page). Uses the ONE canonical CK.PeopleCard - the SAME card as discovery /
       who-was-there (avatar 52, inline name+intent, the commonality line, the click+View-profile
       pair); no drift. "View profile" opens the shared profile modal. ---------------- */
  function ClickSuggest({ web, people, onHow }) {
    /* one person, rotated through the day from the curated pool (a drip, not a wall) */
    const person = people[Math.floor(Date.now() / 36e5) % people.length];
    const [clicked, setClicked] = useState(false);
    const [viewing, setViewing] = useState(false);
    const PM = window.ScreensB && window.ScreensB.PersonProfileModal;
    return <div>
      <PeopleCard p={person} web={web} layout="row" action="click" clicked={clicked} onClick={() => setClicked(true)} onView={() => setViewing(true)} />
      <p style={{ margin: "13px 2px 0", fontSize: 13, color: "var(--text-muted)", display: "inline-flex", alignItems: "flex-start", gap: 7, lineHeight: 1.5 }}>
        <Icon name="lock" size={14} w={1.9} color="var(--text-muted)" style={{ marginTop: 1, flex: "none" }} /><span>Clicking is anonymous - we'll only show you if it's mutual. {onHow && <span onClick={onHow} style={{ color: "var(--purple-600)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>How clicking works →</span>}</span>
      </p>
      {viewing && PM && <PM p={person} web={web} clicked={clicked} onClick={() => {setClicked(true);setViewing(false);}} onClose={() => setViewing(false)} />}
    </div>;
  }

  /* ---------------- CLICK RADAR - a compact social-proof BAR (locked 27 Jun; NOT event cards).
       1–3 light one-line rows, each an anonymous AGGREGATE social-proof line tied to an event,
       that taps through to that event. Counts only, never names/photos (≥3 floor). Light on
       cream, hairline-separated rows - never a card grid, never a dark block. Cold-start →
       a single honest "trending" / "your radar sharpens" bar. Same bar on the Click page. ---- */
  function Radar({ web, cold, open }) {
    const rows = cold ?
    D.RADAR_COLD.slice(0, 1).map((id) => ({ e: byId(id), icon: "trend", line: "As you go to events, your radar sharpens" })) :
    D.RADAR_EVENTS.map((r) => ({ e: byId(r.id), icon: r.icon, line: r.line }));
    const bars = rows.filter((x) => x.e).slice(0, 1);
    return <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", background: "var(--cream)", overflow: "hidden" }}>
      {bars.map(({ e, icon, line }, i) => <RadarBar key={e.id} e={e} icon={icon} line={line} first={i === 0} web={web} cold={cold} onClick={() => open(e)} />)}
    </div>;
  }
  function RadarBar({ e, icon, line, first, web, cold, onClick }) {
    const [hov, setHov] = useState(false);
    return <div
      onClick={cold ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      role={cold ? undefined : "button"} tabIndex={cold ? undefined : 0}
      style={{ display: "flex", alignItems: "center", gap: web ? 14 : 12, padding: web ? "15px 18px" : "14px 15px", cursor: cold ? "default" : "pointer", borderTop: first ? "none" : "1px solid var(--border-soft)", background: hov && !cold ? "var(--surface-tint)" : "transparent", transition: "background .15s" }}>
      <span style={{ flex: "none", width: 32, height: 32, borderRadius: "50%", background: "var(--lavender-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon && icon !== "spark" ? icon : "trend"} size={16} w={1.9} color="var(--purple-600)" />
      </span>
      <div style={{ flex: 1, minWidth: 0, fontSize: web ? 14.5 : 13.5, lineHeight: 1.4, color: "var(--text-body)" }}>
        <span>{line}</span>
        {!cold && <span> </span>}
        {!cold && <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{e.name}</span>}
      </div>
      {!cold && <Icon name="chevR" size={16} w={2} color="var(--text-muted)" />}
    </div>;
  }

  /* ---------------- COORDINATION MOMENT BANNER - the SAME MomentBanner shell, content per state.
     Surfaces only YOUR-move states (fresh mutual · they proposed · agreed-your-RSVP), or ONE
     consolidated banner when 2+ are waiting on you. ✨ (Deep-Purple glyph) on the peak titles only. */
  function CoordBanner({ web, variant, onAction }) {
    const name = "Mia R.",name2 = "Jules M.";
    const fn = name.split(" ")[0],fn2 = name2.split(" ")[0];
    const ev = byId("ev2");
    const evLine = ev.name + " · " + ev.when;
    const SPARK = <span style={{ display: "inline-flex", verticalAlign: "-2px" }}><Spark size={web ? 20 : 18} big="var(--purple-600)" small="var(--purple-400)" /></span>;
    const cfg = {
      mutual: { icon: "users", eyebrow: "it's mutual", title: <>You clicked with {fn}. {SPARK}</>, sub: "Find something you'd both enjoy and meet there.", cta: "Suggest a plan →" },
      proposed: { icon: "calendar", eyebrow: "from " + fn, title: <>{fn} suggested a plan</>, sub: evLine, cta: "See their plan →" },
      agreed: { icon: "check", eyebrow: "your plan with " + fn, title: <>{fn}'s in - RSVP to lock it in</>, sub: evLine, cta: "RSVP →" },
      consolidated: { icon: "users", eyebrow: "your clicks", title: <>{fn} and {fn2} are waiting on you {SPARK}</>, sub: "Pick up where you left off.", cta: "See your clicks →" }
    }[variant];
    if (!cfg) return null;
    return <MomentBanner web={web}
    lead={<BannerIcon name={cfg.icon} />}
    eyebrow={cfg.eyebrow}
    title={cfg.title}
    sub={cfg.sub}
    actions={<Btn size="sm" onClick={() => onAction && onAction(variant)}>{cfg.cta}</Btn>} />;
  }

  /* ---------------- SAVED & WAITLIST - SAME Event Card + 3-up grid as the other strips (capped at 3; rest via "See all") ---------------- */
  function SavedWaitlist({ web, saved, open, toggleSave }) {
    const savedEvents = [...saved].map(byId).filter(Boolean);
    const wl = D.WAITLIST.map((id) => ({ ...byId(id), status: "waitlist" }));
    const list = [...savedEvents, ...wl];
    if (list.length === 0) return <div style={{ background: "var(--surface-tint)", borderRadius: "var(--radius-xl)", padding: web ? "30px 26px" : "24px 18px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Spark size={28} /></div>
      <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.5 }}>Nothing saved yet - your next event is where it happens.</p>
    </div>;
    return <EventRow web={web} events={list.slice(0, 3)} open={open} saved={saved} toggleSave={toggleSave} />;
  }

  /* ---------------- ACTIVITY - quiet timeline (no boxes) ---------------- */
  function Activity({ items }) {
    return <div>{items.map((it, i) => {
        const last = i === items.length - 1;
        return <div key={i} style={{ display: "flex", gap: 14, paddingBottom: last ? 0 : 18, position: "relative" }}>
        <div style={{ flex: "none", width: 34, display: "flex", justifyContent: "center", position: "relative" }}>
          {!last && <span style={{ position: "absolute", top: 32, bottom: -18, width: 2, background: "var(--border-soft)" }} />}
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface-tint)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}><Icon name={it.ic} size={16} w={2} color="var(--purple-500)" /></span>
        </div>
        <div style={{ paddingTop: 6 }}>
          <div style={{ fontSize: 14.5, color: "var(--text-body)", fontWeight: 500, lineHeight: 1.35 }}>{it.text}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>{it.when}</div>
        </div>
      </div>;
      })}</div>;
  }

  /* ---------------- CATEGORIES - icon + label browse tiles → Discover (one icon treatment, shared with Discovery) ---------------- */
  function Categories({ web, openDiscover }) {
    const DS = window.ScreensDisc;
    const CatChip = DS && DS.CatChip;
    if (!CatChip) return null;
    const CURATED = ["social", "food", "arts", "music", "fitness", "outdoors", "wellness", "learning"];
    const cats = DS.CATS.filter((c) => CURATED.includes(c.key));
    return <div className="ckRail" style={{ display: "flex", flexWrap: web ? "wrap" : "nowrap", overflowX: web ? "visible" : "auto", gap: web ? 6 : 4, margin: web ? 0 : "0 -22px", padding: web ? 0 : "2px 22px 4px", scrollbarWidth: "none" }}>
      {cats.map((c) => <CatChip key={c.key} c={c} web={web} active={false} onClick={() => openDiscover(c.key)} />)}
    </div>;
  }

  /* ---------------- greeting ---------------- */
  function Greeting({ web, compact, line }) {
    return <div>
      <p style={{ margin: "0 0 7px", fontSize: web ? 13.5 : 13, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-display)" }}>Good evening, Ava</p>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: compact ? "clamp(1.5rem, 1.273rem + 0.97cqi, 2rem)" : "clamp(1.219rem, 1.091rem + 0.55cqi, 1.5rem)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: compact ? 1.25 : 1.32, color: "var(--text-strong)", maxWidth: 620, textWrap: "balance" }}>{line}</h1>
    </div>;
  }

  /* ---------------- FINISH SETTING UP - the one restrained activation block ---------------- */
  function TaskRow({ t, i, isDone, featured, onDo }) {
    const hi = featured && !isDone;
    return <div style={{ display: "flex", alignItems: "center", gap: 13, padding: hi ? "11px 12px" : "12px 2px", borderTop: i && !hi ? "1px solid var(--border-soft)" : "none", background: hi ? "color-mix(in srgb,var(--lavender-300) 15%,var(--white))" : "transparent", borderRadius: hi ? "var(--radius-md)" : 0, margin: hi ? "6px 0" : 0 }}>
      <span aria-hidden="true" style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isDone ? "var(--purple-600)" : "transparent", border: isDone ? "none" : "2px solid var(--border-mid)" }}>{isDone && <Icon name="check" size={14} w={3} color="var(--cream)" />}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: isDone ? "var(--text-muted)" : "var(--text-strong)" }}>{t.label}</span>
          {hi && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--purple-700)", background: "var(--lavender-200)", borderRadius: "var(--radius-pill)", padding: "2px 9px" }}>most useful</span>}
        </span>
        {t.sub && <span style={{ display: "block", fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>{t.sub}</span>}
      </span>
      {isDone ?
      <span style={{ flex: "none", fontSize: 12.5, fontWeight: 600, color: "var(--text-faint)" }}>Done</span> :
      <button onClick={onDo} style={{ flex: "none", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--purple-600)", background: "none", border: "none", cursor: "pointer", padding: "4px 2px" }}>{t.cta}</button>}
    </div>;
  }
  function SetupChecklist({ web, openQuiz, quizDone }) {
    const TASKS = [
    { k: "quiz", label: "Take the Click quiz", sub: "2 min · it's what sharpens who you meet", cta: "Start →" },
    { k: "photo", label: "Add a photo", sub: "so people recognise you on the night", cta: "Add" },
    { k: "bio", label: "Write a one-line bio", sub: "a line gives people a reason to say hi", cta: "Write" },
    { k: "interests", label: "Pick 3 or more interests", sub: "so we suggest the right events", cta: "Pick" },
    { k: "suburb", label: "Set your suburb", sub: "Surry Hills", cta: "Edit" }];

    const [done, setDone] = useState(() => new Set(["interests", "suburb"]));
    const allDone = quizDone && !done.has("quiz") ? new Set(done).add("quiz") : done;
    const [expanded, setExpanded] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const total = TASKS.length,n = allDone.size,pct = Math.round(n / total * 100),complete = n === total;
    const markDone = (k) => setDone((s) => {const x = new Set(s);x.add(k);return x;});
    if (collapsed) return null;
    const next = TASKS.find((t) => !allDone.has(t.k));
    /* compact by default: show only the next incomplete step; expand reveals the rest */
    const rows = expanded ? TASKS.filter((t) => !allDone.has(t.k)) : next ? [next] : [];
    return <div style={{ background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-xs)", padding: web ? "20px 24px" : "16px 18px" }}>
      {complete ?
      <div style={{ textAlign: "center", padding: "10px 8px 6px" }}>
          <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--text-strong)" }}>You're all set</h3>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>Your suggestions just got sharper - for events and people.</p>
          <Btn size="sm" onClick={() => setCollapsed(true)}>Great</Btn>
        </div> :
      <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(1.03625rem, 0.985rem + 0.22cqi, 1.15rem)", fontWeight: 600, color: "var(--text-strong)" }}>Finish setting up</h3>
            <span style={{ flex: "none", fontSize: 13.5, fontWeight: 600, color: "var(--purple-700)" }}>{n} of {total}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "var(--surface-tint)", overflow: "hidden", margin: "12px 0 4px" }}><div style={{ height: "100%", width: pct + "%", background: "var(--purple-600)", borderRadius: 999, transition: "width .3s ease" }} /></div>
          <div style={{ marginTop: 4 }}>{rows.map((t, i) => <TaskRow key={t.k} t={t} i={i} isDone={false} featured={t.k === "quiz"} onDo={() => {if (t.k === "quiz" && openQuiz) {openQuiz();} else markDone(t.k);}} />)}</div>
          {TASKS.filter((t) => !allDone.has(t.k)).length > 1 &&
        <button onClick={() => setExpanded((v) => !v)} style={{ marginTop: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--purple-600)", display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 0" }}>
              {expanded ? "Show less" : "See all · " + (total - n) + " left"}<Icon name={expanded ? "chevD" : "arrowR"} size={14} w={2.2} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>}
        </>}
    </div>;
  }

  /* ====================== DASHBOARD ====================== */
  function Dashboard({ web, mode, showPrompt, open, saved, toggleSave, openWin, openDiscover, openPeople, openEvents, openRadar, openQuiz, quizDone, coordBanner, onCoordAction, onHow }) {
    const firstrun = mode === "firstrun";
    const recent = byId(D.RECENT);
    const booked = D.BOOKINGS.map(byId).filter(Boolean);
    const inner = { maxWidth: web ? 1060 : "none", margin: "0 auto", padding: web ? "12px 40px 56px" : "8px 22px 40px" };

    /* ---- Mode A: first-time - exactly 4 sections ---- */
    if (firstrun) return <div><div style={inner}>
      <Greeting web={web} line="Here's what's good near you this week, Ava." />
      <Section web first narrow><SetupChecklist web={web} openQuiz={openQuiz} quizDone={quizDone} /></Section>
      <Section web title="Suggested for you" sub="This week, near you - matched to what you're into.">
        <EventRow web={web} events={D.SUGGEST_A.map(byId)} open={open} saved={saved} toggleSave={toggleSave} />
      </Section>
      <Section web title="click radar" sub="People like you are showing up to these." action="See all on your radar" onAction={openRadar} narrow>
        <Radar web={web} cold open={open} />
      </Section>
      <Section web title="Or find your own thing" sub="Browse by what you feel like doing." action="See all" onAction={() => openDiscover()}>
        <Categories web={web} openDiscover={openDiscover} />
      </Section>
    </div></div>;

    /* ---- Mode B: returning - conditional, time-sensitivity order ---- */
    /* empty (no your-move moment) - lead with a calm discovery nudge, never "nothing needs you" */
    const hasMoment = (showPrompt && recent) || coordBanner;
    return <div><div style={inner}>
      <Greeting web={web} compact line={hasMoment ? "Here's what's next." : "Here's what's good near you this week, Ava."} />

      {showPrompt && recent &&
        <Section web first>
          <div style={{ maxWidth: web ? 760 : "none" }}><PostEventPrompt web={web} event={recent} onYes={() => openWin(recent, "default")} onLater={() => {}} /></div>
        </Section>}

      {coordBanner &&
        <div style={{ maxWidth: web ? 760 : "none", marginTop: showPrompt && recent ? web ? 22 : 16 : web ? 24 : 18 }}>
          <CoordBanner web={web} variant={coordBanner} onAction={onCoordAction} />
        </div>}

      <div style={{ maxWidth: web ? 760 : "none", marginTop: showPrompt && recent ? web ? 26 : 18 : web ? 30 : 22 }}><SetupChecklist web={web} openQuiz={openQuiz} quizDone={quizDone} /></div>

      {booked.length > 0 &&
        <Section web title="You're going" action="All bookings" onAction={openEvents}>
          <EventRow web={web} events={booked} open={open} saved={saved} toggleSave={toggleSave} />
        </Section>}

      <Section web title="click with someone" sub="Someone you might just click with - quietly picked, no pressure." action="See everyone" onAction={openPeople} narrow>
        <ClickSuggest web={web} people={D.CLICK_SUGGEST} onHow={onHow} />
      </Section>

      <Section web title="click radar" sub="People like you are showing up to these." action="See all on your radar" onAction={openRadar} narrow>
        <Radar web={web} open={open} />
      </Section>

      <Section web title="Suggested for you" sub="Fresh this week, matched to what you like." action="See all" onAction={openDiscover}>
        <EventRow web={web} events={D.SUGGEST_B.map(byId)} open={open} saved={saved} toggleSave={toggleSave} />
      </Section>

      <Section web title="Saved & waitlist" action="See all" onAction={openEvents}>
        <SavedWaitlist web={web} saved={saved} open={open} toggleSave={toggleSave} />
      </Section>

      <Section web title="Browse by category" action="See all" onAction={() => openDiscover()}>
        <Categories web={web} openDiscover={openDiscover} />
      </Section>
    </div></div>;
  }

  window.ScreensDash = { Dashboard, Radar };
})();