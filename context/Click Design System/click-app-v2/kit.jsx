(function () {
  /* Click - App Screens mockup. Shared primitives, built on design-system tokens.
     Inline styles only; everything shared is exported on window.CK so the babel
     modules (which each get their own scope) can destructure it. */

  const { useState, useEffect, useRef } = React;

  /* ---------------- category + status maps ---------------- */
  /* Canonical activity taxonomy (single source of truth - see docs/Click_Design_Prompt_CategoryIcons.md).
     Categories carry NO colour (all Deep-Purple); meaning comes from the glyph + label only. */
  const CAT = {
    ceramics: { hue: "var(--purple-600)", label: "Pottery & ceramics" },
    run: { hue: "var(--purple-600)", label: "Run clubs & fitness" },
    wine: { hue: "var(--purple-600)", label: "Wine & bars" },
    cooking: { hue: "var(--purple-600)", label: "Cooking" },
    music: { hue: "var(--purple-600)", label: "Live music" },
    art: { hue: "var(--purple-600)", label: "Art & craft" },
    wellness: { hue: "var(--purple-600)", label: "Wellness" },
    trivia: { hue: "var(--purple-600)", label: "Trivia & games" },
    outdoors: { hue: "var(--purple-600)", label: "Outdoors" },
    markets: { hue: "var(--purple-600)", label: "Markets" },
    coffee: { hue: "var(--purple-600)", label: "Coffee" },
    workshops: { hue: "var(--purple-600)", label: "Workshops" }
  };
  /* Discovery status → colour map (design-system tokens; status colours are
     badge/large-text only - selection is ALWAYS deep purple). */
  const STATUS = {
    almostfull: { label: "Almost full", hue: "var(--coral)", text: "#fff" },
    spots: { label: "2 spots left", hue: "var(--coral)", text: "#fff" },
    trending: { label: "Trending", hue: "var(--amber)", text: "#fff" },
    waitlist: { label: "Waitlist", hue: "var(--amber)", text: "#fff" },
    free: { label: "Free", hue: "var(--sage)", text: "#fff" },
    new: { label: "New", hue: "var(--teal)", text: "#fff" },
    full: { label: "Full", hue: "var(--ink-muted)", text: "#fff" },
    going: { label: "You're going", hue: "var(--sage)", text: "#fff" },
    soldout: { label: "Fully booked", hue: "var(--ink-muted)", text: "#fff" }
  };
  const PALETTES = ["var(--purple-600)", "var(--purple-500)", "var(--lavender-500)", "var(--purple-700)", "var(--purple-400)"];
  const initials = (n = "") => {const p = n.trim().split(/\s+/);return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";};

  /* ---------------- icons (lucide-style, even stroke, currentColor) ---------------- */
  const PATHS = {
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    calendar: "M8 2v3M16 2v3M3.5 9h17M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
    pin: "M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    heart: "M12 21s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 3.5C19 16.5 12 21 12 21Z",
    bookmark: "M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1Z",
    check: "M20 6 9 17l-5-5",
    chevL: "M15 18l-6-6 6-6",
    chevR: "M9 6l6 6-6 6",
    chevD: "M6 9l6 6 6-6",
    arrowR: "M5 12h14M13 6l6 6-6 6",
    lock: "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 8 0v3",
    unlock: "M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM8 11V8a4 4 0 0 1 7.5-2",
    users: "M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19a3.2 3.2 0 0 0-3-3.2M18 11.2A3 3 0 0 0 18 5.4",
    user: "M5 20a7 7 0 0 1 14 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    home: "M3 11l9-8 9 8M5 9.5V21h14V9.5",
    compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z",
    x: "M6 6l12 12M18 6 6 18",
    plus: "M12 5v14M5 12h14",
    bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z",
    filter: "M3 5h18M6 12h12M10 19h4",
    spark: "M12 3c.7 4 1.6 4.9 5.6 5.6C13.6 9.3 12.7 10.2 12 14c-.7-3.8-1.6-4.7-5.6-5.4C10.4 7.9 11.3 7 12 3Z",
    send: "M5 12 20 4l-5 16-3.5-6.5L5 12Z",
    coffee: "M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9ZM17 10h2a2.5 2.5 0 0 1 0 5h-2M6 4v1.5M10 4v1.5M14 4v1.5",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    camera: "M3 8.5a2 2 0 0 1 2-2h2L8.5 4.5h7L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
    mail: "M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7ZM3.5 7.5l8.5 6 8.5-6",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.5h.01",
    help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.1 9.5a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V13Z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    trend: "M4 16l5-5 3.5 3.5L20 7M15 7h5v5",
    music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
  };
  function Icon({ name, size = 22, w = 2, color = "currentColor", style = {} }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", ...style }}><path d={PATHS[name] || ""} /></svg>;
  }

  /* ---------------- logo (Click Brand Package - Poppins wordmark + c-mark) ----------------
     Sparkle-pair i-dot: a large lavender glint + a small companion drifting up-right.
     Geometry ported from Click Brand Package.html with its locked tweak values. */
  const LAV = "var(--lavender-300)";
  function spkD(cx, cy, r, opt) {opt = opt || {};const top = (opt.top || 1) * r,right = (opt.right || 1) * r,bot = (opt.bottom || 1) * r,left = (opt.left || 1) * r,w = opt.w == null ? 0.46 : opt.w,p = opt.p == null ? 0.065 : opt.p;const n = (v) => Math.round(v * 100) / 100;
    return `M${n(cx)} ${n(cy - top)} C${n(cx + p * right)} ${n(cy - w * top)} ${n(cx + w * right)} ${n(cy - p * top)} ${n(cx + right)} ${n(cy)} C${n(cx + w * right)} ${n(cy + p * bot)} ${n(cx + p * right)} ${n(cy + w * bot)} ${n(cx)} ${n(cy + bot)} C${n(cx - p * left)} ${n(cy + w * bot)} ${n(cx - w * left)} ${n(cy + p * bot)} ${n(cx - left)} ${n(cy)} C${n(cx - w * left)} ${n(cy - p * top)} ${n(cx - p * left)} ${n(cy - w * top)} ${n(cx)} ${n(cy - top)} Z`;}
  /* sparkle pair - big glint + small companion (the brand signature) */
  function Spark({ size = 20, big = LAV, small = LAV, off = 0.75 }) {
    const sx = 50 + (82 - 50) * off,sy = 50 + (32 - 50) * off;
    return <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ flex: "none" }}><path d={spkD(46, 66, 34, { w: 0.44 })} fill={big} /><path d={spkD(sx, sy, 13, { w: 0.40 })} fill={small} /></svg>;
  }
  /* primary wordmark - lowercase 'click', dotless i carrying the sparkle pair */
  function Logo({ cream, size = 26 }) {
    const col = cream ? "var(--cream)" : "var(--purple-600)";
    const sp = Math.round(size * 0.40),gap = Math.round(size * -0.34);
    return <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1, display: "inline-flex", alignItems: "baseline", whiteSpace: "nowrap", fontSize: size, color: col }}>
    <span style={{ fontFamily: "Poppins" }}>cl</span>
    <span style={{ position: "relative", display: "inline-block", fontFamily: "Poppins" }}>{"\u0131"}<span style={{ position: "absolute", left: "50%", bottom: `calc(100% + ${gap}px)`, transform: "translateX(-42%)" }}><Spark size={sp} /></span></span>
    <span style={{ fontFamily: "Poppins" }}>ck</span>
  </span>;
  }
  /* the c-mark - bare 'c' letterform cradling the sparkle pair (app icon / favicon / avatar) */
  function Cmark({ size = 40, cColor = "var(--purple-600)", accent = LAV }) {
    return <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontSize: size }}>
    <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "1em", color: cColor, letterSpacing: "-.02em" }}>c</span>
    <span style={{ position: "absolute", left: "0.47em", top: "0.11em", width: "0.34em", height: "0.34em", lineHeight: 0 }}><svg width="100%" height="100%" viewBox="0 0 100 100" fill="none"><path d={spkD(50, 50, 44)} fill={accent} /></svg></span>
    <span style={{ position: "absolute", left: "0.71em", top: "-0.1em", width: "0.15em", height: "0.15em", lineHeight: 0 }}><svg width="100%" height="100%" viewBox="0 0 100 100" fill="none"><path d={spkD(50, 50, 44, { w: 0.40 })} fill={accent} /></svg></span>
  </span>;
  }
  /* squircle app tile holding the c-mark */
  function AppTile({ size = 56, bg = "var(--purple-600)", accent = LAV, cColor = "var(--cream)" }) {
    return <div style={{ width: size, height: size, borderRadius: size * 0.225, background: bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(25,19,58,.22)" }}><Cmark size={size * 0.6} cColor={cColor} accent={accent} /></div>;
  }

  /* ---------------- buttons / inputs ---------------- */
  function Btn({ children, variant = "primary", size = "md", full, disabled, loading, onClick, icon, style = {} }) {
    const v = variant === "warm" ? "primary" : variant;
    const known = ["primary", "secondary", "ghost", "onPurple", "pending", "mutual"].includes(v);
    const cls = ["ck-btn", "ck-btn--" + size, known ? "ck-btn--" + v : "", full ? "ck-btn--full" : "", loading ? "ck-btn--loading" : ""].filter(Boolean).join(" ");
    const extra = !known ? { onPurpleGhost: { background: "transparent", color: "var(--cream)", border: "1.5px solid var(--border-onpurple)" } }[v] || {} : {};
    return <button className={cls} onClick={disabled || loading ? undefined : onClick} disabled={disabled || loading} aria-busy={loading || undefined} style={{ ...extra, ...style }}>
    <span className="ck-btn__label">{icon && <Icon name={icon} size={18} w={2.2} />}{children}</span>
    {loading && <span className="ck-btn__spinner" aria-hidden="true" />}
  </button>;
  }
  /* stateful click-with control - ONE footprint across default → pending → mutual.
     Only the fill colour + label change (per Buttons_Tags A1b v4). Pending = muted
     "clicked" (NO ✨); mutual = Sage "clicked ✨" (✨ on the peak only). NO helper
     line on the card - the anonymous reassurance shows once per section. */
  function ClickBtn({ name, state = "default", onClick, onView, full, size = "sm" }) {
    if (state === "mutual")
    return <Btn variant="mutual" size={size} full={full} onClick={onView}>clicked <span aria-hidden="true">✨</span></Btn>;
    if (state === "pending")
    return <Btn variant="pending" size={size} full={full}>clicked</Btn>;
    return <Btn variant="primary" size={size} full={full} onClick={onClick}>{`click with ${name}`}</Btn>;
  }
  function Field({ label, placeholder, type = "text", value, onChange, hint, icon, style = {} }) {
    const [f, setF] = useState(false);
    return <label style={{ display: "flex", flexDirection: "column", gap: 7, ...style }}>
    {label && <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span>}
    <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 50, background: "var(--white)", border: `1.5px solid ${f ? "var(--accent)" : "var(--border-mid)"}`, borderRadius: "var(--radius-md)", boxShadow: f ? "0 0 0 4px color-mix(in srgb,var(--lavender-300) 45%,transparent)" : "none", transition: "border .15s,box-shadow .15s" }}>
      {icon && <Icon name={icon} size={18} w={1.9} color="var(--text-muted)" />}
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange && onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 15.5, color: "var(--text-strong)" }} />
    </span>
    {hint && <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.4 }}>{hint}</span>}
  </label>;
  }
  function Toggle({ checked, onChange, label, helper }) {
    return <label style={{ display: "flex", gap: 13, cursor: "pointer", alignItems: "flex-start" }}>
    <span onClick={() => onChange && onChange(!checked)} style={{ flex: "none", width: 48, height: 29, borderRadius: "var(--radius-pill)", background: checked ? "var(--accent)" : "var(--sand-300)", position: "relative", transition: "background .18s", marginTop: 1 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 22 : 3, width: 23, height: 23, borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-sm)", transition: "left .18s cubic-bezier(.3,.7,.4,1)" }} />
    </span>
    {(label || helper) && <span style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span>{helper && <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{helper}</span>}</span>}
  </label>;
  }

  /* ---------------- avatars / tags / badges ---------------- */
  /* no-photo placeholder: soft lavender disc + a deeper purple silhouette (anonymous-until-mutual).
     pass src for a real photo, variant="initials" for a monogram instead. */
  const PH_TINTS = [["var(--lavender-200)", "var(--purple-500)"], ["#E7DEFA", "var(--purple-600)"], ["var(--lavender-100)", "var(--purple-400)"], ["#EDE6FB", "var(--purple-500)"]];
  function Avatar({ name = "", src, size = 40, ring, variant = "silhouette", style = {} }) {
    const [bg, fg] = PH_TINTS[(name.charCodeAt(0) || 0) % PH_TINTS.length];
    const common = { width: size, height: size, borderRadius: "50%", flex: "none", overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", ...style, boxShadow: ring ? "0 0 0 2.5px var(--white),0 0 0 4px var(--lavender-300)" : style.boxShadow || "none" };
    if (src) return <div style={{ ...common, background: "var(--sand-100)" }}><img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
    if (variant === "initials" && name) return <div style={{ ...common, background: bg, color: fg, fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: size * .36 }}>{initials(name)}</div>;
    return <div style={{ ...common, background: bg }} role="img" aria-label={name ? name + " - no photo yet" : "No photo yet"}><svg width={size * .62} height={size * .62} viewBox="0 0 24 24" fill={fg} aria-hidden="true"><circle cx="12" cy="8.6" r="4" /><path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7z" /></svg></div>;
  }
  function Stack({ people = [], max = 4, size = 30, label }) {
    const sh = people.slice(0, max),ex = people.length - sh.length;
    return <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
    <div style={{ display: "flex", alignItems: "center" }}>
      {sh.map((p, i) => <div key={i} style={{ marginLeft: i ? -size * .34 : 0, zIndex: i, display: "flex" }}><Avatar name={p} size={size} style={{ boxShadow: "0 0 0 2.5px var(--white)" }} /></div>)}
      {ex > 0 && <div style={{ flex: "none", marginLeft: -size * .34, width: size, height: size, borderRadius: "50%", background: "var(--lavender-100)", color: "var(--purple-700)", boxShadow: "0 0 0 2.5px var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: size * .34, lineHeight: 1 }}>+{ex}</div>}
    </div>
    {label && <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>{label}</span>}
  </div>;
  }
  function Tag({ children, selected, dense, onClick, style = {} }) {
    return <span onClick={onClick} className={onClick && !selected ? "ck-tag--select" : ""} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: dense && !selected ? 22 : 24, padding: dense ? "0 8px" : "0 10px", fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 500, lineHeight: 1, borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", boxSizing: "border-box", cursor: onClick ? "pointer" : "default", background: selected ? "var(--purple-600)" : "var(--white)", color: selected ? "var(--cream)" : "var(--ink)", border: "1px solid " + (selected ? "transparent" : "var(--mist-strong)"), ...style }}>{children}</span>;
  }
  /* measured fit-by-width tag row: render only whole tags that fit (with the +N chip reserved),
     collapse the rest into ONE trailing "+N" inside the card padding. Never wrap/scroll/shrink. */
  function FitTags({ tags = [], dense = true, max = Infinity }) {
    const cap = Math.min(max, tags.length);
    const wrapRef = useRef(null);
    const measRef = useRef(null);
    const [count, setCount] = useState(cap);
    React.useLayoutEffect(() => {
      const wrap = wrapRef.current,meas = measRef.current;
      if (!wrap || !meas) return;
      const compute = () => {
        const avail = wrap.clientWidth;
        if (!avail) return;
        const gap = 6;
        const kids = [...meas.children];
        const plusW = kids.length ? kids[kids.length - 1].offsetWidth : 0;
        let used = 0,fit = 0;
        for (let i = 0; i < cap; i++) {
          const w = kids[i].offsetWidth + (i > 0 ? gap : 0);
          const needPlus = cap < tags.length || i < cap - 1;
          const reserve = needPlus ? gap + plusW : 0;
          if (used + w + reserve <= avail) {used += w;fit = i + 1;} else break;
        }
        setCount(Math.max(1, fit));
      };
      compute();
      const ro = new ResizeObserver(compute);
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [tags.join("|"), cap]);
    const overflow = tags.length - count;
    return <div ref={wrapRef} style={{ position: "relative", display: "flex", gap: 6, minWidth: 0, overflow: "hidden", width: "100%" }}>
      {tags.slice(0, count).map((t) => <Tag key={t} dense>{t}</Tag>)}
      {overflow > 0 && <Tag dense style={{ color: "var(--text-muted)" }}>+{overflow}</Tag>}
      <div ref={measRef} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none", display: "flex", gap: 6 }}>
        {tags.map((t) => <Tag key={t} dense>{t}</Tag>)}
        <Tag dense style={{ color: "var(--text-muted)" }}>+{tags.length}</Tag>
      </div>
    </div>;
  }
  /* ---------------- People Card - ONE component across all FOUR surfaces it appears on
     (discovery rows · dashboard rotated card · who-was-there grid · event attendee list).
     ANATOMY IS INVARIANT: avatar LEFT 52 · name + intent grouped tight & INLINE (name ~17 Ink,
     intent ~13 Slate, sentence case - never green, never stacked) · a CONDITIONAL commonality
     line (pin + "You were both at [event]" / overlap-glyph + "Both into [overlap]"; omitted
     cleanly if none) · ≤3 neutral tags (FitTags, one line + "+N") · the stateful click button
     (default → muted "clicked" → Sage "clicked ✨") PAIRED with the quiet "View profile" GHOST.
     ONLY the action LAYOUT + count vary per surface (right column on wide rows, paired bottom
     row on narrow cards); the attendee list drops the click action - clicking is post-event
     only - and opens the profile on a whole-card tap (interestsOnly = no intent/commonality). */
  const VennMark = ({ s = 15 }) => <span style={{ marginTop: 1, flex: "none", display: "inline-flex" }}><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="var(--purple-500)" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></svg></span>;
  /* commonality LINE - a NON-interest axis only, so it never restates the interest tags.
     Priority: shared EVENT → shared MUSIC → (post-mutual only) a light life tag → cluster
     PROXIMITY → omit. Life tags are private until mutual, so pre-mutual cards pass postMutual
     false and never surface them. Interests appear ONLY in the tag row, never here. */
  function commonality(p, postMutual) {
    if (!p) return null;
    if (p.sharedEvent) return { icon: "pin", lead: "You were both at ", term: p.sharedEvent };
    if (p.sharedMusic) return { icon: "music", lead: "Both into ", term: p.sharedMusic };
    if (postMutual && p.commonLife) return { icon: "venn", lead: "", term: p.commonLife };
    if (p.proximity) return { icon: "venn", lead: "", term: p.proximity };
    return null;
  }
  function CommonalityLine({ p, postMutual, style = {} }) {
    const c = commonality(p, postMutual);
    if (!c) return null;
    const glyph = c.icon === "pin" ? <Icon name="pin" size={14} w={1.9} color="var(--purple-500)" style={{ marginTop: 1, flex: "none" }} />
      : c.icon === "music" ? <Icon name="music" size={14} w={1.9} color="var(--purple-500)" style={{ marginTop: 1, flex: "none" }} />
      : <VennMark />;
    return <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.4, ...style }}>
      {glyph}<span>{c.lead}<b style={{ color: "var(--text-strong)", fontWeight: 600 }}>{c.term}</b></span>
    </div>;
  }
  function PeopleCard({ p, web, layout = "row", action = "click", clicked, mutual, postMutual, onClick, onView, onOpen, interestsOnly }) {
    const fn = (p.name || "").split(" ")[0];
    const isMutual = mutual != null ? mutual : !!p.mutual;
    const stacked = layout === "row" && web;     // wide row → actions in a right column
    const tags = (p.tags || []).slice(0, 3);
    const commonalityLine = interestsOnly ? null : <CommonalityLine p={p} postMutual={postMutual} />;

    /* identity pair - name + intent INLINE (baseline, wrap); intent Slate, sentence case */
    const identity = <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis" }}>{fn}</span>
      {action === "none" && isMutual && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: "var(--radius-pill)", background: "color-mix(in srgb,var(--sage) 14%,var(--white))", fontSize: 11, fontWeight: 600, color: "var(--sage)" }}>clicked <Spark size={11} big="var(--sage)" small="var(--sage)" /></span>}
      {!interestsOnly && p.intent && <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.3 }}>{p.intent.charAt(0).toUpperCase() + p.intent.slice(1)}</span>}
    </div>;

    const content = <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
      {identity}
      {commonalityLine}
      {tags.length > 0 && <FitTags tags={tags} />}
    </div>;

    /* actions - the SAME pair everywhere; only the layout adapts to width */
    let actions = null;
    if (action === "click") {
      if (isMutual) actions = <ClickBtn state="mutual" full onView={onView} />;
      else if (stacked) actions = <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <ClickBtn name={fn} state={clicked ? "pending" : "default"} onClick={onClick} full />
        <Btn size="sm" variant="ghost" full onClick={onView}>View profile</Btn>
      </div>;
      else actions = <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}><ClickBtn name={fn} state={clicked ? "pending" : "default"} onClick={onClick} full /></div>
        <Btn size="sm" variant="ghost" onClick={onView}>View profile</Btn>
      </div>;
    }

    const cardBase = { boxSizing: "border-box", background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" };

    /* attendee list - whole card opens the profile modal; no buttons; chevron affordance */
    if (action === "none") return <button onClick={onOpen} aria-label={`View ${fn}'s profile`} style={{ ...cardBase, position: "relative", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 13, padding: "16px 34px 16px 16px", width: "100%", height: "100%" }}>
      <span style={{ position: "absolute", top: 16, right: 13, display: "inline-flex" }}><Icon name="chevR" size={16} w={2} color="var(--text-faint)" /></span>
      <Avatar name={p.name} size={52} />
      {content}
    </button>;

    /* WIDE ROW (discovery / dashboard on web): avatar + content + right action column */
    if (stacked) return <div style={{ ...cardBase, display: "flex", alignItems: "center", gap: 20, padding: "18px 20px" }}>
      <Avatar name={p.name} size={52} />
      {content}
      <div style={{ flex: "none", width: 190 }}>{actions}</div>
    </div>;

    /* NARROW CARD (who-was-there grid / mobile stack): content on top, paired action bottom row */
    return <div style={{ ...cardBase, display: "flex", flexDirection: "column", gap: 12, padding: 17, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, flex: 1, minWidth: 0 }}>
        <Avatar name={p.name} size={52} />
        {content}
      </div>
      {actions}
    </div>;
  }
  function Badge({ children, tone = "onImage", style = {} }) {
    const t = { onImage: { background: "rgba(28,24,48,.62)", color: "#fff" }, coral: { background: "color-mix(in srgb,var(--coral) 12%,var(--white))", color: "var(--coral)" }, amber: { background: "color-mix(in srgb,var(--amber) 16%,var(--white))", color: "#a86f12" }, sage: { background: "color-mix(in srgb,var(--sage) 14%,var(--white))", color: "var(--sage)" }, teal: { background: "color-mix(in srgb,var(--teal) 12%,var(--white))", color: "var(--teal)" }, lavender: { background: "var(--lavender-100)", color: "var(--purple-700)" }, cream: { background: "var(--cream)", color: "var(--text-strong)" } }[tone];
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 8px", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, lineHeight: 1, boxSizing: "border-box", borderRadius: 8, ...t, ...style }}>{children}</span>;
  }
  /* status pill for discovery cards - solid status hue, large-text/badge use only */
  function Status({ kind, style = {} }) {
    const s = STATUS[kind];if (!s) return null;
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: ".01em", lineHeight: 1, borderRadius: "var(--radius-pill)", background: s.hue, color: s.text, boxShadow: "0 2px 8px rgba(25,19,58,.18)", ...style }}>
    {kind === "going" && <Icon name="check" size={13} w={2.6} />}{kind === "free" && <Icon name="check" size={13} w={2.6} />}{s.label}
  </span>;
  }
  function IntentLine({ yourIntent = "friends", theirIntent, onPurple, style = {} }) {
    const eq = !theirIntent || theirIntent === yourIntent;
    const skin = onPurple ? { background: "rgba(253,250,246,.16)", color: "var(--cream)", bold: "var(--cream)" } : { background: "var(--lavender-100)", color: "var(--text-body)", bold: "var(--purple-700)" };
    return <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.45, color: skin.color, display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 15px", background: skin.background, borderRadius: "var(--radius-pill)", ...style }}>
    <span aria-hidden="true">✨</span>{eq ? <span>You're both here for <b style={{ color: skin.bold, fontWeight: 700 }}>{yourIntent}</b>.</span> : <span>You're here for <b style={{ color: skin.bold, fontWeight: 700 }}>{yourIntent}</b> · they're open to <b style={{ color: skin.bold, fontWeight: 700 }}>{theirIntent}</b>.</span>}
  </p>;
  }

  /* ---------------- cover - warm-graded activity ART (photography stand-in: real venues
     have no faces; warm tonal grade unifies every surface). Fills the frame edge-to-edge;
     replaces the old grey placeholder. Used site-wide (cards, hero, strips). ---------------- */
  const WC = { w0: "#F6E7D2", w1: "#ECD0AC", w2: "#E0AE7E", w3: "#CF8B57", w4: "#B0683B", w5: "#834A2B", w6: "#4E2C1A", gold: "#F4C56B", cream: "#F9F6F0", sage: "#93A98C", sage2: "#7E9B78", slate: "#7E93A8" };
  function Scene({ category, uid }) {
    const S = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" };
    const slice = "xMidYMid slice";
    const svg = (kids, bg) => <svg style={S} viewBox="0 0 400 280" preserveAspectRatio={slice}><rect width="400" height="280" fill={bg} />{kids}</svg>;
    const runner = (x, y, s, i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`} stroke={WC.w6} strokeWidth="3.4" strokeLinecap="round" fill="none">
      <circle cx="0" cy="-17" r="4.2" fill={WC.w6} stroke="none" /><path d="M0 -13 q5 7 2 15" /><path d="M2 2 l9 9 M2 2 l-8 10" /><path d="M0 -8 l-9 4 M0 -8 l10 2" /></g>;
    switch (category) {
      case "ceramics":return svg(<g>
        <rect y="170" width="400" height="110" fill={WC.w3} /><rect x="18" y="18" width="150" height="120" rx="8" fill={WC.gold} opacity=".42" />
        <ellipse cx="200" cy="206" rx="122" ry="26" fill={WC.w5} /><ellipse cx="200" cy="198" rx="122" ry="22" fill="#9C5A33" />
        <path d="M168 200 q-6 -42 14 -72 q18 -22 36 0 q20 30 14 72 z" fill={WC.w4} /><path d="M183 200 q-4 -36 8 -64 q8 -16 17 -2 q4 18 2 66 z" fill={WC.w2} />
        <ellipse cx="200" cy="130" rx="22" ry="7" fill={WC.w2} />
        <path d="M150 150 q24 -10 41 6 q-6 18 -29 16 q-18 -2 -12 -22z" fill="#7A4327" /><path d="M250 150 q-24 -10 -41 6 q6 18 29 16 q18 -2 12 -22z" fill="#683921" />
        <circle cx="120" cy="232" r="3" fill={WC.w5} /><circle cx="300" cy="224" r="2.5" fill={WC.w5} /></g>, "#E6C49B");
      case "workshops":return svg(<g>
        <rect y="190" width="400" height="90" fill="#B97C4C" /><rect x="20" y="18" width="120" height="92" rx="8" fill={WC.gold} opacity=".4" />
        <path d="M150 92 q50 -14 100 0 v68 q0 50 -50 56 q-50 -6 -50 -56z" fill={WC.cream} opacity=".4" />
        <path d="M152 150 h96 v8 q0 46 -48 52 q-48 -6 -48 -52z" fill="#8A5A33" /><rect x="158" y="150" width="84" height="10" fill="#C99A66" />
        <path d="M152 168 q48 14 96 0 q0 36 -48 40 q-48 -4 -48 -40z" fill={WC.sage} />
        <path d="M150 92 q50 -14 100 0 v68 q0 50 -50 56 q-50 -6 -50 -56z" fill="none" stroke={WC.w0} strokeWidth="3" opacity=".7" />
        <path d="M200 96 q-10 -34 6 -56" stroke="#6F8A6A" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="198" cy="50" rx="10" ry="5" fill={WC.sage2} transform="rotate(-30 198 50)" /><ellipse cx="214" cy="58" rx="9" ry="4.5" fill={WC.sage} transform="rotate(20 214 58)" />
        <path d="M250 122 q42 -6 56 18 q-10 16 -35 10 q-23 -6 -21 -28z" fill="#7A4327" /></g>, "#E3C49E");
      case "wine":return svg(<g>
        <rect y="200" width="400" height="80" fill="#3E2418" /><rect y="186" width="400" height="16" fill="#7A4A2E" />
        <ellipse cx="200" cy="26" rx="130" ry="52" fill={WC.gold} opacity=".26" />
        {[64, 148, 238, 322].map((x, i) => <g key={i}><path d={`M${x - 26} 100 Q${x} 152 ${x + 26} 100 Z`} fill="#F2D9A6" opacity=".92" /><path d={`M${x - 20} 104 Q${x} 140 ${x + 20} 104 Z`} fill={WC.gold} /><rect x={x - 2} y="150" width="4" height="24" fill="#E8CFA0" /><rect x={x - 13} y="174" width="26" height="5" rx="2" fill="#E8CFA0" /><circle cx={x + 11} cy="100" r="4" fill={WC.sage} /></g>)}
        <path d="M238 42 q5 30 0 56" stroke={WC.w0} strokeWidth="3" opacity=".7" fill="none" /></g>, "#5E3A28");
      case "run":return svg(<g>
        <defs><linearGradient id={uid + "sky"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F6E7D2" /><stop offset=".55" stopColor="#F4C56B" /><stop offset="1" stopColor="#E0A06A" /></linearGradient></defs>
        <rect width="400" height="280" fill={`url(#${uid}sky)`} /><circle cx="298" cy="118" r="46" fill="#FBE3A0" opacity=".85" />
        <ellipse cx="58" cy="150" rx="34" ry="44" fill="#9A6B40" opacity=".55" /><ellipse cx="108" cy="160" rx="28" ry="36" fill="#7E4E2C" opacity=".5" />
        <path d="M0 208 q200 -30 400 6 v66 H0z" fill="#C98A55" /><path d="M0 248 q200 -20 400 8 v24 H0z" fill="#A86B3C" />
        {[[150, 196, 1], [198, 202, 1.1], [240, 198, .9]].map(([x, y, s], i) => runner(x, y, s, i))}</g>, "#F4C56B");
      case "art":return svg(<g>
        <defs><radialGradient id={uid + "f"} cx=".62" cy=".52" r=".55"><stop offset="0" stopColor="#FFD98A" /><stop offset=".5" stopColor="#F4A24C" stopOpacity=".65" /><stop offset="1" stopColor="#3A2014" stopOpacity="0" /></radialGradient></defs>
        <rect width="400" height="280" fill={`url(#${uid}f)`} /><ellipse cx="250" cy="150" rx="42" ry="46" fill="#F49A3C" opacity=".45" />
        <rect x="40" y="150" width="222" height="7" rx="3.5" fill="#6E4A30" transform="rotate(-6 150 153)" />
        <ellipse cx="252" cy="136" rx="20" ry="24" fill="#F6B84E" /><ellipse cx="252" cy="136" rx="11" ry="15" fill="#FFE39C" />
        <path d="M20 160 q42 -8 72 0 q-2 16 -37 16 q-35 0 -35 -16z" fill="#2A170D" />
        <circle cx="282" cy="108" r="2" fill="#FFE39C" /><circle cx="298" cy="128" r="1.6" fill="#FFD98A" /></g>, "#3A2014");
      case "cooking":return svg(<g>
        <rect y="120" width="400" height="160" fill="#CE9A66" /><rect x="20" y="14" width="120" height="70" rx="8" fill={WC.gold} opacity=".34" />
        {[60, 150, 250, 330].map((x, i) => <circle key={i} cx={x} cy={150 + i % 2 * 40} r="2.4" fill={WC.w0} opacity=".7" />)}
        <rect x="60" y="86" width="180" height="18" rx="9" fill="#B97C4C" /><rect x="44" y="90" width="20" height="10" rx="5" fill="#9A6336" /><rect x="236" y="90" width="20" height="10" rx="5" fill="#9A6336" />
        {[120, 210, 292].map((x, i) => <g key={i}><ellipse cx={x} cy="182" rx="34" ry="17" fill="#E7B86A" /><path d={`M${x - 26} 180 q26 -14 52 0 M${x - 22} 186 q22 -10 44 0 M${x - 24} 174 q24 -12 48 0`} stroke="#D89B4E" strokeWidth="2.6" fill="none" /></g>)}
        <path d="M332 150 q6 -20 -2 -34" stroke="#6F8A6A" strokeWidth="3" fill="none" /><ellipse cx="326" cy="112" rx="8" ry="4" fill={WC.sage} transform="rotate(-26 326 112)" /></g>, "#E7C8A0");
      default:return svg(<g>
        <rect y="180" width="400" height="100" fill="#C68C58" /><rect x="24" y="20" width="130" height="100" rx="8" fill={WC.gold} opacity=".38" />
        <ellipse cx="150" cy="190" rx="34" ry="12" fill="#7E4A2C" /><path d="M120 150 h60 v18 q0 22 -30 24 q-30 -2 -30 -24z" fill="#F2DDBE" /><path d="M126 156 q24 8 48 0 q0 16 -24 18 q-24 -2 -24 -18z" fill="#8A5A36" /><path d="M180 156 q22 0 22 16 q0 14 -22 14" fill="none" stroke="#F2DDBE" strokeWidth="6" />
        <path d="M150 132 q6 -8 0 -16" stroke="#F2DDBE" strokeWidth="2.4" fill="none" opacity=".6" />
        <rect x="250" y="150" width="40" height="36" rx="6" fill="#9A6336" /><path d="M270 150 q-8 -26 4 -42" stroke="#6F8A6A" strokeWidth="4" fill="none" /><ellipse cx="266" cy="106" rx="9" ry="4.5" fill={WC.sage} transform="rotate(-28 266 106)" /><ellipse cx="282" cy="116" rx="8" ry="4" fill={WC.sage2} transform="rotate(22 282 116)" /></g>, "#E6C6A0");
    }
  }
  let _coverN = 0;
  /* tone: optional warm-graded wash variant so a set of Covers (e.g. a profile photo grid)
     reads with tonal VARIETY instead of one uniform brown wall. Omit = the canonical warm wash. */
  const COVER_WASH = {
    warm:   ["#E6C49B", "linear-gradient(158deg,rgba(244,196,107,.10),rgba(110,58,30,.20))"],
    bright: ["#EBD3A6", "linear-gradient(158deg,rgba(255,216,146,.12),rgba(150,92,40,.13))"],
    cool:   ["#B6C6D6", "linear-gradient(158deg,rgba(150,178,205,.13),rgba(46,62,92,.20))"],
    dusk:   ["#D8B4C6", "linear-gradient(158deg,rgba(214,150,182,.11),rgba(72,40,82,.20))"]
  };
  function Cover({ category, h = 180, aspect, children, dim, radius = 0, photo, tone }) {
    const [baseBg, washBg] = COVER_WASH[tone] || COVER_WASH.warm;
    const idRef = useRef(null);
    if (idRef.current === null) idRef.current = "cv" + ++_coverN;
    const box = aspect ? { position: "relative", width: "100%", aspectRatio: String(aspect), overflow: "hidden", borderRadius: radius, background: baseBg } :
    { position: "relative", height: h, overflow: "hidden", borderRadius: radius, background: baseBg };
    return <div style={box}>
    <Scene category={category} uid={idRef.current} />
    {/* warm-grade wash + soft vignette so every scene reads as one warm-graded photo set */}
    <span style={{ position: "absolute", inset: 0, background: washBg }} />
    <span style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 58px rgba(48,24,10,.26)" }} />
    {dim && <span style={{ position: "absolute", inset: 0, background: "rgba(25,19,58,.42)" }} />}
    {children}
  </div>;
  }

  /* ---------------- site footer - small, global; same on every page (marketing + app) ----------------
     LOCKED: EXACTLY 2 rows, NO tagline. Row 1 = wordmark + essential links. Row 2 = copyright + social + email. */
  function SiteFooter({ web, onNav = () => {} }) {
    const links = [["Discover", "discover"], ["How it works", "howitworks"], ["Host an event", "merchant"], ["Merchant", "merchant"], ["Help", null], ["Privacy", null], ["Terms", null]];
    const Link = ({ label, k }) => {
      const [h, setH] = useState(false);
      return <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={() => k && onNav(k)}
      style={{ border: "none", background: "none", padding: "8px 2px", margin: "-8px -2px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: web ? 13 : 11.5, fontWeight: 500, color: h ? "var(--purple-700)" : "var(--text-muted)", transition: "color .15s", whiteSpace: "nowrap" }}>{label}</button>;
    };
    const dot = <span style={{ color: "var(--text-faint)", fontSize: web ? 12 : 10.5 }} aria-hidden="true">·</span>;
    /* monochrome line social icons - Slate → Deep-Purple on hover; aria-labelled link, aria-hidden glyph */
    const Social = ({ label, href, children }) => {
      const [h, setH] = useState(false);
      return <a href={href} aria-label={label} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: web ? 28 : 24, height: web ? 28 : 24, color: h ? "var(--purple-700)" : "var(--text-muted)", transition: "color .15s" }}>{children}</a>;
    };
    return <footer style={{ flex: "none", background: "var(--cream)", borderTop: "1px solid var(--border-soft)", padding: web ? "16px 40px 0px" : "12px 16px 6px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", display: "flex", flexDirection: "column", gap: web ? 10 : 6 }}>
        {/* ROW 1 - wordmark left + essential links right */}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: web ? 16 : 8 }}>
          <Logo size={web ? 22 : 18} />
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: web ? 14 : 7, rowGap: web ? 6 : 3, justifyContent: "flex-end", flex: 1, minWidth: 0 }}>
            {links.map(([label, k], i) => <React.Fragment key={label}>{i > 0 && dot}<Link label={label} k={k} /></React.Fragment>)}
          </div>
        </div>
        {/* ROW 2 - copyright left + social/email right */}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: web ? 8 : 8, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: web ? 12.5 : 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>© 2026 Click · Made in Sydney</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: web ? 6 : 3, fontSize: web ? 12.5 : 11, color: "var(--text-faint)" }}>
            <Social label="Click on Instagram" href="https://instagram.com">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg>
            </Social>
            <Social label="Click on Threads" href="https://threads.net">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.5 11.2c-.2-3.1-2-4.7-4.6-4.7-2.4 0-4.3 1.5-4.3 3.8 0 2 1.5 3.3 3.6 3.3 2.4 0 3.6-1.6 3.6-3.9 0-2.9-1.9-4.2-3.6-4.2" transform="translate(0 .3)" /><path d="M12 21c-4.4 0-7-2.9-7-9s2.6-9 7-9c3.5 0 5.7 1.8 6.6 4.5" /><path d="M9.3 13.2c.6 1.2 1.8 1.6 3 1.5 2-.2 3-1.6 2.8-4" /></svg>
            </Social>
            <a href="mailto:hello@click.au" style={{ marginLeft: web ? 6 : 2, color: "var(--text-faint)", textDecoration: "none", fontSize: web ? 12.5 : 11 }}>hello@click.au</a>
          </span>
        </div>
      </div>
    </footer>;
  }

  window.CK = { useState, useEffect, useRef, CAT, STATUS, PALETTES, initials, LAV, Icon, Logo, Spark, Cmark, AppTile, Btn, Field, Toggle, Avatar, Stack, Tag, FitTags, Badge, Status, ClickBtn, IntentLine, Cover, PeopleCard, commonality, CommonalityLine, SiteFooter };

})();