(function () {
  /* Click - How it works (/how-it-works). Web v8 - the SLIM pass.
     Same philosophy spine ("Show up. Everything else is a bonus."; proximity effect;
     the click is a by-product, quiet until mutual; no chat; friends-first) - but
     straight to the point: 7 short sections, one idea each, no paragraph over ~3 lines.
     Adds a slim FOR HOSTS band so merchants get the concept too. Exactly ONE ✨.
     Hyphens, not em-dashes. Inline styles. */
  const { Icon, Logo, Btn, Cover } = window.CK;

  function Eyebrow({ children }) {
    return <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--purple-500)" }}>{children}</p>;
  }

  function HowItWorks({ web, enter, founding }) {
    const C = web ? "var(--container-max)" : "none";
    const H2 = { margin: "0 0 14px", fontFamily: "var(--font-display)", fontSize: "clamp(1.45rem, 1.1rem + 1.5cqi, 2.2rem)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.12, color: "var(--text-strong)", textWrap: "balance" };
    const BODY = { margin: 0, fontSize: web ? 17 : 15.5, lineHeight: 1.6, color: "var(--text-body)" };
    const STEPS = [
      ["compass", "Pick something good", "Pottery in Newtown, a sunrise run, a wine-bar quiz. Real places, near you, this week."],
      ["calendar", "Show up", "You connect side by side, not face to face - and everyone in the room chose the same thing you did."],
      ["users", "That's it", "Great night, thing you love, maybe someone you click with. Show up, and everything else is a bonus."]
    ];
    const INTENTS = ["Here for the activities", "Here for friends", "New in town", "Growing my circle", "Not here to date", "Open to dating"];
    return <div style={{ minHeight: "100%", background: "var(--cream)", fontFamily: "var(--font-sans)", color: "var(--text-strong)" }}>
      {/* top bar - minimal marketing header */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: web ? "16px 40px" : "14px 22px", background: "color-mix(in srgb,var(--cream) 88%,transparent)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border-soft)" }}>
        <span onClick={enter} style={{ cursor: "pointer" }}><Logo size={web ? 26 : 23} /></span>
        <Btn size="sm" onClick={enter}>Request an invite</Btn>
      </div>

      {/* 1 · HERO */}
      <section style={{ maxWidth: C, margin: "0 auto", padding: web ? "clamp(40px,6cqi,76px) 40px 54px" : "36px 22px 42px" }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: web ? "clamp(32px,5cqi,56px)" : "30px", fontWeight: 600, letterSpacing: "-.025em", lineHeight: 1.06, color: "var(--text-strong)", textWrap: "balance", maxWidth: 660 }}>The best people you'll meet this year aren't on an app. They're across the room.</h1>
          <p style={{ margin: "18px 0 0", fontSize: web ? 19 : 16.5, lineHeight: 1.55, color: "var(--text-body)", maxWidth: 540 }}>Click gets you out doing things you love, in real life. The people you'll click with are already there.</p>
          <div style={{ marginTop: 26 }}><Btn size="lg" onClick={enter}>Request an invite</Btn></div>
        </div>
      </section>

      {/* 2 · HOW IT WORKS - three steps, thesis in one line */}
      <section style={{ background: "var(--surface-section)" }}>
        <div style={{ maxWidth: C, margin: "0 auto", padding: web ? "64px 40px" : "44px 22px" }}>
          <Eyebrow>How it works</Eyebrow>
          <h2 style={H2}>You don't click with a profile. You click in person.</h2>
          <p style={{ ...BODY, maxWidth: 620 }}>Your closest people probably started as the person who kept showing up to the same thing you did. Psychologists call it the proximity effect. Click just rebuilds the rooms where it happens.</p>
          <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr", gap: web ? 36 : 28, marginTop: 36 }}>
            {STEPS.map(([ic, t, d], i) => <div key={t}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 13 }}>
                <span style={{ flex: "none", width: 48, height: 48, borderRadius: "50%", background: "color-mix(in srgb,var(--lavender-300) 22%,var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={ic} size={22} w={1.9} color="var(--purple-600)" /></span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 600, color: "color-mix(in srgb,var(--purple-400) 60%,var(--cream))" }}>{i + 1}</span>
              </div>
              <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-.01em", lineHeight: 1.2, color: "var(--text-strong)" }}>{t}</h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.58, color: "var(--text-body)" }}>{d}</p>
            </div>)}
          </div>
        </div>
      </section>

      {/* 3 · THE CLICK - tease, never explain */}
      <section style={{ maxWidth: C, margin: "0 auto", padding: web ? "72px 40px" : "48px 22px", display: web ? "grid" : "block", gridTemplateColumns: web ? "1fr 1fr" : "none", gap: web ? 60 : 0, alignItems: "center" }}>
        <div>
          <Eyebrow>The bonus</Eyebrow>
          <h2 style={{ ...H2, fontSize: web ? "clamp(28px,4cqi,46px)" : "1.85rem", letterSpacing: "-.025em", lineHeight: 1.08 }}>And every so often, you just click with someone.</h2>
          <p style={{ ...BODY, marginBottom: 14 }}>Same event, same odd sense of humour, same reason for being there. Let Click know, quietly - if it's mutual, we suggest the next thing to do together.</p>
          <p style={BODY}>A new friend, a regular crew, sometimes something more. It all works the same.</p>
        </div>
        {web && <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Cover category="run" aspect="16/9" photo="runners at dawn setting off, warm light" radius={18} />
          {[["Did you click with anyone?", "A quiet question after the event.", "lavender"], ["It's mutual ✨", "The good part: you both clicked.", "white"]].map(([t, d, bg], i) => <div key={i} style={{ background: bg === "lavender" ? "var(--lavender-100)" : "var(--white)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-xl)", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
            <h4 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 600, color: "var(--purple-800)" }}>{t}</h4>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-body)" }}>{d}</p>
          </div>)}
        </div>}
      </section>

      {/* 4 · ON PURPOSE - what we left out + why it stays calm, one section */}
      <section style={{ background: "var(--surface-section)" }}>
        <div style={{ maxWidth: C, margin: "0 auto", padding: web ? "64px 40px" : "44px 22px" }}>
          <div style={{ maxWidth: 640 }}>
            <Eyebrow>On purpose</Eyebrow>
            <h2 style={H2}>No swiping. No endless chat. Just real life.</h2>
            <p style={BODY}>When two people click, Click suggests something to do next - the plan <i>is</i> the conversation. The magic was never in the app; it's in the room. We set the conditions, then get out of the way.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: web ? "repeat(3,1fr)" : "1fr", gap: web ? 28 : 18, marginTop: 32 }}>
            {[["check", "Only verified venues", "Every event is a real place run by real people."], ["user", "You're in control", "What you do, who you click with, whether you're visible at all."], ["compass", "Clicks are rare on purpose", "No feed of faces to scroll. That's what makes one feel real."]].map(([ic, t, d]) => <div key={t} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
              <span style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "color-mix(in srgb,var(--lavender-300) 22%,var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={ic} size={19} w={1.9} color="var(--purple-600)" /></span>
              <div>
                <h3 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 600, color: "var(--text-strong)" }}>{t}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--text-body)" }}>{d}</p>
              </div>
            </div>)}
          </div>
        </div>
      </section>

      {/* 5 · COME AS YOU ARE - intents as quiet chips */}
      <section style={{ maxWidth: C, margin: "0 auto", padding: web ? "64px 40px" : "44px 22px" }}>
        <div style={{ maxWidth: 640 }}>
          <Eyebrow>Whatever you're here for</Eyebrow>
          <h2 style={H2}>Come as you are.</h2>
          <p style={{ ...BODY, color: "var(--text-muted)", marginBottom: 22 }}>Friendship, community, romance - equal footing. Pick what fits, or don't, and just show up.</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, maxWidth: 720 }}>
          {INTENTS.map((t) => <span key={t} style={{ display: "inline-flex", alignItems: "center", padding: "9px 16px", borderRadius: "var(--radius-pill)", background: "var(--white)", border: "1px solid var(--border-mid)", fontFamily: "var(--font-display)", fontSize: web ? 14.5 : 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{t}</span>)}
        </div>
      </section>

      {/* 6 · FOR HOSTS - merchants get the concept in four lines */}
      <section style={{ background: "var(--surface-section)" }}>
        <div style={{ maxWidth: C, margin: "0 auto", padding: web ? "60px 40px" : "42px 22px", display: web ? "grid" : "block", gridTemplateColumns: web ? "1.1fr .9fr" : "none", gap: web ? 56 : 0, alignItems: "center" }}>
          <div>
            <Eyebrow>For hosts</Eyebrow>
            <h2 style={H2}>You bring the room. We fill it.</h2>
            <p style={{ ...BODY, marginBottom: 12 }}>Run a studio, a bar, a run club? List your events on Click and meet a crowd that actually shows up - people who picked your thing on purpose.</p>
            <p style={{ margin: 0, fontSize: web ? 15 : 14, lineHeight: 1.6, color: "var(--text-muted)" }}>Free events cost nothing to host. Paid events run through Stripe with a flat 5% fee, paid out monthly. Bookings, waitlists and door lists are handled for you.</p>
            <div style={{ marginTop: 20 }}><Btn size="sm" variant="secondary" onClick={founding || enter}>Host on Click</Btn></div>
          </div>
          {web && <Cover category="workshops" aspect="4/3" photo="a pottery studio owner setting up before class" radius={18} tone="bright" />}
        </div>
      </section>

      {/* 7 · CLOSE */}
      <section style={{ maxWidth: C, margin: "0 auto", padding: web ? "72px 40px 84px" : "50px 22px 60px", textAlign: "center" }}>
        <h2 style={{ ...H2, fontSize: "clamp(1.55rem, 1.2rem + 1.6cqi, 2.4rem)", letterSpacing: "-.025em", lineHeight: 1.1, marginBottom: 12 }}>Something good is happening in Sydney this week.</h2>
        <p style={{ margin: "0 auto 26px", fontSize: web ? 17 : 15.5, lineHeight: 1.6, color: "var(--text-body)", maxWidth: 520 }}>Find it. Show up. Everything else is a bonus.</p>
        <Btn size="lg" onClick={enter}>Request an invite</Btn>
        <p style={{ margin: "18px auto 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)", maxWidth: 460 }}>Somewhere else? Request an invite anyway - we'll tell you the moment Click reaches you.</p>
      </section>
    </div>;
  }

  window.ScreensHIW = { HowItWorks };
})();
