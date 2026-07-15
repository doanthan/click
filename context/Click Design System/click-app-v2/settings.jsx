(function () {
  /* Click - SETTINGS (its own PAGE, reached from the profile's "Edit profile" deep-link).
     ONE page, four sections: Edit profile · Privacy & visibility · Account · Notifications.
     - Edit profile  = profile CONTENT only (photos, about, bio, intent, interests).
     - Privacy & visibility = "Show me in attendee lists" + Open-to-dating toggle + dating prefs (gated).
     - Account = name / email / password / sign-out.
     - Notifications = notification preferences (distinct from the bell panel).
     Desktop: sticky left sub-nav + content. Mobile: a sectioned list that drills into a section.
     NOT an overlay. Hyphens, not em-dashes. window.ScreensSet. */
  const { useState, useEffect, Icon, Btn, Toggle, Avatar, Tag } = window.CK;

  const SECTIONS = [["edit", "Edit profile", "user"], ["privacy", "Privacy & visibility", "lock"], ["account", "Account", "settings"], ["notifications", "Notifications", "bell"]];
  /* the six canonical intents - single source, same labels/order as onboarding (do not reword) */
  const INTENTS = ["Open to dating", "Friends", "Locals", "Activities", "Networking", "Here to meet people, not to date"];

  function SectionHead({ children, sub }) {
    return <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{children}</h2>
      {sub && <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{sub}</p>}
    </div>;
  }
  function Group({ children, last }) {
    return <div style={{ padding: "24px 0", borderBottom: last ? "none" : "1px solid var(--border-soft)" }}>{children}</div>;
  }
  function FieldRow({ label, children, note }) {
    return <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 7 }}>{label}</span>
      {children}
      {note && <span style={{ display: "block", fontSize: 12, color: "var(--text-faint)", marginTop: 5 }}>{note}</span>}
    </label>;
  }
  const inputStyle = { width: "100%", boxSizing: "border-box", height: 48, padding: "0 14px", background: "var(--white)", border: "1.5px solid var(--border-mid)", borderRadius: "var(--radius-md)", fontFamily: "var(--font-sans)", fontSize: 15.5, color: "var(--text-strong)", outline: "none" };

  function IntentCard({ label, on, onClick }) {
    return <button onClick={onClick} aria-pressed={on} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left", padding: "13px 15px", borderRadius: "var(--radius-md)", cursor: "pointer", background: on ? "var(--lavender-100)" : "var(--white)", border: "1.5px solid " + (on ? "var(--purple-500)" : "var(--border-soft)"), transition: "background-color .15s,border-color .15s" }}>
      <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span>
      <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: "var(--purple-600)", display: "flex", alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(.7)", transition: "opacity .15s,transform .15s" }}><Icon name="check" size={13} w={3} color="var(--cream)" /></span>
    </button>;
  }

  function AgeRange({ min, max, setRange }) {
    const lo = 18, hi = 65, span = hi - lo;
    return <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Age range I'm open to</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--purple-700)" }}>{min} - {max}</span>
      </div>
      <div style={{ position: "relative", height: 28 }}>
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 5, borderRadius: 99, background: "var(--mist)" }} />
        <div style={{ position: "absolute", top: 12, height: 5, borderRadius: 99, background: "var(--purple-500)", left: ((min - lo) / span) * 100 + "%", right: (100 - ((max - lo) / span) * 100) + "%" }} />
        <input className="ckPERange" type="range" min={lo} max={hi} value={min} onChange={(e) => setRange(Math.min(Number(e.target.value), max - 1), max)} aria-label="Minimum age" />
        <input className="ckPERange" type="range" min={lo} max={hi} value={max} onChange={(e) => setRange(min, Math.max(Number(e.target.value), min + 1))} aria-label="Maximum age" />
      </div>
    </div>;
  }

  /* primary save with a Sage saved-tick (no navigation - Settings is a page) */
  function SaveBar({ web, saved, onSave }) {
    return <div style={{ position: web ? "static" : "sticky", bottom: 0, marginTop: 8, paddingTop: 18, display: "flex", justifyContent: "flex-end", gap: 12, background: web ? "transparent" : "linear-gradient(to top,var(--cream) 70%,transparent)" }}>
      <Btn onClick={onSave}>{saved ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={15} w={2.6} color="var(--cream)" />Saved</span> : "Save changes"}</Btn>
    </div>;
  }
  function RowToggle({ title, desc, checked, onChange }) {
    return <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 3, maxWidth: 460 }}>{desc}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>;
  }

  function Settings({ web, initialSection, back, quizDone, openQuiz }) {
    /* desktop: nav always visible, default to deep-linked section. mobile: list root unless deep-linked. */
    const [active, setActive] = useState(() => initialSection || (web ? "edit" : null));
    useEffect(() => { setActive(initialSection || (web ? "edit" : null)); }, [initialSection, web]);

    /* lifted form state (sections share it) */
    const [intents, setIntents] = useState(() => new Set(["Friends", "Activities"]));
    const [datingMode, setDatingMode] = useState(true);  // On/Paused (romantic_visible) - inline with the Open-to-dating intent
    const [bio, setBio] = useState("Moved back to Sydney and after a steady weekend circle - pottery, runs, easy company.");
    const [suburb, setSuburb] = useState("Newtown");
    const [interests, setInterests] = useState(() => new Set(["Pottery", "Run clubs", "Live music", "Wine tasting", "Plants", "Cocktails"]));
    const [music, setMusic] = useState(() => new Set(["Jazz", "Indie", "Soul"]));
    const [showMore, setShowMore] = useState(false);
    const [attendeeVisible, setAttendeeVisible] = useState(true);
    const [dating, setDating] = useState(false);
    const [meet, setMeet] = useState("Everyone");
    const [ageMin, setAgeMin] = useState(25);
    const [ageMax, setAgeMax] = useState(38);
    const [notif, setNotif] = useState({ mutuals: true, plans: true, reminders: true, digest: true, product: false });
    const [savedSec, setSavedSec] = useState(null);

    const toggleIntent = (k) => setIntents((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });
    const datingOpen = intents.has("Open to dating");
    const TAGGROUPS = window.DATA.INTEREST_TAGS;
    const GENRES = window.DATA.MUSIC_TAGS;
    const toggleInt = (t) => setInterests((s) => { const x = new Set(s); x.has(t) ? x.delete(t) : x.add(t); return x; });
    const toggleMusic = (t) => setMusic((s) => { const x = new Set(s); x.has(t) ? x.delete(t) : x.add(t); return x; });
    const save = (sec) => { setSavedSec(sec); setTimeout(() => setSavedSec((v) => (v === sec ? null : v)), 1600); };
    const renderTagGroup = (g) => <div key={g.key} style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".03em", color: "var(--text-muted)", marginBottom: 9 }}>{g.label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {g.tags.map((t) => <Tag key={t} selected={interests.has(t)} onClick={() => toggleInt(t)}>{t}</Tag>)}
      </div>
    </div>;

    useEffect(() => { const onKey = (e) => { if (e.key === "Escape") { if (!web && active) setActive(null); else if (back) back(); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [active, web, back]);

    const PHOTOS = 1, SLOTS = 5;

    /* ---------------- section bodies ---------------- */
    const EditProfile = () => <div>
      <Group>
        <SectionHead>Photos</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(5,1fr)" : "repeat(3,1fr)", gap: 10 }}>
          {Array.from({ length: SLOTS }).map((_, i) => i < PHOTOS
            ? <div key={i} style={{ aspectRatio: "1", borderRadius: "var(--radius-md)", background: "var(--lavender-200)", display: "flex", alignItems: "center", justifyContent: "center" }}><Avatar name="Ava Mendez" size={40} /></div>
            : <button key={i} style={{ aspectRatio: "1", borderRadius: "var(--radius-md)", background: "var(--surface-tint)", border: "1.5px dashed var(--border-mid)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="plus" size={18} w={2} color="var(--purple-400)" /></button>)}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>Add a few - photos help people put a face to the name.</p>
      </Group>

      <Group>
        <SectionHead>About you</SectionHead>
        <div style={{ display: web ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <FieldRow label="Name" note="Managed in Account"><input value="Ava" readOnly style={{ ...inputStyle, background: "var(--surface-tint)", color: "var(--text-muted)" }} /></FieldRow>
          <FieldRow label="Age" note="From your date of birth"><input value="28" readOnly style={{ ...inputStyle, background: "var(--surface-tint)", color: "var(--text-muted)" }} /></FieldRow>
        </div>
        <FieldRow label="Suburb"><input value={suburb} onChange={(e) => setSuburb(e.target.value)} style={inputStyle} /></FieldRow>
      </Group>

      <Group>
        <SectionHead>Bio</SectionHead>
        <textarea className="ckPEArea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line or two in your own words - e.g. potter by hobby, gig-goer by habit." />
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-faint)" }}>{bio.length}/180 - keep it short and yours.</p>
      </Group>

      <Group>
        <SectionHead sub="Pick any that fit - it just tunes what we show you.">Here for</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: web ? "1fr 1fr" : "1fr", gap: 10 }}>
          {INTENTS.map((label) => <IntentCard key={label} label={label} on={intents.has(label)} onClick={() => toggleIntent(label)} />)}
        </div>
        {datingOpen && <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--lavender-100)", borderRadius: "var(--radius-lg)", border: "1px solid var(--lavender-200)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>Dating mode {datingMode ? "· On" : "· Paused"}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>Only people also open to dating ever see this.</div>
            </div>
            <Toggle checked={datingMode} onChange={setDatingMode} />
          </div>
        </div>}
      </Group>

      <Group>
        <SectionHead sub="The specific things you're into - not just the broad categories.">Interests</SectionHead>
        {TAGGROUPS.slice(0, 8).map(renderTagGroup)}
        {showMore && TAGGROUPS.slice(8).filter((g) => !g.gated || datingOpen).map(renderTagGroup)}
        <button onClick={() => setShowMore((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)" }}>
          {showMore ? "Show fewer interests" : "+ Show more interests"}<Icon name={showMore ? "chevD" : "chevR"} size={15} w={2.2} color="var(--purple-600)" style={{ transform: showMore ? "rotate(180deg)" : "none" }} />
        </button>
        <p style={{ margin: "16px 0 0", fontSize: 13.5, fontWeight: 600, color: interests.size >= 3 ? "var(--sage)" : "var(--text-muted)" }}>{interests.size === 0 ? "Pick a few you're into" : `${interests.size} picked${interests.size >= 3 ? " - nice" : ""}`}</p>
      </Group>

      <Group>
        <SectionHead sub="A few genres, if you like - optional.">Music you're into</SectionHead>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GENRES.map((t) => <Tag key={t} selected={music.has(t)} onClick={() => toggleMusic(t)}>{t}</Tag>)}
        </div>
      </Group>

      <Group last>
        <button onClick={openQuiz} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: web ? "16px 18px" : "15px 16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-soft)", background: "var(--white)", boxShadow: "var(--shadow-sm)", cursor: "pointer" }}>
          <span style={{ flex: "none", width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--lavender-100)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="spark" size={20} w={1.9} color="var(--purple-600)" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>{quizDone ? "Update your Click quiz" : "Take the Click quiz"}</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 2 }}>{quizDone ? "Last updated today" : "It makes your suggestions a lot more relevant."}</span>
          </span>
          <Icon name="chevR" size={18} w={2.1} color="var(--text-faint)" />
        </button>
      </Group>
      <SaveBar web={web} saved={savedSec === "edit"} onSave={() => save("edit")} />
    </div>;

    const Privacy = () => <div>
      <Group>
        <SectionHead>Event visibility</SectionHead>
        <RowToggle title="Show me in event attendee lists" desc="Off means people at your events can't click with you. You'll still see everyone and book anything." checked={attendeeVisible} onChange={setAttendeeVisible} />
      </Group>

      <Group last>
        <SectionHead sub="Private to you. The rest of Click stays intent-neutral - this never shows on your profile or in attendee lists.">Dating</SectionHead>
        <div style={{ marginBottom: dating ? 18 : 0 }}>
          <RowToggle title="Open to dating" desc="When on, we may quietly suggest people who are also open to it. It's never shown publicly." checked={dating} onChange={setDating} />
        </div>
        {dating && <div style={{ padding: "16px 16px 14px", background: "var(--lavender-100)", borderRadius: "var(--radius-lg)", border: "1px solid var(--lavender-200)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 9 }}>I'm interested in</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>{["Men", "Women", "Everyone"].map((o) => <button key={o} onClick={() => setMeet(o)} aria-pressed={meet === o} style={{ minHeight: 40, padding: "8px 16px", borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: meet === o ? 600 : 500, backgroundColor: meet === o ? "var(--purple-600)" : "var(--white)", color: meet === o ? "var(--cream)" : "var(--text-body)", border: "1.5px solid " + (meet === o ? "var(--purple-600)" : "var(--border-mid)") }}>{o}</button>)}</div>
          <AgeRange min={ageMin} max={ageMax} setRange={(a, b) => { setAgeMin(a); setAgeMax(b); }} />
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--purple-800)", opacity: .82, lineHeight: 1.5 }}>Only shapes who we suggest - never shown on your profile.</p>
        </div>}
      </Group>
      <SaveBar web={web} saved={savedSec === "privacy"} onSave={() => save("privacy")} />
    </div>;

    const Account = () => <div>
      <Group>
        <SectionHead>Login</SectionHead>
        <FieldRow label="Name"><input value="Ava Mendez" readOnly style={{ ...inputStyle, background: "var(--surface-tint)", color: "var(--text-muted)" }} /></FieldRow>
        <FieldRow label="Email"><input value="ava.mendez@email.com" readOnly style={{ ...inputStyle, background: "var(--surface-tint)", color: "var(--text-muted)" }} /></FieldRow>
        <FieldRow label="Date of birth" note="Sets your age; can't be changed here."><input value="14 March 1997" readOnly style={{ ...inputStyle, background: "var(--surface-tint)", color: "var(--text-muted)" }} /></FieldRow>
        <a style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", cursor: "pointer" }}>Change password <Icon name="chevR" size={15} w={2.1} color="var(--purple-600)" /></a>
      </Group>
      <Group last>
        <SectionHead>Membership</SectionHead>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <a style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--text-body)", cursor: "pointer" }}><Icon name="chevR" size={15} w={2.1} color="var(--text-muted)" />Sign out</a>
          <a style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--coral, #C0563C)", cursor: "pointer" }}>Pause or delete account</a>
        </div>
      </Group>
    </div>;

    const Notifications = () => {
      const items = [["mutuals", "New mutuals", "When you and someone both click."], ["plans", "Plan updates", "When a plan is suggested, agreed, or changes."], ["reminders", "Event reminders", "A nudge before something you've booked."], ["digest", "Weekly digest", "What's on near you, once a week."], ["product", "Product news", "Occasional updates from Click."]];
      return <div>
        <Group last>
          <SectionHead sub="What we email and notify you about. Separate from the in-app bell.">Notify me about</SectionHead>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {items.map(([k, title, desc]) => <RowToggle key={k} title={title} desc={desc} checked={notif[k]} onChange={(v) => setNotif((s) => ({ ...s, [k]: v }))} />)}
          </div>
        </Group>
        <SaveBar web={web} saved={savedSec === "notifications"} onSave={() => save("notifications")} />
      </div>;
    };

    const bodyFor = (k) => k === "edit" ? <EditProfile /> : k === "privacy" ? <Privacy /> : k === "account" ? <Account /> : <Notifications />;
    const labelFor = (k) => (SECTIONS.find((s) => s[0] === k) || [, "Settings"])[1];

    /* ---------------- chrome ---------------- */
    const styleTag = <style dangerouslySetInnerHTML={{ __html: ".ckPERange{-webkit-appearance:none;appearance:none;background:transparent;position:absolute;top:0;left:0;width:100%;height:28px;margin:0;pointer-events:none}.ckPERange::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:22px;height:22px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);box-shadow:var(--shadow-sm);cursor:pointer;margin-top:-9px}.ckPERange::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);cursor:pointer}.ckPEArea{width:100%;box-sizing:border-box;min-height:90px;padding:12px 14px;background:var(--white);border:1.5px solid var(--border-mid);border-radius:var(--radius-md);font-family:var(--font-sans);font-size:15px;line-height:1.55;color:var(--text-strong);outline:none;resize:vertical}" }} />;

    const BackBtn = ({ onClick, label }) => <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", cursor: "pointer", padding: "6px 0", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}><Icon name="chevL" size={18} w={2.4} color="var(--text-muted)" />{label}</button>;

    /* DESKTOP - sticky sub-nav + content */
    if (web) {
      return <div style={{ padding: "8px 0 48px" }}>
        {styleTag}
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 40px" }}>
          <BackBtn onClick={back} label="Back to profile" />
          <h1 style={{ margin: "6px 0 26px", fontFamily: "var(--font-serif)", fontSize: "2.1rem", fontWeight: 500, letterSpacing: "-.02em", color: "var(--text-strong)" }}>Settings</h1>
          <div style={{ display: "grid", gridTemplateColumns: "232px minmax(0,1fr)", gap: 44, alignItems: "start" }}>
            <nav style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 4 }}>
              {SECTIONS.map(([k, label, icon]) => { const on = active === k; return <button key={k} onClick={() => setActive(k)} style={{ display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "11px 14px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", backgroundColor: on ? "var(--lavender-100)" : "transparent", color: on ? "var(--purple-800)" : "var(--text-body)", fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: on ? 700 : 500 }}><Icon name={icon} size={18} w={1.9} color={on ? "var(--purple-600)" : "var(--text-muted)"} />{label}</button>; })}
            </nav>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 600, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{labelFor(active)}</h2>
              <div style={{ height: 1, background: "var(--border-soft)", margin: "16px 0 0" }} />
              {bodyFor(active)}
            </div>
          </div>
        </div>
      </div>;
    }

    /* MOBILE - sectioned list, drill into a section */
    if (active) {
      return <div style={{ padding: "0 0 32px" }}>
        {styleTag}
        <div style={{ padding: "8px 22px 0" }}>
          <BackBtn onClick={() => setActive(null)} label="Settings" />
          <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-serif)", fontSize: "1.7rem", fontWeight: 500, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{labelFor(active)}</h1>
        </div>
        <div style={{ padding: "0 22px" }}>{bodyFor(active)}</div>
      </div>;
    }
    return <div style={{ padding: "0 0 32px" }}>
      {styleTag}
      <div style={{ padding: "8px 22px 0" }}>
        <BackBtn onClick={back} label="Back to profile" />
        <h1 style={{ margin: "4px 0 18px", fontFamily: "var(--font-serif)", fontSize: "1.8rem", fontWeight: 500, letterSpacing: "-.02em", color: "var(--text-strong)" }}>Settings</h1>
      </div>
      <div style={{ padding: "0 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {SECTIONS.map(([k, label, icon]) => <button key={k} onClick={() => setActive(k)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-soft)", background: "var(--white)", boxShadow: "var(--shadow-sm)", cursor: "pointer", textAlign: "left" }}>
          <span style={{ flex: "none", width: 38, height: 38, borderRadius: "var(--radius-sm)", background: "var(--lavender-100)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={18} w={1.9} color="var(--purple-600)" /></span>
          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span>
          <Icon name="chevR" size={18} w={2.1} color="var(--text-faint)" />
        </button>)}
      </div>
    </div>;
  }

  window.ScreensSet = { Settings };
})();
