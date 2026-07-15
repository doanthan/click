(function () {
  /* Click - My Events (the bookings hub, distinct from Discovery). Tabs: Upcoming · Waitlist ·
     Saved · Past, with a List / Calendar toggle. List is default; calendar = month grid (desktop)
     / agenda (mobile). Reuses the event-card system as a compact row. Inline styles. */
  const { useState, CAT, Icon, Btn, Cover, Status, Badge } = window.CK;
  const D = window.DATA;
  const { byId } = D;

  const TABS = [["upcoming", "Upcoming"], ["waitlist", "Waitlist"], ["saved", "Saved"], ["past", "Past"]];
  const SETS = { upcoming: D.BOOKINGS, waitlist: D.WAITLIST, saved: D.SAVED, past: D.PAST };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtDay = (iso) => {const d = new Date(iso + "T00:00");return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;};

  /* ---------------- compact event row (the card system, row variant) ---------------- */
  function Row({ e, tab, open, toggleSave }) {
    const booked = tab === "upcoming" || tab === "past";
    const loc = booked ? [e.venue, e.suburb].filter(Boolean).join(" · ") : `${e.suburb} · ${e.dist}`;
    const past = tab === "past";
    let badge = null,control = null;
    if (tab === "upcoming") {badge = <Status kind="going" />;control = <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Btn size="sm" variant="secondary" icon="calendar" onClick={(ev) => {ev.stopPropagation();}}>Add to calendar</Btn><button onClick={(ev) => ev.stopPropagation()} style={ghost}>Can't make it?</button></div>;} else
    if (tab === "waitlist") {badge = <Badge tone="amber" style={{ fontWeight: 700 }}>Waitlist · #3</Badge>;control = <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>We'll let you know if a spot opens.</span><button onClick={(ev) => ev.stopPropagation()} style={ghost}>Leave waitlist</button></div>;} else
    if (tab === "saved") {control = <div style={{ display: "flex", gap: 8 }}><Btn size="sm" onClick={(ev) => {ev.stopPropagation();open(e);}}>RSVP</Btn><button onClick={(ev) => {ev.stopPropagation();toggleSave(e.id);}} style={ghost}>Remove</button></div>;} else
    if (tab === "past") {badge = <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}><Icon name="check" size={13} w={2.4} color="var(--text-muted)" />You went</span>;control = <Btn size="sm" variant="secondary" onClick={(ev) => {ev.stopPropagation();open(e);}}>Book again</Btn>;}

    return <div onClick={() => open(e)} style={{ display: "flex", gap: 15, background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", padding: 14, boxShadow: "var(--shadow-sm)", cursor: "pointer", opacity: past ? .85 : 1 }}>
      <div style={{ width: 76, height: 76, borderRadius: 14, overflow: "hidden", flex: "none", filter: past ? "saturate(.8)" : "none" }}><Cover category={e.category} h={76} photo={e.photo} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5, flexWrap: "wrap" }}>
          {badge}
          {tab === "saved" && <span style={{ display: "inline-flex" }}><Icon name="bookmark" size={15} w={2} color="var(--purple-600)" style={{ fill: "var(--purple-600)" }} /></span>}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2, marginBottom: 4 }}>{e.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: "var(--text-muted)", fontWeight: 500, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="calendar" size={13} w={1.9} color="var(--text-muted)" />{e.when}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="pin" size={13} w={1.9} color="var(--text-muted)" />{loc}</span>
          <span style={{ fontWeight: 600, color: e.price === "Free" ? "var(--success)" : "var(--text-strong)" }}>{e.price}</span>
        </div>
        {control}
      </div>
    </div>;
  }
  const ghost = { border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", padding: 0 };

  const EMPTY = {
    upcoming: ["No plans yet", "Find something good near you and RSVP - it'll show up here."],
    waitlist: ["No waitlists right now", "When something's full, join the waitlist and we'll watch it for you."],
    saved: ["Nothing saved yet", "Tap the bookmark on any event to keep it here."],
    past: ["Nothing in the past yet", "Once you've been to something, it'll rest here - re-book anytime."]
  };

  /* ---------------- calendar: month grid (desktop) / agenda (mobile) ---------------- */
  function MonthGrid({ web, open }) {
    const dated = Object.entries(D.MYDATES).map(([id, iso]) => ({ e: byId(id), iso, d: new Date(iso + "T00:00") })).filter((x) => x.e);
    const byDate = {};dated.forEach((x) => {(byDate[x.iso] = byDate[x.iso] || []).push(x.e);});
    const [sel, setSel] = useState(null);
    const year = 2026,month = 6; // July
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const today = "2026-07-08";
    const iso = (day) => `2026-07-${String(day).padStart(2, "0")}`;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);

    if (!web) {
      // mobile agenda - date-grouped list
      const dates = Object.keys(byDate).sort();
      return <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {dates.map((dt) => <div key={dt}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 700, color: dt === today ? "var(--purple-700)" : "var(--text-strong)", marginBottom: 10, letterSpacing: ".01em" }}>{fmtDay(dt)}{dt === today ? " · Today" : ""}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{byDate[dt].map((e) => <div key={e.id} onClick={() => open(e)} style={{ display: "flex", alignItems: "center", gap: 13, background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", padding: 11, boxShadow: "var(--shadow-sm)", cursor: "pointer" }}>
            <div style={{ width: 50, height: 50, borderRadius: 11, overflow: "hidden", flex: "none" }}><Cover category={e.category} h={50} photo={e.photo} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div><div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{e.when} · {e.suburb}</div></div>
            <Icon name="chevR" size={18} color="var(--ink-faint)" />
          </div>)}</div>
        </div>)}
      </div>;
    }
    // desktop month grid
    const selList = sel && byDate[sel] ? byDate[sel] : null;
    return <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 28, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600, color: "var(--text-strong)" }}>July 2026</h3>
          <div style={{ display: "flex", gap: 6 }}>{[["chevL", -1], ["chevR", 1]].map(([ic]) => <span key={ic} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border-mid)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}><Icon name={ic} size={16} w={2} /></span>)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "var(--text-faint)", padding: "0 0 6px" }}>{d[0]}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dt = iso(d),evs = byDate[dt],isToday = dt === today,on = sel === dt;
            return <button key={i} onClick={() => evs && setSel(dt)} style={{ aspectRatio: "1", border: `1px solid ${on ? "var(--purple-500)" : "var(--border-soft)"}`, borderRadius: 11, background: on ? "var(--lavender-100)" : isToday ? "var(--surface-tint)" : "var(--white)", cursor: evs ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "7px 4px 4px", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--purple-700)" : "var(--text-body)" }}>{d}</span>
              {evs && <span style={{ display: "flex", gap: 3 }}>{evs.slice(0, 3).map((e, j) => <i key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple-600)" }} />)}</span>}
            </button>;
          })}
        </div>
      </div>
      <div style={{ background: "var(--surface-tint)", borderRadius: "var(--radius-xl)", padding: "20px 20px" }}>
        <h4 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{selList ? fmtDay(sel) : "Pick a day"}</h4>
        {selList ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{selList.map((e) => <div key={e.id} onClick={() => open(e)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-md)", padding: 10, cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flex: "none" }}><Cover category={e.category} h={44} photo={e.photo} /></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.when}</div></div>
        </div>)}</div> : <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>Days with a dot have something on. Pick one to see what's on.</p>}
      </div>
    </div>;
  }

  function MyEvents({ web, open, saved, toggleSave, initialTab }) {
    const [tab, setTab] = useState(initialTab || "upcoming");
    const [view, setView] = useState("list");
    const counts = { upcoming: D.BOOKINGS.length, waitlist: D.WAITLIST.length, saved: [...saved].length, past: D.PAST.length };
    const list = (tab === "saved" ? [...saved] : SETS[tab]).map(byId).filter(Boolean);

    return <div style={{ padding: web ? "10px 0 48px" : "4px 0 24px" }}>
      <div style={{ maxWidth: web ? 1060 : "none", margin: "0 auto", padding: web ? "0 40px" : "0 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "6px 0 4px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--text-strong)" }}>Your events</h1>
            <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-muted)", fontWeight: "500" }}>Everything you've RSVP'd to, saved, or been to.</p>
          </div>
          <div style={{ display: "inline-flex", background: "var(--white)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
            {[["list", "List"], ["calendar", "Calendar"]].map(([k, l]) => {const on = view === k;return <button key={k} onClick={() => setView(k)} style={{ border: "none", cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "7px 16px", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: on ? 700 : 500, background: on ? "var(--purple-600)" : "transparent", color: on ? "var(--cream)" : "var(--text-body)" }}>{l}</button>;})}
          </div>
        </div>

        {view === "list" ? <div style={{ maxWidth: web ? 780 : "none" }}>
          <div className="ckRail" style={{ display: "flex", gap: 8, marginBottom: 22, overflowX: "auto", borderBottom: "1px solid var(--border-soft)", paddingBottom: 0 }}>
            {TABS.map(([k, l]) => {const on = tab === k;const n = counts[k];return <button key={k} onClick={() => setTab(k)} style={{ flex: "none", border: "none", background: "none", cursor: "pointer", padding: "8px 4px 12px", marginBottom: -1, borderBottom: `2.5px solid ${on ? "var(--purple-600)" : "transparent"}`, fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: on ? 600 : 500, color: on ? "var(--purple-700)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>{l}{n > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: on ? "var(--purple-600)" : "var(--text-faint)" }}>{n}</span>}</button>;})}
          </div>
          {list.length > 0 ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{list.map((e) => <Row key={e.id} e={e} tab={tab} open={open} toggleSave={toggleSave} />)}</div> :
          <div style={{ background: "var(--surface-tint)", borderRadius: "var(--radius-xl)", padding: web ? "44px 30px" : "34px 22px", textAlign: "center" }}>
              <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-strong)" }}>{EMPTY[tab][0]}</h3>
              <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 360, marginInline: "auto" }}>{EMPTY[tab][1]}</p>
            </div>}
        </div> : <MonthGrid web={web} open={open} />}
      </div>
    </div>;
  }

  window.ScreensME = { MyEvents };
})();