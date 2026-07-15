(function () {
  /* Click - Discovery (/events). Responsive WEBSITE.
     Desktop (>=1024): category icon-strip + left Type/Date/Distance sidebar + sortable 3-up grid.
     Mobile (<768): sticky search -> horizontal category chips -> Filters bottom sheet (slide-up + dim)
       -> removable applied-filter chips -> single-column cards.
     Category icons = ONE on-brand treatment: purple line icon on lavender-tint circle;
     selected = circle fills Deep Purple, icon reverses to cream. No rainbow. Inline styles. */
  const { useState, useEffect, CAT, Icon, Btn } = window.CK;
  const D = window.DATA;
  const { EVENTS } = D;
  const EventCard = window.ScreensA.EventCard;

  /* ---------------- CANONICAL CATEGORY SYSTEM - the 16 (source of truth: TECH/07_INTEREST_TAGS).
       ONE Lucide line glyph per category on a Lavender tint circle; identical on Discovery,
       Dashboard, Onboarding. Selected = Deep Purple fill, glyph reverses to Cream. ---------------- */
  const CAT_ICONS = {
    all: () => <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></>,
    wellness: () => <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></>,
    food: () => <><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></>,
    arts: () => <><path d="M12 3a9 8 0 0 0 0 16 1.8 1.8 0 0 0 1.7-2.4 1.8 1.8 0 0 1 1.7-2.4H17a4 4 0 0 0 4-4 9 8 0 0 0-9-7.2Z"/><circle cx="8" cy="9.5" r="1"/><circle cx="12.5" cy="7" r="1"/><circle cx="16" cy="11" r="1"/></>,
    social: () => <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    music: () => <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    fitness: () => <><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></>,
    outdoors: () => <><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></>,
    learning: () => <><path d="M3 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-2.6H3z"/><path d="M21 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-2.6h6z"/></>,
    networking: () => <><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></>,
    dance: () => <><path d="M9 18V5l12-2v13"/><path d="m9 9 12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
    creative: () => <><path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a9 9 0 0 1-16 0V5Z"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M8.5 13a4 4 0 0 0 7 0"/></>,
    lifestyle: () => <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="M19 4v3"/><path d="M20.5 5.5h-3"/><path d="M5 17v2"/><path d="M6 18H4"/></>,
    community: () => <><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></>,
    travel: () => <><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/></>,
    family: () => <><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M17.6 7.6a9 9 0 0 1 3 4 1.8 1.8 0 0 1 0 1.6 9 9 0 0 1-17.2 0 1.8 1.8 0 0 1 0-1.6A9 9 0 0 1 12 3c1.6 0 3 .7 3 2s-.8 2-1.8 2c-.7 0-1.2-.4-1.2-.9"/></>,
    dating: () => <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></>
  };
  function CatGlyph({ name, size = 20, w = 1.75, color = "currentColor" }) {
    const draw = CAT_ICONS[name] || CAT_ICONS.all;
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>{draw()}</svg>;
  }

  /* the canonical 16 + All (07 display order). `cats` maps to the mockup's event.category values;
     `gated` (Dating) renders only for dating-intent users, never in the default browse set. */
  const CATS = [
    { key: "all", label: "All", icon: "all", cats: null },
    { key: "wellness", label: "Wellness", icon: "wellness", cats: [] },
    { key: "food", label: "Food & Drink", icon: "food", cats: ["wine", "cooking"] },
    { key: "arts", label: "Arts & Crafts", icon: "arts", cats: ["ceramics", "art"] },
    { key: "social", label: "Social", icon: "social", cats: [] },
    { key: "music", label: "Music", icon: "music", cats: ["music"] },
    { key: "fitness", label: "Fitness & Sport", icon: "fitness", cats: ["run"] },
    { key: "outdoors", label: "Outdoors", icon: "outdoors", cats: [] },
    { key: "learning", label: "Learning", icon: "learning", cats: ["workshops"] },
    { key: "networking", label: "Networking", icon: "networking", cats: [] },
    { key: "dance", label: "Dance", icon: "dance", cats: [] },
    { key: "creative", label: "Creative", icon: "creative", cats: [] },
    { key: "lifestyle", label: "Lifestyle", icon: "lifestyle", cats: [] },
    { key: "community", label: "Community", icon: "community", cats: [] },
    { key: "travel", label: "Travel", icon: "travel", cats: [] },
    { key: "family", label: "Family", icon: "family", cats: [] },
    { key: "dating", label: "Dating", icon: "dating", cats: [], gated: true }
  ];
  const TYPES = [["free", "Free"], ["under25", "Under $25"], ["trending", "Trending"], ["new", "New"], ["suggested", "Suggested for you"]];
  const DATES = [["any", "Any"], ["today", "Today"], ["weekend", "This weekend"], ["week", "This week"], ["month", "This month"]];
  const SORTS = [["soon", "Soonest"], ["near", "Nearest"], ["trending", "Trending"], ["price", "Price"]];

  const DAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const priceNum = (e) => e.price === "Free" ? 0 : parseInt(e.price.replace(/[^0-9]/g, ""), 10) || 0;
  const distNum = (e) => parseFloat(e.dist) || 99;
  const dayOf = (e) => DAY[e.when.split(" ")[0]] || 9;
  const SUGGEST = new Set(D.SUGGEST_B);
  const TRENDY = { trending: 0, almostfull: 1, spots: 2, new: 3, free: 4 };

  function matchType(e, k) {
    if (k === "free") return priceNum(e) === 0;
    if (k === "under25") return priceNum(e) > 0 && priceNum(e) < 25;
    if (k === "trending") return e.status === "trending" || e.status === "almostfull";
    if (k === "new") return e.status === "new";
    if (k === "suggested") return SUGGEST.has(e.id);
    return true;
  }
  function matchDate(e, d) {
    if (d === "any" || d === "week" || d === "month") return true;
    if (d === "today") return dayOf(e) === 4;       // demo "today" = Thursday
    if (d === "weekend") return dayOf(e) >= 6;
    return true;
  }

  /* ---------------- category chip: icon-in-circle + label (the on-brand treatment) ---------------- */
  function CatChip({ c, active, onClick, web }) {
    const [hov, setHov] = useState(false);
    const d = web ? 56 : 48;
    const bg = active ? "var(--purple-600)" : (hov ? "color-mix(in srgb,var(--lavender-300) 32%,var(--cream))" : "color-mix(in srgb,var(--lavender-300) 18%,var(--cream))");
    return <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: web ? 88 : 78, padding: 0, background: "none", border: "none", cursor: "pointer" }}>
      <span style={{ width: d, height: d, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s" }}>
        <CatGlyph name={c.icon} size={web ? 26 : 23} color={active ? "var(--cream)" : "var(--purple-600)"} />
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: active ? 600 : 500, lineHeight: 1.25, color: active ? "var(--purple-700)" : "var(--text-body)", textAlign: "center" }}>{c.label}</span>
    </button>;
  }
  function CatStrip({ value, onChange, web }) {
    return <div className="ckRail" style={{ display: "flex", gap: web ? 6 : 4, overflowX: web ? "visible" : "auto", flexWrap: web ? "wrap" : "nowrap", margin: web ? 0 : "0 -22px", padding: web ? 0 : "2px 22px 2px" }}>
      {CATS.filter((c) => !c.gated).map((c) => <CatChip key={c.key} c={c} web={web} active={value === c.key} onClick={() => onChange(c.key)} />)}
    </div>;
  }

  /* ---------------- shared filter controls ---------------- */
  function FilterGroup({ label, children }) {
    return <div style={{ marginBottom: 22 }}>
      <p style={{ margin: "0 0 11px", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>;
  }
  function Pill({ active, onClick, children }) {
    return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: active ? 600 : 500, whiteSpace: "nowrap", transition: "background .15s,border-color .15s", background: active ? "var(--purple-600)" : "var(--white)", color: active ? "var(--cream)" : "var(--text-body)", border: `1.5px solid ${active ? "var(--purple-600)" : "var(--border-mid)"}` }}>
      {active && <Icon name="check" size={14} w={2.6} color="var(--cream)" />}{children}
    </button>;
  }
  function FilterBody({ types, toggleType, date, setDate, dist, setDist }) {
    return <div>
      <FilterGroup label="Type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{TYPES.map(([k, l]) => <Pill key={k} active={types.includes(k)} onClick={() => toggleType(k)}>{l}</Pill>)}</div>
      </FilterGroup>
      <FilterGroup label="Date">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{DATES.map(([k, l]) => <Pill key={k} active={date === k} onClick={() => setDate(k)}>{l}</Pill>)}</div>
      </FilterGroup>
      <FilterGroup label="Distance">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{[[1, "1 km"], [3, "3 km"], [5, "5 km"], [10, "10 km"], [25, "Any distance"]].map(([v, l]) => <Pill key={v} active={dist === v} onClick={() => setDist(v)}>{l}</Pill>)}</div>
      </FilterGroup>
    </div>;
  }
  function SortSelect({ value, onChange }) {
    return <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ appearance: "none", WebkitAppearance: "none", background: "var(--white)", border: "1px solid var(--border-mid)", borderRadius: "var(--radius-pill)", padding: "8px 32px 8px 14px", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-strong)", cursor: "pointer" }}>
        {SORTS.map(([k, l]) => <option key={k} value={k}>Sort · {l}</option>)}
      </select>
      <span style={{ position: "absolute", right: 11, pointerEvents: "none", display: "flex" }}><Icon name="chevD" size={15} color="var(--text-muted)" /></span>
    </div>;
  }
  function SearchField({ value, onChange, web }) {
    const [f, setF] = useState(false);
    return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 15px", height: 48, background: "var(--white)", border: `1.5px solid ${f ? "var(--accent)" : "var(--border-mid)"}`, borderRadius: "var(--radius-md)", boxShadow: f ? "0 0 0 4px color-mix(in srgb,var(--lavender-300) 42%,transparent)" : "var(--shadow-xs)", width: "100%", transition: "border .15s,box-shadow .15s" }}>
      <Icon name="search" size={19} w={1.9} color="var(--text-muted)" />
      <input value={value} placeholder="Search events, venues, or interests…" onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--text-strong)" }} />
      {value && <button onClick={() => onChange("")} style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}><Icon name="x" size={16} w={2} color="var(--text-muted)" /></button>}
    </div>;
  }
  function AppliedChip({ children, onRemove }) {
    return <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 8px 6px 13px", borderRadius: "var(--radius-pill)", background: "var(--lavender-100)", color: "var(--purple-700)", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
      {children}<button onClick={onRemove} style={{ border: "none", background: "color-mix(in srgb,var(--purple-600) 14%,transparent)", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Icon name="x" size={11} w={2.6} color="var(--purple-700)" /></button>
    </span>;
  }

  /* ====================== DISCOVERY ====================== */
  function Discover({ web, width = 1440, open, saved, toggleSave, initialCat = "all" }) {
    /* the left filter SIDEBAR appears only ≥1024; 768 uses the Filters-button → sheet pattern (TEMPLATE §1a) */
    const sidebar = web && width >= 1024;
    const [q, setQ] = useState("");
    const [cat, setCat] = useState(initialCat);
    const [types, setTypes] = useState([]);
    const [date, setDate] = useState("any");
    const [dist, setDist] = useState(25);
    const [sort, setSort] = useState("soon");
    const [sheet, setSheet] = useState(false);
    const [layer, setLayer] = useState(null);
    useEffect(() => { setLayer(document.getElementById("ckModalLayer")); }, [sheet]);

    const toggleType = (k) => setTypes((t) => t.includes(k) ? t.filter((x) => x !== k) : [...t, k]);
    const catDef = CATS.find((c) => c.key === cat) || CATS[0];
    const ql = q.trim().toLowerCase();

    let list = EVENTS.filter((e) =>
      (!catDef.cats || catDef.cats.includes(e.category)) &&
      types.every((k) => matchType(e, k)) &&
      matchDate(e, date) && distNum(e) <= dist &&
      (!ql || [e.name, e.venue, e.suburb].filter(Boolean).join(" ").toLowerCase().includes(ql))
    );
    list = list.slice().sort((a, b) => sort === "near" ? distNum(a) - distNum(b) : sort === "trending" ? (TRENDY[a.status] ?? 9) - (TRENDY[b.status] ?? 9) : sort === "price" ? priceNum(a) - priceNum(b) : dayOf(a) - dayOf(b));

    const filterCount = types.length + (date !== "any" ? 1 : 0) + (dist < 25 ? 1 : 0);
    const anyFilter = filterCount > 0 || ql || cat !== "all";
    const reset = () => { setTypes([]); setDate("any"); setDist(25); };
    const resetAll = () => { reset(); setQ(""); setCat("all"); };
    const coldStart = list.length === 0 && filterCount === 0 && !ql; // empty category only

    const Results = () => {
      if (list.length > 0) return <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(auto-fill,minmax(280px,1fr))" : "repeat(2,1fr)", gap: web ? 22 : 12 }}>
        {list.map((e) => <EventCard key={e.id} e={e} mini={!web} onClick={() => open(e)} saved={saved.has(e.id)} onSave={() => toggleSave(e.id)} />)}
      </div>;
      if (coldStart) return <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, color: "var(--purple-700)" }}>
          <Icon name="spark" size={18} w={1.9} color="var(--purple-500)" /><span style={{ fontSize: 14.5, fontWeight: 600 }}>Nothing on for that yet - new here? Start with these.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(auto-fill,minmax(280px,1fr))" : "repeat(2,1fr)", gap: web ? 22 : 12 }}>
          {EVENTS.slice(0, 3).map((e) => <EventCard key={e.id} e={e} mini={!web} onClick={() => open(e)} saved={saved.has(e.id)} onSave={() => toggleSave(e.id)} />)}
        </div>
      </div>;
      return <div style={{ background: "var(--surface-tint)", borderRadius: "var(--radius-xl)", padding: web ? "48px 30px" : "36px 22px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Icon name="compass" size={32} w={1.7} color="var(--purple-400)" /></div>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600, color: "var(--text-strong)" }}>{ql ? `No events match "${q.trim()}" yet` : "Nothing matches those filters."}</h3>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 360, marginInline: "auto" }}>{ql ? "Try a category below, or widen your filters." : "Try widening the date or distance - there's always more on next week."}</p>
        <Btn variant="secondary" size="sm" onClick={resetAll}>Clear filters</Btn>
      </div>;
    };

    /* applied-filter chips (visible state without reopening) */
    const chips = [
      ...types.map((k) => ({ k, label: TYPES.find((t) => t[0] === k)[1], remove: () => toggleType(k) })),
      ...(date !== "any" ? [{ k: "date", label: DATES.find((d) => d[0] === date)[1], remove: () => setDate("any") }] : []),
      ...(dist < 25 ? [{ k: "dist", label: `${dist} km`, remove: () => setDist(25) }] : [])
    ];

    /* ---------- DESKTOP (>=1024): sidebar layout ---------- */
    if (sidebar) return <div style={{ padding: "12px 40px 56px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--text-strong)" }}>What's on near you</h1>
        <p style={{ margin: "0 0 18px", fontSize: 14.5, color: "var(--text-muted)", fontWeight: 500 }}>{EVENTS.length} events this week</p>
        <SearchField value={q} onChange={setQ} web />
        <div style={{ margin: "18px 0 8px" }}><CatStrip value={cat} onChange={setCat} web /></div>
        <div style={{ display: "flex", gap: 36, alignItems: "flex-start", marginTop: 18 }}>
          <aside style={{ flex: "none", width: 260, position: "sticky", top: 16 }}>
            <FilterBody types={types} toggleType={toggleType} date={date} setDate={setDate} dist={dist} setDist={setDist} />
            {anyFilter && <button onClick={resetAll} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="x" size={15} w={2.2} />Reset all</button>}
          </aside>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{list.length} {list.length === 1 ? "event" : "events"}</span>
              <SortSelect value={sort} onChange={setSort} />
            </div>
            {chips.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 18 }}>
              {chips.map((c) => <AppliedChip key={c.k} onRemove={c.remove}>{c.label}</AppliedChip>)}
              <button onClick={reset} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", padding: "0 4px" }}>Clear all</button>
            </div>}
            <Results />
          </div>
        </div>
      </div>
    </div>;

    /* ---------- MOBILE (<768): sticky search -> chips -> filters sheet -> applied chips -> cards ---------- */
    return <div style={{ padding: "6px 0 24px" }}>
      <div style={{ position: "sticky", top: 0, padding: "6px 22px 0", background: "var(--cream)", zIndex: 6 }}>
        <h1 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: "var(--text-h1)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--text-strong)" }}>What's on near you</h1>
        <SearchField value={q} onChange={setQ} />
        <div style={{ marginTop: 12 }}><CatStrip value={cat} onChange={setCat} /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 6px" }}>
          <button onClick={() => setSheet(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, background: filterCount ? "var(--purple-600)" : "var(--white)", color: filterCount ? "var(--cream)" : "var(--text-body)", border: `1.5px solid ${filterCount ? "var(--purple-600)" : "var(--border-mid)"}` }}>
            <Icon name="filter" size={16} w={2} color={filterCount ? "var(--cream)" : "var(--text-body)"} />Filters{filterCount ? ` · ${filterCount}` : ""}
          </button>
          <SortSelect value={sort} onChange={setSort} />
        </div>
        {chips.length > 0 && <div className="ckRail" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -22px", padding: "4px 22px 10px" }}>
          {chips.map((c) => <AppliedChip key={c.k} onRemove={c.remove}>{c.label}</AppliedChip>)}
          <button onClick={reset} style={{ flex: "none", border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Clear</button>
        </div>}
      </div>

      {sheet && (() => {
        const overlay = <div onClick={() => setSheet(false)} style={{ position: layer ? "absolute" : "fixed", inset: 0, zIndex: 60, background: "rgba(28,24,48,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", pointerEvents: "auto" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: layer ? "none" : 560, maxHeight: "86%", display: "flex", flexDirection: "column", background: "var(--white)", borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0", boxShadow: "var(--shadow-xl)", overflow: "hidden" }}>
          <div style={{ flex: "none", paddingTop: 8, display: "flex", justifyContent: "center" }}><span style={{ width: 40, height: 5, borderRadius: 999, background: "var(--mist-strong)" }} /></div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 10px" }}>
            <button onClick={reset} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--purple-600)", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Reset</button>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-strong)" }}>Filters</h3>
            <button onClick={() => setSheet(false)} aria-label="Close filters" style={{ border: "none", background: "none", cursor: "pointer", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={20} w={2.2} color="var(--text-body)" /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 10px" }}><FilterBody types={types} toggleType={toggleType} date={date} setDate={setDate} dist={dist} setDist={setDist} /></div>
          <div style={{ flex: "none", padding: "10px 18px calc(16px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border-soft)", background: "var(--white)" }}>
            <Btn full size="lg" onClick={() => setSheet(false)}>Show {list.length} {list.length === 1 ? "event" : "events"}</Btn>
          </div>
        </div>
      </div>;
        return layer ? window.ReactDOM.createPortal(overlay, layer) : overlay;
      })()}

      <div style={{ padding: "8px 22px 0" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)", margin: "2px 0 14px" }}>{list.length} {list.length === 1 ? "event" : "events"}{coldStart ? "" : " near you"}</div>
        <Results />
      </div>
    </div>;
  }

  window.ScreensDisc = { Discover, CatGlyph, CATS, CAT_ICONS, CatChip };
})();
