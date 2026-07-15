(function () {
  /* Click - Auth (sign in / sign up). One page, two modes; verify gate; reset flow.
     Minimal by design: email + password or SSO only. Identity lives in onboarding. */
  const { useState, Btn, Icon, Logo, Spark, Field } = window.CK;

  const COMMON = ["password", "12345678", "qwerty123", "password1", "11111111", "iloveyou1"];
  const emailOk = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

  /* ---- Google / Apple marks (SSO) ---- */
  function GoogleMark() {
    return <svg width="18" height="18" viewBox="0 0 48 48" style={{ flex: "none" }}>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7Z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9Z" />
    </svg>;
  }
  function AppleMark() {
    return <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--ink)" style={{ flex: "none" }}>
      <path d="M17.05 12.94c-.03-2.7 2.2-3.99 2.3-4.06-1.25-1.84-3.2-2.09-3.9-2.12-1.66-.17-3.24.97-4.08.97-.84 0-2.14-.95-3.52-.92-1.81.03-3.48 1.05-4.41 2.67-1.88 3.27-.48 8.1 1.35 10.76.89 1.3 1.96 2.76 3.36 2.71 1.35-.05 1.86-.87 3.49-.87 1.63 0 2.09.87 3.52.84 1.45-.03 2.37-1.32 3.26-2.63.65-.94 1.16-1.95 1.46-2.99-.03-.01-2.83-1.08-2.86-4.29M14.4 5.31c.74-.9 1.24-2.15 1.1-3.39-1.07.04-2.36.71-3.12 1.6-.68.79-1.28 2.06-1.12 3.27 1.19.09 2.41-.6 3.14-1.48" />
    </svg>;
  }
  function SSOButton({ children, mark, onClick }) {
    const [h, setH] = useState(false);
    return <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", height: 50, padding: "0 16px", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--text-strong)", background: h ? "var(--surface-tint)" : "var(--white)", border: "1.5px solid var(--border-mid)", borderRadius: "var(--radius-md)", cursor: "pointer", transition: "background .15s" }}>
      {mark}{children}
    </button>;
  }

  /* ---- password field with show/hide + live hints ---- */
  function PwField({ label, value, onChange, show, setShow, forgot, autoFocus }) {
    const [f, setF] = useState(false);
    return <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>{label}</span>
        {forgot && <a onClick={forgot} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--purple-600)", cursor: "pointer" }}>Forgot password?</a>}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 0 14px", height: 50, background: "var(--white)", border: `1.5px solid ${f ? "var(--accent)" : "var(--border-mid)"}`, borderRadius: "var(--radius-md)", boxShadow: f ? "0 0 0 4px color-mix(in srgb,var(--lavender-300) 45%,transparent)" : "none", transition: "border .15s,box-shadow .15s" }}>
        <Icon name="lock" size={18} w={1.9} color="var(--text-muted)" />
        <input type={show ? "text" : "password"} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 15.5, color: "var(--text-strong)" }} />
        <button onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
          style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, border: "none", background: "none", cursor: "pointer", borderRadius: "var(--radius-sm)", color: show ? "var(--purple-600)" : "var(--text-muted)" }}>
          <Icon name="eye" size={18} w={1.9} color="currentColor" />
        </button>
      </span>
    </label>;
  }

  function Hint({ ok, children }) {
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: ok ? "var(--success)" : "var(--text-muted)", transition: "color .2s" }}>
      <span style={{ flex: "none", width: 15, height: 15, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: ok ? "color-mix(in srgb,var(--success) 16%,var(--white))" : "var(--surface-tint)", border: `1px solid ${ok ? "color-mix(in srgb,var(--success) 35%,transparent)" : "var(--border-mid)"}`, transition: "background .2s,border .2s" }}>
        {ok && <Icon name="check" size={9} w={3} color="var(--success)" />}
      </span>{children}
    </span>;
  }

  function Divider() {
    return <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "4px 0" }}>
      <span style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-faint)" }}>or</span>
      <span style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
    </div>;
  }

  function ErrorBanner({ children }) {
    return <div role="alert" aria-live="assertive" style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", background: "color-mix(in srgb,var(--error) 8%,var(--white))", border: "1px solid color-mix(in srgb,var(--error) 28%,transparent)", borderRadius: "var(--radius-md)", fontSize: 13.5, lineHeight: 1.45, color: "var(--error)", fontWeight: 500 }}>
      <Icon name="info" size={16} w={2} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>;
  }

  function Frame({ web, children }) {
    /* centered calm column on cream */
    const split = false;
    return <div style={{ minHeight: web ? 560 : "auto", display: "flex", background: "var(--cream)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: web ? "56px 40px 64px" : "30px 22px 48px" }}>
        <div style={{ width: "100%", maxWidth: 412 }}>{children}</div>
      </div>
      {split && <div style={{ width: 380, flex: "none", borderLeft: "1px solid var(--border-soft)", background: "var(--surface-tint)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "56px 48px" }}>
        <Logo size={34} />
        <p style={{ margin: "26px 0 6px", fontFamily: "var(--font-mono,ui-monospace,monospace)", fontSize: 14, color: "var(--purple-600)", letterSpacing: ".02em" }}>click /klɪk/ · <span style={{ color: "var(--text-muted)" }}>verb</span></p>
        <p style={{ margin: 0, fontSize: 19, lineHeight: 1.5, fontWeight: 500, color: "var(--text-strong)", maxWidth: 250 }}>to connect effortlessly with someone through shared curiosity, energy, or experience.</p>
        <p style={{ margin: "22px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)" }}>Real events. Real people. No endless scrolling.</p>
      </div>}
    </div>;
  }

  /* ============================ main ============================ */
  function Auth({ web, start = "signup", done }) {
    const [mode, setMode] = useState(start === "signin" || start === "signin-error" ? "signin" : "signup");
    const [stage, setStage] = useState(start === "verify" ? "verify" : start === "reset" ? "reset-req" : "form");
    const [email, setEmail] = useState(start === "verify" ? "ava@example.com" : "");
    const [pw, setPw] = useState("");
    const [show, setShow] = useState(false);
    const [keep, setKeep] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(start === "signin-error");
    const [touchedEmail, setTouchedEmail] = useState(false);
    const [resend, setResend] = useState(0);

    const len8 = pw.length >= 8;
    const notCommon = pw.length > 0 && !COMMON.includes(pw.toLowerCase());
    const emailValid = emailOk(email);
    const showEmailErr = touchedEmail && email.length > 0 && !emailValid;

    const runResend = () => { setResend(30); const t = setInterval(() => setResend((s) => { if (s <= 1) { clearInterval(t); return 0; } return s - 1; }), 1000); };

    const submit = () => {
      setErr(false);
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        if (mode === "signup") { runResend(); setStage("verify"); }
        else { if (!touchedEmail) {} done && done(); }
      }, 1100);
    };
    const submitReset = () => { setLoading(true); setTimeout(() => { setLoading(false); setStage("reset-sent"); }, 1000); };
    const saveNew = () => { setLoading(true); setTimeout(() => { setLoading(false); setStage("done-reset"); }, 1000); };

    /* ---------- email-verification gate ---------- */
    if (stage === "verify") return <Frame web={web}>
      <div style={{ textAlign: "center" }}>
        <Logo size={28} />
        <div style={{ width: 60, height: 60, margin: "30px auto 22px", borderRadius: "50%", background: "var(--surface-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="bell" size={26} w={1.7} color="var(--purple-600)" />
        </div>
        <h1 style={{ margin: "0 0 10px", font: "var(--role-h3)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 24, color: "var(--text-strong)" }}>Check your inbox</h1>
        <p style={{ margin: "0 auto", maxWidth: 340, fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>We sent a link to <b style={{ color: "var(--text-strong)" }}>{email || "your email"}</b> to confirm it's you. Tap it and you're in.</p>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 11 }}>
        <Btn full onClick={done}>Have a look around while you wait</Btn>
        <button onClick={resend ? undefined : runResend} disabled={!!resend}
          style={{ height: 48, width: "100%", border: "1.5px solid var(--border-mid)", background: "var(--white)", borderRadius: "var(--radius-md)", fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: resend ? "var(--text-muted)" : "var(--text-strong)", cursor: resend ? "default" : "pointer" }}>
          {resend ? `Resend email in ${resend}s` : "Resend email"}
        </button>
      </div>
      <p style={{ margin: "18px 0 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Wrong email? <a onClick={() => { setStage("form"); setErr(false); }} style={{ color: "var(--purple-600)", fontWeight: 600, cursor: "pointer" }}>Change it</a></p>
    </Frame>;

    /* ---------- password reset: request ---------- */
    if (stage === "reset-req") return <Frame web={web}>
      <button onClick={() => { setStage("form"); setMode("signin"); }} style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 6, border: "none", background: "none", padding: 0, marginBottom: 18, fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)", cursor: "pointer" }}><Icon name="chevL" size={16} w={2.2} color="var(--text-muted)" />Back to sign in</button>
      <Logo size={26} />
      <h1 style={{ margin: "22px 0 8px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 25, color: "var(--text-strong)" }}>Reset your password</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-body)" }}>Enter your email and we'll send a reset link.</p>
      <Field label="Email" type="email" placeholder="you@email.com" value={email} onChange={setEmail} icon="mail" />
      <div style={{ height: 18 }} />
      <Btn full onClick={submitReset} disabled={!emailValid || loading}>{loading ? "Sending…" : "Send reset link"}</Btn>
    </Frame>;

    /* ---------- password reset: confirmation (non-enumerating) ---------- */
    if (stage === "reset-sent") return <Frame web={web}>
      <div style={{ textAlign: "center" }}>
        <Logo size={28} />
        <div style={{ width: 60, height: 60, margin: "30px auto 22px", borderRadius: "50%", background: "var(--surface-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="mail" size={25} w={1.7} color="var(--purple-600)" /></div>
        <h1 style={{ margin: "0 0 10px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 24, color: "var(--text-strong)" }}>Check your email</h1>
        <p style={{ margin: "0 auto", maxWidth: 330, fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>If that email is registered, a reset link is on its way.</p>
        <div style={{ marginTop: 26 }}><Btn full onClick={() => setStage("set-new")}>Open the link →</Btn></div>
        <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Didn't get it? <a onClick={submitReset} style={{ color: "var(--purple-600)", fontWeight: 600, cursor: "pointer" }}>Resend</a></p>
      </div>
    </Frame>;

    /* ---------- password reset: set new ---------- */
    if (stage === "set-new") return <Frame web={web}>
      <Logo size={26} />
      <h1 style={{ margin: "22px 0 8px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 25, color: "var(--text-strong)" }}>Set a new password</h1>
      <p style={{ margin: "0 0 22px", fontSize: 14.5, lineHeight: 1.55, color: "var(--text-body)" }}>Choose something you'll remember.</p>
      <PwField label="New password" value={pw} onChange={setPw} show={show} setShow={setShow} autoFocus />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "12px 2px 20px" }}>
        <Hint ok={len8}>8+ characters</Hint>
        <Hint ok={notCommon}>Not a common password</Hint>
      </div>
      <Btn full onClick={saveNew} disabled={!len8 || !notCommon || loading}>{loading ? "Saving…" : "Save & sign in"}</Btn>
    </Frame>;

    if (stage === "done-reset") return <Frame web={web}>
      <div style={{ textAlign: "center" }}>
        <Logo size={28} />
        <div style={{ width: 60, height: 60, margin: "30px auto 22px", borderRadius: "50%", background: "color-mix(in srgb,var(--success) 14%,var(--white))", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="check" size={26} w={2.4} color="var(--success)" /></div>
        <h1 style={{ margin: "0 0 10px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 24, color: "var(--text-strong)" }}>Password updated</h1>
        <p style={{ margin: "0 auto 26px", maxWidth: 300, fontSize: 15, lineHeight: 1.6, color: "var(--text-body)" }}>You're all set - let's get you back in.</p>
        <Btn full onClick={done}>Go to Click</Btn>
      </div>
    </Frame>;

    /* ---------- main sign in / sign up form ---------- */
    const isUp = mode === "signup";
    return <Frame web={web}>
      {!web && <div style={{ marginBottom: 22 }}><Logo size={28} /></div>}
      <h1 style={{ margin: "0 0 6px", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 26, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{isUp ? "Create your account" : "Welcome back"}</h1>
      <p style={{ margin: "0 0 22px", fontSize: 14.5, lineHeight: 1.5, color: "var(--text-muted)" }}>{isUp ? "One step to real-life events near you." : "Sign in to pick up where you left off."}</p>

      {/* mode toggle - segmented, morphs in place */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--surface-tint)", borderRadius: "var(--radius-pill)", marginBottom: 22 }}>
        {[["signup", "Sign up"], ["signin", "Sign in"]].map(([k, lab]) => {
          const on = mode === k;
          return <button key={k} onClick={() => { setMode(k); setErr(false); }}
            style={{ flex: 1, height: 38, border: "none", borderRadius: "var(--radius-pill)", background: on ? "var(--white)" : "transparent", color: on ? "var(--purple-700)" : "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: on ? "var(--shadow-sm)" : "none", transition: "background .18s,color .18s" }}>{lab}</button>;
        })}
      </div>

      {/* SSO */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <SSOButton mark={<GoogleMark />} onClick={done}>Continue with Google</SSOButton>
        <SSOButton mark={<AppleMark />} onClick={done}>Continue with Apple</SSOButton>
      </div>
      <Divider />

      {/* email + password */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        {err && <ErrorBanner>That email or password doesn't match. Have another go.</ErrorBanner>}
        <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" }}>Email</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 50, background: "var(--white)", border: `1.5px solid ${showEmailErr ? "var(--error)" : "var(--border-mid)"}`, borderRadius: "var(--radius-md)" }}>
            <Icon name="mail" size={18} w={1.9} color="var(--text-muted)" />
            <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouchedEmail(true)}
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 15.5, color: "var(--text-strong)" }} />
            {emailValid && <Icon name="check" size={17} w={2.4} color="var(--success)" />}
          </span>
          {showEmailErr && <span style={{ fontSize: 12.5, color: "var(--error)", fontWeight: 500 }}>Enter a valid email address.</span>}
        </label>

        <div>
          <PwField label="Password" value={pw} onChange={setPw} show={show} setShow={setShow} forgot={isUp ? null : () => { setStage("reset-req"); setErr(false); }} />
          {isUp && <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "11px 2px 0" }}>
            <Hint ok={len8}>8+ characters</Hint>
            <Hint ok={notCommon}>Not a common password</Hint>
          </div>}
        </div>

        {!isUp && <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13.5, color: "var(--text-body)", fontWeight: 500 }}>
          <span onClick={() => setKeep(!keep)} style={{ flex: "none", width: 19, height: 19, borderRadius: 5, border: `1.5px solid ${keep ? "var(--accent)" : "var(--border-mid)"}`, background: keep ? "var(--accent)" : "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s,border .15s" }}>{keep && <Icon name="check" size={12} w={3} color="var(--cream)" />}</span>
          Keep me signed in
        </label>}

        <Btn full onClick={submit} disabled={loading || !emailValid || (isUp && (!len8 || !notCommon)) || (!isUp && pw.length === 0)}>
          {loading ? (isUp ? "Creating account…" : "Signing you in…") : (isUp ? "Create account" : "Sign in")}
        </Btn>
      </div>

      {/* microcopy */}
      <p style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--text-muted)", textAlign: "center" }}>
        By continuing you agree to our <a style={{ color: "var(--text-body)", textDecoration: "underline", cursor: "pointer" }}>Terms</a> & <a style={{ color: "var(--text-body)", textDecoration: "underline", cursor: "pointer" }}>Privacy</a>.
      </p>
      {isUp && <div style={{ margin: "14px 0 0", padding: "12px 14px", background: "var(--surface-tint)", borderRadius: "var(--radius-md)", display: "flex", gap: 9, alignItems: "flex-start" }}>
        <span style={{ flex: "none", marginTop: 1 }}><Spark size={15} /></span>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--text-body)" }}>Invite-only - Click is piloting in inner Sydney. Outside the area? Sign up and we'll tell you the moment we reach you.</p>
      </div>}
    </Frame>;
  }

  window.ScreensAuth = { Auth };
})();
