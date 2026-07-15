(function () {
  /* Click - Onboarding. Progressive profiling: 4 steps + done. Collect only the minimum
     to make the first feed good; everything else defers to the dashboard checklist.
     One decision per screen, endowed progress, per-step completion tick. Inline styles. */
  const { useState, Icon, Logo, Spark, Btn, Field, Avatar, Tag } = window.CK;
  const CG = window.ScreensDisc.CatGlyph;

  const GENDERS = ["Woman", "Man", "Non-binary", "Prefer not to say"];
  const INTENTS = [
    ["dating", "Open to dating", "If you click with someone, see where it goes."],
    ["friends", "Friends", "Good people, low stakes, no agenda."],
    ["locals", "Locals", "Find your feet, and your people nearby."],
    ["activities", "Activities", "The plan is the point - who you meet is a bonus."],
    ["networking", "Networking", "A few more good faces in your week."],
    ["platonic", "Here to meet people, not to date", "Here for friends and good company."]
  ];
  function Chip({ active, onClick, children }) {
    return <button onClick={onClick} style={{ padding: "10px 16px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: active ? 600 : 500, backgroundColor: active ? "var(--purple-600)" : "var(--white)", color: active ? "var(--cream)" : "var(--text-body)", border: `1.5px solid ${active ? "var(--purple-600)" : "var(--border-mid)"}`, transition: "background-color .15s" }}>{children}</button>;
  }
  function Tick() {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--success)" }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={11} w={3} color="#fff" /></span>Looks good</span>;
  }
  function StepHead({ eyebrow, title, sub }) {
    return <div style={{ marginBottom: 22 }}>
      <p style={{ margin: "0 0 8px", font: "var(--role-overline)", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-500)" }}>{eyebrow}</p>
      <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.12, color: "var(--text-strong)" }}>{title}</h1>
      {sub && <p style={{ margin: 0, fontSize: 15, color: "var(--text-muted)", lineHeight: 1.55 }}>{sub}</p>}
    </div>;
  }

  function Spot({ web, icon, glyph }) {
    const d = web ? 80 : 66;
    return <div className="ckSpot" style={{ position: "relative", width: d, height: d, margin: "0 auto 22px" }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "color-mix(in srgb,var(--lavender-300) 22%,var(--cream))" }} />
      <span style={{ position: "absolute", width: Math.round(d * 0.4), height: Math.round(d * 0.4), borderRadius: "50%", background: "color-mix(in srgb,var(--purple-400) 18%,var(--cream))", top: -3, right: -1 }} />
      <span className="ckSpotInner" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {glyph ? <CG name={glyph} size={Math.round(d * 0.4)} color="var(--purple-600)" /> : <Icon name={icon} size={Math.round(d * 0.4)} w={1.7} color="var(--purple-600)" />}
      </span>
    </div>;
  }

  function Onboarding({ web, done }) {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [postcode, setPostcode] = useState("");
    const [picks, setPicks] = useState(new Set());
    const [datingVisible, setDatingVisible] = useState(true);
    const [openTo, setOpenTo] = useState("");
    const [interests, setInterests] = useState(new Set());
    const [moreOpen, setMoreOpen] = useState(false);
    const total = 4;

    const pcOk = /^\d{4}$/.test(postcode);
    const PILOT_PC = ["2042", "2010", "2016", "2204", "2008", "2017", "2021", "2037", "2015"];
    const pcInCluster = PILOT_PC.includes(postcode);
    const valid1 = name.trim().length > 1 && dob && gender && pcOk;
    const valid2 = picks.size > 0 && (!picks.has("dating") || openTo);
    const togglePick = (k) => setPicks((s) => { const x = new Set(s); if (x.has(k)) { x.delete(k); if (k === "dating") setOpenTo(""); } else { x.add(k); if (k === "dating") x.delete("platonic"); if (k === "platonic") { x.delete("dating"); setOpenTo(""); } } return x; });
    const toggleInt = (k) => setInterests((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });
    const next = () => setStep((s) => s + 1);
    const back = () => setStep((s) => Math.max(1, s - 1));

    /* ---- DONE ---- */
    if (step > total) return <div style={{ minHeight: "100%", background: "var(--cream)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: web ? "60px 40px" : "40px 26px", textAlign: "center" }}>
      <div style={{ maxWidth: 440 }}>
        <h1 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text-strong)" }}>You're all set <span style={{ display: "inline-flex", verticalAlign: "-4px", marginLeft: 3 }}><Spark size={web ? 34 : 28} big="var(--purple-600)" small="var(--purple-600)" /></span></h1>
        <p style={{ margin: "0 0 26px", fontSize: 16, lineHeight: 1.6, color: "var(--text-body)" }}>No swiping, no endless chat - you meet people by doing things you like. Here's what's good near you this week.</p>
        <Btn size="lg" onClick={done} icon="arrowR">See what's on near you</Btn>
        <p style={{ margin: "20px 0 0", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>Finish your profile anytime from your dashboard - a photo, a line about you, the Click quiz.</p>
      </div>
    </div>;

    let content, canNext = true, onNext = next, skip = null;
    if (step === 1) {
      content = <div>
        <Spot web={web} icon="pin" />
        <StepHead eyebrow="About you" title="The basics" sub="Just enough to find you good things nearby." />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="First name" placeholder="Ava" value={name} onChange={setName} icon="user" />
          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Date of birth</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 50, background: "var(--white)", border: "1.5px solid var(--border-mid)", borderRadius: "var(--radius-md)" }}>
              <Icon name="calendar" size={18} w={1.9} color="var(--text-muted)" />
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 15.5, color: "var(--text-strong)" }} />
            </span>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Click is 18+. We use this for eligibility only.</span>
          </label>
          <div>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 9 }}>Gender</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{GENDERS.map((g) => <Chip key={g} active={gender === g} onClick={() => setGender(g)}>{g}</Chip>)}</div>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Postcode</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 50, background: "var(--white)", border: `1.5px solid ${pcOk ? "var(--border-mid)" : "var(--border-mid)"}`, borderRadius: "var(--radius-md)" }}>
              <Icon name="pin" size={18} w={1.9} color="var(--text-muted)" />
              <input type="text" inputMode="numeric" maxLength={4} placeholder="2042" value={postcode} onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 15.5, letterSpacing: ".04em", color: "var(--text-strong)" }} />
              {pcOk && <Icon name="check" size={17} w={2.4} color="var(--success)" />}
            </span>
            {!pcOk && <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>Click is piloting in inner Sydney first. Pop in your postcode - we'll show you what's near, and email you the moment we reach your area.</span>}
            {pcOk && pcInCluster && <span style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 500, lineHeight: 1.5 }}>You're right in our first suburbs - plenty on near you.</span>}
            {pcOk && !pcInCluster && <span style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.5 }}>You're a little outside our first suburbs - you're in, and we'll let you know the moment Click reaches you.</span>}
          </label>
        </div>
        {valid1 && <div style={{ marginTop: 18 }}><Tick /></div>}
      </div>;
      canNext = valid1;
    } else if (step === 2) {
      content = <div>
        <Spot web={web} icon="users" />
        <StepHead eyebrow="What you're after" title="What brings you to Click?" sub="Pick any that fit - it just tunes what we show you. You can change it later." />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {INTENTS.map(([k, label, desc]) => {
            const on = picks.has(k);
            return <div key={k}>
              <button onClick={() => togglePick(k)} aria-pressed={on} style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", padding: "15px 16px", borderRadius: "var(--radius-lg)", cursor: "pointer", background: on ? "var(--lavender-100)" : "var(--white)", border: `1.5px solid ${on ? "var(--purple-500)" : "var(--border-soft)"}`, transition: "background .15s,border-color .15s" }}>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 15.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span><span style={{ display: "block", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{desc}</span></span>
                <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: "var(--purple-600)", display: "flex", alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(.7)", transition: "opacity .15s,transform .15s" }}><Icon name="check" size={13} w={3} color="var(--cream)" /></span>
              </button>
              {on && k === "dating" && <div style={{ margin: "10px 0 2px", padding: "14px 16px", background: "var(--surface-tint)", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
                  <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Show I'm open to dating</span><span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>Only shown to others also open to dating.</span></span>
                  <button role="switch" aria-checked={datingVisible} aria-label="Show I'm open to dating" onClick={() => setDatingVisible((v) => !v)} style={{ flex: "none", width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: datingVisible ? "var(--purple-600)" : "var(--border-mid)", position: "relative", transition: "background .2s" }}><span style={{ position: "absolute", top: 3, left: datingVisible ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "var(--white)", boxShadow: "var(--shadow-sm)", transition: "left .2s" }} /></button>
                </div>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginBottom: 9 }}>Open to meeting</span>
                <div style={{ display: "flex", gap: 8 }}>{["Women", "Men", "Everyone"].map((o) => <Chip key={o} active={openTo === o} onClick={() => setOpenTo(o)}>{o}</Chip>)}</div>
              </div>}
            </div>;
          })}
        </div>
      </div>;
      canNext = valid2;
    } else if (step === 3) {
      const IT = (window.DATA.INTEREST_TAGS || []).filter((c) => !c.gated || picks.has("dating"));
      const groups = moreOpen ? IT : IT.slice(0, 8);
      content = <div>
        <Spot web={web} glyph="arts" />
        <StepHead eyebrow="Interests" title="What do you like doing?" sub="Pick a few - three or more is the sweet spot." />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((cat, ci) => <div key={cat.key}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>{cat.label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cat.tags.map((t, ti) => <span key={t} style={{ display: "inline-flex" }}><Tag selected={interests.has(t)} onClick={() => toggleInt(t)} style={{ height: 32, padding: "0 14px", fontSize: 13.5, cursor: "pointer" }}>{t}</Tag></span>)}
            </div>
          </div>)}
          {!moreOpen && IT.length > 8 && <button onClick={() => setMoreOpen(true)} style={{ alignSelf: "flex-start", border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--purple-600)", padding: "2px 0", display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="plus" size={15} w={2.4} color="var(--purple-600)" />Show more</button>}
        </div>
        <p style={{ margin: "22px 2px 0", fontSize: 13.5, fontWeight: 600, color: interests.size >= 3 ? "var(--sage)" : "var(--text-muted)" }}>{interests.size === 0 ? "Pick a few to get started" : interests.size >= 3 ? `Nice - ${interests.size} picked` : `${interests.size} picked · pick ${3 - interests.size} more for better suggestions`}</p>
      </div>;
      skip = () => next();
    } else if (step === 4) {
      content = <div>
        <Spot web={web} icon="user" />
        <StepHead eyebrow="One last thing" title="Add a photo?" sub="Optional - people show up more for a face. You can always add one later." />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "10px 0" }}>
          <div style={{ position: "relative" }}>
            <Avatar name={name || "Ava"} size={112} />
            <span style={{ position: "absolute", bottom: 2, right: 2, width: 36, height: 36, borderRadius: "50%", background: "var(--purple-600)", border: "3px solid var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={18} w={2.4} color="var(--cream)" /></span>
          </div>
          <Btn variant="secondary" icon="share">Upload a photo</Btn>
        </div>
      </div>;
      onNext = next; skip = next;
    }

    const pct = Math.round(((step - 0.5) / total) * 100);   /* endowed: ahead of bare step/total */
    return <div style={{ minHeight: "100%", background: "var(--cream)", display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ckSpotFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}.ckSpotInner{animation:ckSpotFloat 4.5s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.ckSpotInner{animation:none!important}}" }} />
      <div style={{ flex: "none", padding: web ? "20px 40px 0" : "16px 22px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Logo size={web ? 26 : 23} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Step {step} of {total}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--surface-tint)", overflow: "hidden", maxWidth: web ? 460 : "none", margin: "0 auto" }}><div style={{ height: "100%", width: pct + "%", background: "var(--purple-600)", borderRadius: 999, transition: "width .35s cubic-bezier(.3,.7,.4,1)" }} /></div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: web ? "32px 40px" : "24px 22px 16px" }}>
        <div key={step} style={{ maxWidth: 460, margin: "0 auto" }}>{content}</div>
      </div>
      <div style={{ flex: "none", position: "sticky", bottom: 0, zIndex: 5, padding: web ? "14px 40px 26px" : "12px 22px 22px", borderTop: "1px solid var(--border-soft)", background: "var(--cream)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          {step > 1 && <Btn variant="secondary" onClick={back}>Back</Btn>}
          {web && <div style={{ flex: 1 }} />}
          {skip && <button onClick={skip} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", padding: "10px 4px", margin: "-10px -4px" }}>Skip for now</button>}
          <Btn onClick={onNext} disabled={!canNext} icon="arrowR" style={web ? undefined : { flex: 1 }}>Continue</Btn>
        </div>
      </div>
    </div>;
  }

  window.ScreensOnb = { Onboarding };
})();
