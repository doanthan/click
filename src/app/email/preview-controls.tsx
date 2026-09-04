"use client";

// Interactive island for the /email gallery - owns the view toggle
// (rendered HTML vs. plain text), device width toggle (600px desktop vs.
// 375px mobile), and the "Copy HTML" button. The server component hands us
// the already-built strings; this component never sees a template module.

import { useState } from "react";

type Props = {
  html: string;
  text: string;
  scenarioLabel: string;
  scenarioId: string;
};

type View = "html" | "text";
type Device = "desktop" | "mobile";

// "Log to drawer" inserts a row into `email_events` using the same scenario
// the page is showing. Status is local UI state - the actual row appears via
// the drawer's own poll within ~5s.
type LogState = "idle" | "sending" | "logged" | "error";

export function PreviewControls({ html, text, scenarioLabel, scenarioId }: Props) {
  const [view, setView] = useState<View>("html");
  const [device, setDevice] = useState<Device>("desktop");
  const [copied, setCopied] = useState<"html" | "text" | null>(null);
  const [logState, setLogState] = useState<LogState>("idle");
  const [logError, setLogError] = useState<string | null>(null);

  async function logToDrawer() {
    setLogState("sending");
    setLogError(null);
    try {
      const res = await fetch("/api/test/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) {
        setLogError(json.error ?? `Request failed (${res.status})`);
        setLogState("error");
        return;
      }
      setLogState("logged");
      // Reset the affordance after a beat so repeated logs read as distinct
      // actions instead of one stuck "Logged ✓" state.
      setTimeout(() => setLogState("idle"), 1800);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Send failed");
      setLogState("error");
    }
  }

  async function copy(payload: string, which: "html" | "text") {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard may be unavailable (http://, no perms). Surface inline.
      setCopied(null);
      window.prompt("Copy from here:", payload);
    }
  }

  const width = device === "mobile" ? 375 : 600;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup label="View">
          <ToggleButton active={view === "html"} onClick={() => setView("html")}>
            HTML
          </ToggleButton>
          <ToggleButton active={view === "text"} onClick={() => setView("text")}>
            Plain text
          </ToggleButton>
        </ToggleGroup>

        <ToggleGroup label="Width">
          <ToggleButton
            active={device === "desktop"}
            onClick={() => setDevice("desktop")}
            disabled={view === "text"}
          >
            Desktop · 600
          </ToggleButton>
          <ToggleButton
            active={device === "mobile"}
            onClick={() => setDevice("mobile")}
            disabled={view === "text"}
          >
            Mobile · 375
          </ToggleButton>
        </ToggleGroup>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void logToDrawer()}
            disabled={logState === "sending"}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--ink)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--champagne)] hard-shadow-sm transition hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)] disabled:opacity-60"
          >
            {logState === "sending"
              ? "Sending…"
              : logState === "logged"
                ? "Logged ✓"
                : "Send fake email"}
          </button>
          <button
            type="button"
            onClick={() => copy(html, "html")}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            {copied === "html" ? "Copied ✓" : "Copy HTML"}
          </button>
          <button
            type="button"
            onClick={() => copy(text, "text")}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            {copied === "text" ? "Copied ✓" : "Copy text"}
          </button>
        </div>
      </div>

      {logError ? (
        <p className="font-mono text-[0.7rem] text-[color:var(--rose)]">{logError}</p>
      ) : null}

      {/* Preview surface */}
      <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
        {view === "html" ? (
          <div className="flex justify-center">
            <iframe
              key={`${scenarioLabel}-${device}`}
              title={`${scenarioLabel} preview`}
              srcDoc={html}
              // `allow-same-origin` lets the iframe load Google Fonts and use
              // `view-source:` debugging. No `allow-scripts` - no email-side JS
              // can run, which is also a reminder that real clients won't.
              sandbox="allow-same-origin"
              style={{
                width,
                height: 900,
                border: "1px solid var(--line)",
                background: "#FFFCF9",
                borderRadius: 12,
                transition: "width 200ms ease",
              }}
            />
          </div>
        ) : (
          <pre className="max-h-[900px] overflow-auto whitespace-pre-wrap rounded-xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-6 font-mono text-sm leading-relaxed text-[color:var(--ink)]">
            {text}
          </pre>
        )}
      </div>

      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {view === "html"
          ? "Rendered inside a sandboxed <iframe srcDoc>. Email CSS is isolated from this page."
          : "This is the plain-text alternative - what Outlook plain-text mode and many corporate filters actually show."}
      </p>
    </div>
  );
}

function ToggleGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
      <div className="inline-flex overflow-hidden rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
          : "text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
