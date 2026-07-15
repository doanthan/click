(function () {
  /* Click - the Click quiz (full-screen MODAL takeover). Warm, optional, all questions skippable.
     Reordered fun-first / sensitive-last (5 steps). Feeds the silent life-tag + persona system -
     the result is NEVER shown back to the user. NO spark glyph anywhere (reserved for the three
     mechanic peaks); hyphens, never em-dashes. Inline styles. window.ScreensQuiz. */
  const { useState, useEffect, Icon, Logo, Btn, Cover } = window.CK;
  const D = window.DATA;
  const EventCard = window.ScreensA && window.ScreensA.EventCard;

  /* one screen per step; each holds 1-4 questions. Sensitive items live LAST (step 5). */
  const STEPS = [
    {
      eyebrow: "YOUR KIND OF ROOM", title: "Set the scene", icon: "compass",
      sub: "The rooms you enjoy most - pick whatever fits.",
      questions: [
        { id: "size", prompt: "Size that suits you", multi: true, options: ["Small and intimate", "Medium", "Big and buzzing"] },
        { id: "vibe", prompt: "The vibe you're after", multi: true, options: ["Hands-on and creative", "Active and physical", "Social and easygoing", "Learning something new", "Calm and restorative"] },
        { id: "structure", prompt: "You'd rather it be", options: ["With a plan", "Loose and free-flowing", "Don't mind either way"] },
      ],
    },
    {
      eyebrow: "HOW YOU CONNECT", title: "Your social style", icon: "users",
      sub: "No right answers - just what's true for you.",
      questions: [
        { id: "recharge", prompt: "You recharge by", options: ["Time on your own", "A bit of both", "Being around people"] },
        { id: "strangers", prompt: "Walking into a room of strangers, you", options: ["Hang back and read the room", "Dive in and say hi", "Depends on the day"] },
        { id: "clickwith", prompt: "You tend to click with people who are", multi: true, options: ["Thoughtful and deep", "Fun and spontaneous", "Driven and ambitious", "Warm and caring"] },
        { id: "pace", prompt: "Your social pace", options: ["Slow and steady", "Somewhere in between", "Fast, I love variety"] },
      ],
    },
    {
      eyebrow: "WHAT YOU'RE AFTER LATELY", title: "Right about now", icon: "clock",
      sub: "This can shift - update it whenever.",
      questions: [
        { id: "intent", prompt: "What brings you to Click?", multi: true, gateDating: true, options: ["Doing more of what I love", "Meeting new people", "Making local friends", "Growing my circle", "Networking", "Open to dating"] },
        { id: "socially", prompt: "Socially, right now you're", options: ["Open and curious", "Keen to widen your circle", "In a good place, just here for fun"] },
      ],
    },
    {
      eyebrow: "YOUR WEEK & RANGE", title: "Timing and distance", icon: "calendar",
      sub: "So we lean toward what actually fits your life.",
      questions: [
        { id: "free", prompt: "When you're usually free", multi: true, options: ["Weekday mornings", "Weekday evenings", "Saturdays", "Sundays", "Varies week to week"] },
        { id: "distance", prompt: "How far you'll travel for a good one", options: ["Keep it in my suburb", "Up to ~20 minutes", "Across the city for the right thing", "Distance doesn't faze me"] },
      ],
    },
    {
      eyebrow: "A LITTLE ABOUT YOU", title: "Anything you'd like us to know?", icon: "user",
      sub: "All optional - it just helps us connect you with people in a similar chapter.",
      questions: [
        { id: "stage", prompt: "Any of these fit right now?", multi: true, options: ["New in town", "New parent", "Student", "Recently retired", "None of these"] },
        { id: "pet", prompt: "A pet in your life?", options: ["Yes", "No"] },
        { id: "lgbtq", prompt: "Do you identify as LGBTQ+?", sensitive: true, options: ["Yes", "No", "Prefer not to say"], note: "Optional and private to you - it helps us keep events welcoming." },
      ],
    },
  ];
  const TOTAL = STEPS.length;
  const PCT = [0, 22, 44, 62, 80, 96];   // endowed: pre-filled, fast early, slower late

  /* Lucide glyph on a Lavender circle (NEVER a spark) */
  function Glyph({ web, icon }) {
    const d = web ? 50 : 44;
    return <div className="ckQGlyph" style={{ position: "relative", width: d, height: d, margin: "0 auto 13px" }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "color-mix(in srgb,var(--lavender-300) 26%,var(--cream))" }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={Math.round(d * 0.42)} w={1.8} color="var(--purple-600)" /></span>
    </div>;
  }

  /* one neutral option pill - 12px radius, >=44px tap. Selected = Deep-Purple fill, no tick. */
  function Opt({ on, onClick, children }) {
    return <button onClick={onClick} aria-pressed={on} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 44, padding: "11px 16px", boxSizing: "border-box", borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: on ? 600 : 500, backgroundColor: on ? "var(--purple-600)" : "var(--white)", color: on ? "var(--cream)" : "var(--text-body)", border: "1.5px solid " + (on ? "var(--purple-600)" : "var(--border-mid)"), transition: "background-color .15s,border-color .15s" }}>{children}</button>;
  }

  function Question({ q, value, setValue }) {
    const isOn = (o) => q.multi ? (value || []).includes(o) : value === o;
    const pick = (o) => {
      if (q.multi) { const cur = value || []; setValue(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]); }
      else setValue(value === o ? null : o);
    };
    return <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 9, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: "var(--text-strong)", lineHeight: 1.3 }}>{q.prompt}</span>
        {q.multi && <span style={{ fontSize: 12.5, color: "var(--text-faint)", fontWeight: 500 }}>pick any</span>}
        {q.sensitive && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}><Icon name="lock" size={12} w={2} color="var(--text-muted)" />optional</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{q.options.map((o) => <Opt key={o} on={isOn(o)} onClick={() => pick(o)}>{o}</Opt>)}</div>
      {q.note && <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 11, padding: "10px 13px", background: "var(--lavender-wash)", borderRadius: "var(--radius-md)" }}>
        <Icon name="lock" size={13} w={1.9} color="var(--purple-600)" style={{ marginTop: 1, flex: "none" }} />
        <span style={{ fontSize: 12.5, color: "var(--purple-800)", lineHeight: 1.5 }}>{q.note}</span>
      </div>}
    </div>;
  }

  /* gated dating sub-block - animates in only when "Open to dating" is selected */
  function DatingBlock({ meet, setMeet, ageMin, ageMax, setAge }) {
    const lo = 18, hi = 65, span = hi - lo;
    const onMin = (v) => setAge(Math.min(Number(v), ageMax - 1), ageMax);
    const onMax = (v) => setAge(ageMin, Math.max(Number(v), ageMin + 1));
    return <div className="ckQDate" style={{ marginBottom: 22, padding: "16px 16px 14px", background: "var(--lavender-wash)", borderRadius: "var(--radius-lg)" }}>
      <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: "var(--purple-800)" }}>Nice - a couple of quick ones, just for this.</p>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)", marginBottom: 9 }}>You'd like to meet</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{["Men", "Women", "Everyone"].map((o) => <Opt key={o} on={meet === o} onClick={() => setMeet(meet === o ? null : o)}>{o}</Opt>)}</div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>Age range</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--purple-700)" }}>{ageMin} - {ageMax}</span>
        </div>
        <div style={{ position: "relative", height: 28 }}>
          <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 5, borderRadius: 99, background: "var(--mist)" }} />
          <div style={{ position: "absolute", top: 12, height: 5, borderRadius: 99, background: "var(--purple-500)", left: ((ageMin - lo) / span) * 100 + "%", right: (100 - ((ageMax - lo) / span) * 100) + "%" }} />
          <input className="ckQRange" type="range" min={lo} max={hi} value={ageMin} onChange={(e) => onMin(e.target.value)} aria-label="Minimum age" />
          <input className="ckQRange" type="range" min={lo} max={hi} value={ageMax} onChange={(e) => onMax(e.target.value)} aria-label="Maximum age" />
        </div>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--purple-800)", opacity: .82, lineHeight: 1.5 }}>Only shapes who we suggest - never shown on your profile.</p>
    </div>;
  }

  function Quiz({ web, done, onClose }) {
    const [step, setStep] = useState(0);   // 0 = intro · 1..5 = steps · 6 = finish
    const [ans, setAns] = useState({});
    const [meet, setMeet] = useState(null);
    const [ageMin, setAgeMin] = useState(25);
    const [ageMax, setAgeMax] = useState(38);
    const set = (id, v) => setAns((a) => ({ ...a, [id]: v }));
    const next = () => setStep((s) => s + 1);
    const back = () => setStep((s) => Math.max(0, s - 1));

    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    let body;
    if (step === 0) {
      /* INTRO */
      body = <div style={{ maxWidth: 410, margin: "0 auto", textAlign: "center", paddingTop: web ? 4 : 2 }}>
        <Glyph web={web} icon="compass" />
        <p style={{ margin: "0 0 6px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-500)" }}>The Click quiz</p>
        <h1 style={{ margin: "0 0 9px", fontFamily: "var(--font-display)", fontSize: "clamp(1.288125rem, 1.169rem + 0.51cqi, 1.55rem)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.15, color: "var(--text-strong)" }}>Find your kind of night</h1>
        <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-body)" }}>A handful of quick questions, so we surface fewer, better things - the events and rooms that feel like you. About two minutes.</p>
        <div style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, textAlign: "left", maxWidth: 360, padding: "10px 13px", background: "var(--lavender-wash)", borderRadius: "var(--radius-md)", marginBottom: 18 }}>
          <Icon name="lock" size={15} w={1.9} color="var(--purple-600)" style={{ marginTop: 1, flex: "none" }} />
          <span style={{ fontSize: 13, color: "var(--purple-800)", lineHeight: 1.5 }}>Private to you - these tune your suggestions and never show on your profile.</span>
        </div>
        <div><Btn size="lg" onClick={next} icon="arrowR">Start the quiz</Btn></div>
        <p style={{ margin: "13px 0 0" }}><button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>Maybe later</button></p>
      </div>;
    } else if (step > TOTAL) {
      /* FINISH - the silent payoff: never lists the user's tags; tight + centered */
      body = <div style={{ maxWidth: 400, margin: "0 auto", textAlign: "center", paddingTop: web ? 14 : 6 }}>
        <Glyph web={web} icon="check" />
        <h1 style={{ margin: "0 0 9px", fontFamily: "var(--font-display)", fontSize: "clamp(1.32375rem, 1.175rem + 0.63cqi, 1.65rem)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text-strong)" }}>You're all set</h1>
        <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>Thanks - that helps a lot. We'll start leaning toward your kind of thing.</p>
        <div><Btn size="lg" onClick={done} icon="arrowR">See what's on</Btn></div>
        <p style={{ margin: "13px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Change your answers anytime in Settings.</p>
      </div>;
    } else {
      /* a step */
      const sec = STEPS[step - 1];
      const datingOn = (ans.intent || []).includes("Open to dating");
      body = <div key={step} style={{ maxWidth: 440, margin: "0 auto" }}>
        <Glyph web={web} icon={sec.icon} />
        <div style={{ marginBottom: 16, textAlign: "center" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--purple-500)" }}>{sec.eyebrow}</p>
          <h1 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: "clamp(1.18rem, 1.103rem + 0.33cqi, 1.35rem)", fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.15, color: "var(--text-strong)" }}>{sec.title}</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>{sec.sub}</p>
        </div>
        {sec.questions.map((q) => <React.Fragment key={q.id}>
          <Question q={q} value={ans[q.id]} setValue={(v) => set(q.id, v)} />
          {q.gateDating && datingOn && <DatingBlock meet={meet} setMeet={setMeet} ageMin={ageMin} ageMax={ageMax} setAge={(a, b) => { setAgeMin(a); setAgeMax(b); }} />}
        </React.Fragment>)}
      </div>;
    }

    const showBar = step >= 1 && step <= TOTAL;
    const sec = STEPS[step - 1];
    const answeredHere = sec ? sec.questions.some((q) => { const v = ans[q.id]; return Array.isArray(v) ? v.length : v != null; }) : false;

    return <div style={{ position: "fixed", inset: 0, zIndex: 62, background: "rgba(28,24,48,.55)", display: "flex", alignItems: web ? "center" : "stretch", justifyContent: "center", padding: web ? 28 : 0 }}>
      <style dangerouslySetInnerHTML={{ __html: "@keyframes ckQModalIn{0%{transform:translateY(12px) scale(.985)}100%{transform:none}}.ckQModal{animation:ckQModalIn .42s cubic-bezier(.2,.7,.3,1) both}@keyframes ckQIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}@keyframes ckQSlide{0%{transform:translateY(-6px)}100%{transform:none}}.ckQGlyph{animation:ckQIn .45s cubic-bezier(.2,.7,.3,1) both}.ckQDate{animation:ckQSlide .3s ease both}.ckQRange{-webkit-appearance:none;appearance:none;background:transparent;position:absolute;top:0;left:0;width:100%;height:28px;margin:0;pointer-events:none}.ckQRange::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:22px;height:22px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);box-shadow:var(--shadow-sm);cursor:pointer;margin-top:-9px}.ckQRange::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:var(--purple-600);border:3px solid var(--white);cursor:pointer}.ckQRange::-webkit-slider-runnable-track{height:5px;background:transparent}.ckQRange::-moz-range-track{height:5px;background:transparent}@media (prefers-reduced-motion: reduce){.ckQGlyph,.ckQDate,.ckQModal{animation:none!important}}" }} />
      <div className="ckQModal" style={{ position: "relative", width: "100%", maxWidth: web ? 520 : "none", height: web ? "auto" : "100%", maxHeight: web ? "86vh" : "none", display: "flex", flexDirection: "column", background: "var(--cream)", borderRadius: web ? "var(--radius-2xl)" : 0, boxShadow: web ? "var(--shadow-xl)" : "none", overflow: "hidden" }}>
      {/* top bar: wordmark · progress · close */}
      <div style={{ flex: "none", padding: web ? "14px 28px 0" : "12px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: showBar ? 12 : 0 }}>
          {showBar ? <span style={{ fontFamily: "var(--font-display)", fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>Step {step} of {TOTAL}</span> : <span />}
          <button onClick={onClose} aria-label="Close quiz" style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}><Icon name="x" size={18} w={2.2} color="var(--text-muted)" /></button>
        </div>
        {showBar && <div style={{ height: 6, borderRadius: 999, background: "var(--surface-tint)", overflow: "hidden", maxWidth: web ? 460 : "none", margin: "0 auto" }}><div style={{ height: "100%", width: PCT[step] + "%", background: "var(--purple-600)", borderRadius: 999, transition: "width .4s cubic-bezier(.3,.7,.4,1)" }} /></div>}
      </div>
      {/* body */}
      <div style={{ flex: 1, overflowY: "auto", padding: web ? "20px 30px 22px" : "18px 20px 20px" }}>{body}</div>
      {/* footer (steps only) */}
      {showBar && <div style={{ flex: "none", padding: web ? "12px 30px 18px" : "10px 20px 16px", borderTop: "1px solid var(--border-soft)", background: "var(--cream)" }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          {step > 1 && <Btn variant="secondary" onClick={back}>Back</Btn>}
          <div style={{ flex: 1 }} />
          <button onClick={next} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>Skip</button>
          <Btn onClick={next} icon="arrowR">{answeredHere ? (step === TOTAL ? "Finish" : "Next") : "Skip section"}</Btn>
        </div>
      </div>}
      </div>
    </div>;
  }

  window.ScreensQuiz = { Quiz };
})();
