(function () {
  /* Click - loading SKELETONS ("shadow" pages). One per real screen, matching its layout so the
     load feels like the page settling in, not a spinner. Calm shimmer (pulse + a soft sweep),
     lavender-tinted blocks on cream; no spinners, no full-screen blockers. window.ScreensSkel. */
  const { useState } = window.CK;
  const SK = "color-mix(in srgb,var(--purple-600) 9%,var(--cream))";
  const SK2 = "color-mix(in srgb,var(--purple-600) 14%,var(--cream))";

  /* a single placeholder block; circle when r==="50%" */
  function B({ w = "100%", h = 12, r = 10, mb = 0, mt = 0, style = {} }) {
    return <div style={{ width: w, height: h, borderRadius: r, background: SK, marginBottom: mb, marginTop: mt, flex: "none", ...style }} />;
  }
  function Wrap({ web, children, max = 960, pad }) {
    return <div style={{ maxWidth: web ? max : "none", margin: "0 auto", padding: pad || (web ? "8px 40px 48px" : "6px 22px 28px") }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ckSkPulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes ckSkSweep{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}@media (prefers-reduced-motion: reduce){.ckSk{animation:none!important}.ckSk-sweep{display:none!important}}" }} />
      <div className="ckSk" style={{ animation: "ckSkPulse 1.5s ease-in-out infinite" }}>{children}</div>
    </div>;
  }
  /* an event card shell (matches EventCard: 16:9 + grouped body + pinned footer) */
  function CardSk() {
    return <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-soft)", overflow: "hidden", position: "relative" }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: SK2 }} />
      <div style={{ padding: "16px 16px 16px" }}>
        <B w="38%" h={10} mb={12} />
        <B w="88%" h={16} mb={7} /><B w="64%" h={16} mb={12} />
        <B w="52%" h={11} mb={14} />
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}><B w={54} h={20} r={999} /><B w={46} h={20} r={999} /><B w={62} h={20} r={999} /></div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}><B w={48} h={16} /><B w={84} h={34} r={12} /></div>
      </div>
    </div>;
  }
  /* the 375 MINI card shell (2-up; banner + date + title + suburb + price - no CTA/tags, per TEMPLATE §1b) */
  function MiniCardSk() {
    return <div style={{ background: "var(--white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-soft)", overflow: "hidden" }}>
      <div style={{ width: "100%", aspectRatio: "16/9", background: SK2 }} />
      <div style={{ padding: "10px 11px 12px" }}>
        <B w="48%" h={9} mb={8} />
        <B w="92%" h={13} mb={6} /><B w="66%" h={13} mb={9} />
        <B w="55%" h={10} mb={9} />
        <B w="42%" h={11} />
      </div>
    </div>;
  }
  function Grid({ web, n = 3 }) {
    if (!web) return <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>{Array.from({ length: Math.max(n, 2) * 2 }).map((_, i) => <MiniCardSk key={i} />)}</div>;
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 22 }}>{Array.from({ length: n }).map((_, i) => <CardSk key={i} />)}</div>;
  }
  /* people-card shell (matches PeopleCard: avatar-left row + bottom action pair on narrow) */
  function PersonRowSk({ web }) {
    return <div style={{ display: "flex", flexDirection: web ? "row" : "column", alignItems: web ? "center" : "stretch", gap: web ? 16 : 12, background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", padding: web ? "16px 18px" : "14px 15px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: web ? 16 : 13, flex: 1, minWidth: 0 }}>
        <B w={52} h={52} r="50%" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <B w="34%" h={15} mb={9} /><B w="56%" h={11} mb={10} />
          <div style={{ display: "flex", gap: 6 }}><B w={56} h={20} r={999} /><B w={48} h={20} r={999} /><B w={40} h={20} r={999} /></div>
        </div>
      </div>
      {web ? <B w={96} h={36} r={12} /> : <div style={{ display: "flex", gap: 8 }}><B w="58%" h={40} r={12} style={{ flex: 1 }} /><B w={92} h={40} r={12} /></div>}
    </div>;
  }
  const SectionHead = ({ web }) => <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: web ? 18 : 14 }}><B w={180} h={20} /><B w={70} h={13} /></div>;

  /* ---------------- DASHBOARD ---------------- */
  function Dashboard({ web }) {
    return <Wrap web={web} max={1060}>
      <B w={web ? 180 : "36%"} h={12} mb={10} /><B w={web ? 320 : "70%"} h={web ? 30 : 24} r={12} mb={web ? 26 : 18} />
      {/* moment-banner zone - wash blocks capped at the ~760 content measure */}
      <div style={{ maxWidth: web ? 760 : "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: web ? 36 : 24 }}>
        {Array.from({ length: 2 }).map((_, i) => <div key={i} style={{ background: "var(--lavender-wash)", border: "1px solid var(--lavender-300)", borderRadius: 16, padding: web ? "16px 18px" : "14px 15px", display: "flex", alignItems: "center", gap: 14 }}><B w={40} h={40} r="50%" style={{ background: SK2 }} /><div style={{ flex: 1, minWidth: 0 }}><B w="30%" h={9} mb={8} style={{ background: SK2 }} /><B w="64%" h={14} style={{ background: SK2 }} /></div>{web && <B w={132} h={38} r={12} style={{ background: SK2 }} />}</div>)}
      </div>
      <SectionHead web={web} /><Grid web={web} n={web ? 3 : 1} />
      <div style={{ height: web ? 52 : 24 }} />
      <SectionHead web={web} />
      <div style={{ maxWidth: web ? 760 : "none" }}><PersonRowSk web={web} /></div>
    </Wrap>;
  }

  /* ---------------- DISCOVER ---------------- */
  function Discover({ web }) {
    return <Wrap web={web} max={1180}>
      <B w={web ? 360 : "62%"} h={web ? 30 : 24} r={12} mb={10} /><B w={web ? 300 : "80%"} h={13} mb={16} />
      <B w="100%" h={48} r={999} mb={16} />
      <div style={{ display: "flex", gap: web ? 10 : 8, marginBottom: 18, overflow: "hidden" }}>{Array.from({ length: web ? 9 : 6 }).map((_, i) => <div key={i} style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}><B w={web ? 56 : 48} h={web ? 56 : 48} r="50%" /><B w={web ? 44 : 38} h={9} /></div>)}</div>
      <div style={{ display: web ? "grid" : "block", gridTemplateColumns: web ? "260px minmax(0,1fr)" : "none", gap: 36, alignItems: "start" }}>
        {web && <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", background: "var(--white)", padding: 18 }}>{Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ marginBottom: 22 }}><B w="50%" h={11} mb={12} /><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{Array.from({ length: 5 }).map((_, j) => <B key={j} w={66} h={28} r={999} />)}</div></div>)}</div>}
        <Grid web={web} n={web ? 6 : 3} />
      </div>
    </Wrap>;
  }

  /* ---------------- EVENT DETAIL ---------------- */
  function EventDetail({ web }) {
    const Content = () => <div style={{ minWidth: 0 }}>
      <B w="100%" h={0} style={{ aspectRatio: "16/9", height: "auto" }} r={16} mb={20} />
      <B w="40%" h={12} mb={12} /><B w="86%" h={28} r={12} mb={10} /><B w="60%" h={28} r={12} mb={18} />
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}><B w={64} h={26} r={999} /><B w={52} h={26} r={999} /><B w={72} h={26} r={999} /></div>
      <B w="30%" h={14} mb={12} /><B w="100%" h={12} mb={8} /><B w="100%" h={12} mb={8} /><B w="80%" h={12} mb={26} />
      <B w="32%" h={18} mb={14} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ display: "flex", gap: 12, padding: 14, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", background: "var(--white)" }}><B w={44} h={44} r="50%" /><div style={{ flex: 1 }}><B w="60%" h={13} mb={8} /><B w="80%" h={10} /></div></div>)}</div>
    </div>;
    const PanelSk = () => <div style={{ background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)", padding: "20px 20px 22px" }}>
      <B w={120} h={26} r={10} mb={16} />
      <B w="100%" h={44} r={12} mb={12} /><B w="70%" h={12} mb={18} />
      <B w="100%" h={50} r={12} mb={12} />
      <div style={{ display: "flex", gap: 8 }}><B w="50%" h={42} r={12} /><B w="50%" h={42} r={12} /></div>
    </div>;
    if (!web) return <Wrap web={web} pad="6px 22px 28px"><Content /><div style={{ marginTop: 22 }}><PanelSk /></div></Wrap>;
    return <Wrap web={web} max={1180}><div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 372px", gap: 36, alignItems: "start" }}><Content /><div style={{ position: "sticky", top: 24 }}><PanelSk /></div></div></Wrap>;
  }

  /* ---------------- PROFILE ---------------- */
  function Profile({ web }) {
    return <Wrap web={web} max={660}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0 8px" }}><B w={68} h={68} r="50%" /><div style={{ flex: 1 }}><B w={90} h={10} mb={10} /><B w="46%" h={22} r={10} mb={8} /><B w="62%" h={13} /></div><B w={104} h={36} r={12} /></div>
      <div style={{ height: 1, background: "var(--border-soft)", margin: "18px 0 24px" }} />
      {["Bio", "Here for", "Into", "Photos"].map((s, i) => <div key={i} style={{ marginBottom: 26 }}>
        <B w={70} h={11} mb={12} />
        {s === "Photos"
          ? <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(5,1fr)" : "repeat(3,1fr)", gap: 10 }}>{Array.from({ length: web ? 5 : 3 }).map((_, j) => <div key={j} style={{ aspectRatio: "1", borderRadius: "var(--radius-md)", background: SK }} />)}</div>
          : s === "Bio"
            ? <div><B w="100%" h={12} mb={8} /><B w="74%" h={12} /></div>
            : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{Array.from({ length: s === "Into" ? 6 : 2 }).map((_, j) => <B key={j} w={s === "Into" ? 78 : 120} h={28} r={999} />)}</div>}
      </div>)}
    </Wrap>;
  }

  /* ---------------- MY EVENTS ---------------- */
  function MyEvents({ web }) {
    return <Wrap web={web} max={960}>
      <B w={web ? 220 : "55%"} h={web ? 28 : 23} r={12} mb={8} /><B w={web ? 320 : "78%"} h={13} mb={20} />
      <div style={{ display: "flex", gap: 18, marginBottom: 22, borderBottom: "1px solid var(--border-soft)", paddingBottom: 12 }}>{["Upcoming", "Waitlist", "Saved", "Past"].map((_, i) => <B key={i} w={74} h={14} />)}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ display: "flex", gap: 15, background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", padding: 14, boxShadow: "var(--shadow-sm)" }}><B w={96} h={72} r={12} /><div style={{ flex: 1 }}><B w={70} h={20} r={999} mb={10} /><B w="60%" h={15} mb={8} /><B w="44%" h={11} /></div><B w={84} h={34} r={12} /></div>)}</div>
    </Wrap>;
  }

  /* ---------------- YOUR CLICKS (people) ---------------- */
  function Clicks({ web }) {
    return <Wrap web={web} max={720}>
      <B w={web ? 280 : "60%"} h={web ? 26 : 22} r={12} mb={10} /><B w="80%" h={13} mb={22} />
      <B w={300} h={18} mb={14} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 26 }}>{Array.from({ length: 3 }).map((_, i) => <PersonRowSk key={i} web={web} />)}</div>
      <div style={{ height: 1, background: "var(--border-soft)", margin: "0 0 24px" }} />
      <B w={140} h={18} mb={14} />
      <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", background: "var(--cream)", padding: "15px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}><B w={32} h={32} r="50%" /><B w="64%" h={13} /><div style={{ flex: 1 }} /><B w={16} h={16} r="50%" /></div>
      <B w={120} h={20} mb={16} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{Array.from({ length: 2 }).map((_, i) => <PersonRowSk key={i} web={web} />)}</div>
    </Wrap>;
  }

  /* ---------------- WHO WAS THERE (post-event) - canonical PeopleCard grid, 2-up web / 1-up mobile */
  function WhoWasThere({ web }) {
    return <Wrap web={web} max={860}>
      <B w={200} h={11} mb={14} />
      <B w={web ? 480 : "78%"} h={web ? 30 : 24} r={12} mb={10} /><B w={web ? 360 : "66%"} h={13} mb={10} /><B w={web ? 300 : "80%"} h={12} mb={26} />
      <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(2,1fr)" : "1fr", gap: web ? 16 : 12 }}>{Array.from({ length: web ? 6 : 4 }).map((_, i) => <div key={i} style={{ background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 14 }}>
          <B w={52} h={52} r="50%" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <B w="46%" h={14} mb={8} /><B w="64%" h={11} mb={10} />
            <div style={{ display: "flex", gap: 6 }}><B w={48} h={18} r={999} /><B w={40} h={18} r={999} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}><B w="58%" h={40} r={12} style={{ flex: 1 }} /><B w={92} h={40} r={12} /></div>
      </div>)}</div>
    </Wrap>;
  }

  const MAP = { dashboard: Dashboard, discover: Discover, event: EventDetail, profile: Profile, myevents: MyEvents, clicks: Clicks, window: WhoWasThere };
  function Skeleton({ web, kind }) {
    const C = MAP[kind] || Dashboard;
    return <C web={web} />;
  }

  window.ScreensSkel = { Skeleton, MAP };
})();
