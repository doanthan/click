"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ds";
import { ModalShell } from "@/components/modal-shell";
import {
  clearQaActivity,
  getQaRecorderState,
  recordQaActivity,
  setQaRecorderContext,
  setQaRecordingEnabled,
  subscribeQaRecorder,
  type QaActivityEntry,
  type QaActivityKind,
  type QaRecorderState,
} from "@/lib/support-capture";
import { findQaPersona } from "@/lib/qa-personas";

type TimelineFilter = "all" | "problems" | "actions" | "network";

const EMPTY_RECORDER: QaRecorderState = {
  entries: [],
  enabled: true,
  startedAt: "",
};

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "problems", label: "Problems" },
  { id: "actions", label: "Actions" },
  { id: "network", label: "Requests" },
];

const KIND_LABEL: Record<QaActivityKind, string> = {
  navigation: "Page",
  interaction: "Action",
  network: "Request",
  console: "Console",
  runtime: "Runtime",
  checkpoint: "Note",
};

function formatClock(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(startedAt: string) {
  if (!startedAt) return "Just started";
  const elapsed = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Under a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
}

function controlLabel(element: HTMLElement): string {
  const value =
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.innerText ||
    element.textContent ||
    element.tagName.toLowerCase();
  return value.replace(/\s+/g, " ").trim().slice(0, 100) || "Unnamed control";
}

function formLabel(form: HTMLFormElement, submitter: HTMLElement | null): string {
  return (
    form.getAttribute("aria-label") ||
    form.getAttribute("name") ||
    (form.id ? `form ${form.id}` : "") ||
    (submitter ? controlLabel(submitter) : "Form")
  );
}

function entryMatches(entry: QaActivityEntry, filter: TimelineFilter) {
  if (filter === "all") return true;
  if (filter === "problems") return entry.level === "error" || entry.level === "warning";
  if (filter === "network") return entry.kind === "network";
  return (
    entry.kind === "interaction" ||
    entry.kind === "navigation" ||
    entry.kind === "checkpoint"
  );
}

function eventPalette(entry: QaActivityEntry) {
  if (entry.level === "error") {
    return {
      rail: "bg-[color:var(--danger)]",
      badge:
        "bg-[color-mix(in_srgb,var(--danger)_12%,var(--paper))] text-[color:var(--danger)]",
    };
  }
  if (entry.level === "warning") {
    return {
      rail: "bg-[color:var(--amber)]",
      badge:
        "bg-[color-mix(in_srgb,var(--amber)_15%,var(--paper))] text-[color:var(--amber-ink)]",
    };
  }
  if (entry.level === "success") {
    return {
      rail: "bg-[color:var(--sage)]",
      badge:
        "bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] text-[color:var(--sage-ink)]",
    };
  }
  return {
    rail: "bg-[color:var(--purple)]",
    badge: "bg-[color:var(--lavender-100)] text-[color:var(--purple-800)]",
  };
}

function reportText(state: QaRecorderState) {
  const lines = state.entries.map((entry) => {
    const actor = entry.actorLabel || entry.actorEmail || "Signed out";
    return [
      `[${entry.timestamp}] ${entry.level.toUpperCase()} ${KIND_LABEL[entry.kind]}: ${entry.title}`,
      `Actor: ${actor}`,
      `Page: ${entry.path || "Unknown"}`,
      `Detail: ${entry.detail}`,
      `Why: ${entry.explanation}`,
    ].join("\n");
  });
  return [
    "Click QA session report",
    `Started: ${state.startedAt || "Unknown"}`,
    `Exported: ${new Date().toISOString()}`,
    `Events: ${state.entries.length}`,
    "",
    ...lines.flatMap((line) => [line, ""]),
  ].join("\n");
}

export function QaTestingDrawer({ currentEmail }: { currentEmail: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [recorder, setRecorder] = useState<QaRecorderState>(EMPTY_RECORDER);
  const [checkpoint, setCheckpoint] = useState("");
  const [feedback, setFeedback] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const normalizedEmail = currentEmail?.trim().toLowerCase() || null;
  const persona = normalizedEmail ? findQaPersona(normalizedEmail) : null;
  const actorLabel = persona?.label ?? (normalizedEmail ? "Signed-in tester" : "Signed out");

  // Activate the richer capture only in browsers that passed the server-side
  // QA gate and therefore received this component from the root layout.
  useEffect(() => {
    setQaRecorderContext({ email: normalizedEmail, label: actorLabel });
    const previous = getQaRecorderState();
    const lastActor = previous.entries.at(-1)?.actorEmail ?? null;
    if (previous.entries.length === 0 || lastActor !== normalizedEmail) {
      recordQaActivity({
        kind: "checkpoint",
        level: "info",
        title: normalizedEmail ? `Testing as ${actorLabel}` : "Testing while signed out",
        detail: normalizedEmail ?? "No signed-in account",
        explanation: persona
          ? `Events after this point belong to the ${persona.role} test persona.`
          : "Events after this point belong to the signed-out or real-account test state.",
      });
    }

    const sync = () => setRecorder(getQaRecorderState());
    const frame = window.requestAnimationFrame(sync);
    const unsubscribe = subscribeQaRecorder(sync);
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
      setQaRecorderContext(null);
    };
  }, [actorLabel, normalizedEmail, persona]);

  // Next client navigations do not reload the root layout, so pathname is the
  // reliable signal that a new screen became visible to the tester.
  useEffect(() => {
    recordQaActivity({
      kind: "navigation",
      level: "info",
      title: `Opened ${pathname || "/"}`,
      detail: `The visible route changed to ${pathname || "/"}.`,
      explanation:
        "This marks the page context for the actions, requests, and errors that follow it.",
    });
  }, [pathname]);

  // Record intent without recording field values. Submit controls are handled
  // by the submit listener so one press creates one useful event, not two.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>('a, button, [role="button"]');
      if (
        !control ||
        control.closest(
          '[data-qa-recorder-ignore], [role="dialog"][aria-labelledby="qa-recorder-title"]',
        )
      ) {
        return;
      }
      if (
        control instanceof HTMLButtonElement &&
        control.form &&
        (control.getAttribute("type") ?? "submit") === "submit"
      ) {
        return;
      }

      const label = controlLabel(control);
      const isLink = control instanceof HTMLAnchorElement;
      let destination = "";
      if (isLink) {
        try {
          const url = new URL(control.href, window.location.href);
          destination = url.origin === window.location.origin ? url.pathname : url.origin;
        } catch {
          destination = "";
        }
      }
      recordQaActivity({
        kind: "interaction",
        level: "info",
        title: `${isLink ? "Opened" : "Selected"} ${label}`,
        detail: destination ? `Destination: ${destination}` : "The tester activated this control.",
        explanation: isLink
          ? "This records the navigation the tester requested. The next page event confirms where the app actually landed."
          : "This records tester intent. The request or page-state event that follows shows whether the action completed.",
      });
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (
        !form ||
        form.closest(
          '[data-qa-recorder-ignore], [role="dialog"][aria-labelledby="qa-recorder-title"]',
        )
      ) {
        return;
      }
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      const label = formLabel(form, submitter);
      recordQaActivity({
        kind: "interaction",
        level: "info",
        title: `Submitted ${label}`,
        detail: `${(form.method || "GET").toUpperCase()} ${form.action || window.location.pathname}`,
        explanation:
          "The form was submitted without storing any values typed into it. A request, redirect, or validation message should appear next.",
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  const problemCount = useMemo(
    () =>
      recorder.entries.filter((entry) => entry.level === "error" || entry.level === "warning")
        .length,
    [recorder.entries],
  );
  const errorCount = useMemo(
    () => recorder.entries.filter((entry) => entry.level === "error").length,
    [recorder.entries],
  );
  const visibleEntries = useMemo(
    () => recorder.entries.filter((entry) => entryMatches(entry, filter)).slice().reverse(),
    [filter, recorder.entries],
  );

  function addCheckpoint(event: React.FormEvent) {
    event.preventDefault();
    const note = checkpoint.trim();
    if (!note) return;
    recordQaActivity({
      kind: "checkpoint",
      level: "info",
      title: "Tester checkpoint",
      detail: note,
      explanation:
        "This note was added by the tester to preserve intent, an expected result, or the point where behaviour became surprising.",
    });
    setCheckpoint("");
    setFeedback("Checkpoint added");
  }

  function clearTimeline() {
    if (!window.confirm("Clear the recorded QA session in this browser tab?")) return;
    clearQaActivity();
    setFeedback("Session cleared");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText(recorder));
      setFeedback("Report copied");
    } catch {
      setFeedback("Could not copy the report");
    }
  }

  function exportReport() {
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...recorder,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `click-qa-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback("JSON exported");
  }

  return (
    <div data-qa-recorder-ignore>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open test recorder. ${problemCount} problems recorded.`}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-3 z-[75] flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--purple-800)] bg-[color:var(--purple)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--paper)] shadow-[0_8px_24px_rgba(45,35,105,0.28)] transition-transform hover:-translate-y-px lg:bottom-5 lg:left-5"
      >
        <Icon name="trend" size={16} stroke={2} />
        <span>Test record</span>
        {problemCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-[color:var(--paper)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[color:var(--danger)]">
            {problemCount > 99 ? "99+" : problemCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <ModalShell
          onClose={() => setOpen(false)}
          labelledBy="qa-recorder-title"
          describedBy="qa-recorder-description"
          initialFocusRef={closeRef}
          align="start"
          zIndex={130}
          className="!items-stretch !justify-start !p-0"
          cardClassName="flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden border-r border-[color:var(--line)] bg-[color:var(--champagne)] shadow-[var(--shadow-lg)]"
        >
          <header className="border-b border-[color:var(--line)] bg-[color:var(--paper)] px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--purple)]">
                    QA session recorder
                  </p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      recorder.enabled
                        ? "bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] text-[color:var(--sage-ink)]"
                        : "bg-[color:var(--champagne-deep)] text-[color:var(--slate)]"
                    }`}
                  >
                    {recorder.enabled ? "Recording" : "Paused"}
                  </span>
                </div>
                <h2
                  id="qa-recorder-title"
                  className="font-display mt-1 text-2xl font-semibold leading-tight text-[color:var(--ink)]"
                >
                  What happened, and why
                </h2>
                <p
                  id="qa-recorder-description"
                  className="mt-1 text-sm leading-5 text-[color:var(--slate)]"
                >
                  Actions, changed requests, warnings, and errors across test accounts in this tab.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close test recorder"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--purple)]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[color:var(--lavender-100)] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--purple-800)]">
                  Account
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[color:var(--ink)]">
                  {actorLabel}
                </p>
              </div>
              <div className="rounded-xl bg-[color:var(--champagne-deep)] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--slate)]">
                  Events
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[color:var(--ink)]">
                  {recorder.entries.length}
                </p>
              </div>
              <div className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,var(--paper))] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--danger)]">
                  Errors
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-[color:var(--danger)]">
                  {errorCount}
                </p>
              </div>
            </div>
          </header>

          <div className="border-b border-[color:var(--line)] bg-[color:var(--paper)] px-4 pb-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQaRecordingEnabled(!recorder.enabled)}
                className="ck-btn ck-btn--secondary ck-btn--sm"
              >
                {recorder.enabled ? "Pause" : "Resume"}
              </button>
              <button type="button" onClick={() => void copyReport()} className="ck-btn ck-btn--secondary ck-btn--sm">
                Copy report
              </button>
              <button type="button" onClick={exportReport} className="ck-btn ck-btn--secondary ck-btn--sm">
                Export JSON
              </button>
              <button
                type="button"
                onClick={clearTimeline}
                className="ml-auto text-xs font-semibold text-[color:var(--danger)] hover:underline"
              >
                Clear
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-[color:var(--ink-faint)]">
              Session length: {formatDuration(recorder.startedAt)}. Input values, cookies, request headers, and response bodies are not recorded.
            </p>
            {feedback ? (
              <p role="status" className="mt-1 text-[11px] font-semibold text-[color:var(--sage-ink)]">
                {feedback}
              </p>
            ) : null}
          </div>

          <form onSubmit={addCheckpoint} className="border-b border-[color:var(--line)] px-4 py-3 sm:px-5">
            <label htmlFor="qa-checkpoint" className="text-xs font-semibold text-[color:var(--ink)]">
              Add a checkpoint
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="qa-checkpoint"
                value={checkpoint}
                onChange={(event) => setCheckpoint(event.target.value)}
                placeholder="Expected result or what looked wrong"
                className="min-w-0 flex-1 rounded-xl border border-[color:var(--mist-strong)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink-faint)] focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]"
              />
              <button
                type="submit"
                disabled={!checkpoint.trim()}
                className="ck-btn ck-btn--primary ck-btn--sm whitespace-nowrap disabled:opacity-50"
              >
                Add note
              </button>
            </div>
          </form>

          <div className="border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 sm:px-5">
            <div role="tablist" aria-label="Filter recorded test events" className="flex gap-1.5 overflow-x-auto">
              {FILTERS.map((item) => {
                const selected = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(item.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? "bg-[color:var(--purple)] text-[color:var(--paper)]"
                        : "bg-[color:var(--paper)] text-[color:var(--slate)] hover:text-[color:var(--purple)]"
                    }`}
                  >
                    {item.label}
                    {item.id === "problems" && problemCount > 0 ? ` ${problemCount}` : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {visibleEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--mist-strong)] bg-[color:var(--paper)] p-6 text-center">
                <p className="font-display text-lg font-semibold text-[color:var(--ink)]">
                  {recorder.entries.length === 0 ? "No events recorded yet" : "Nothing in this filter"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[color:var(--slate)]">
                  {recorder.enabled
                    ? "Continue testing. Page changes, control presses, changed requests, warnings, and errors will appear here."
                    : "Resume recording to capture new test activity."}
                </p>
              </div>
            ) : (
              <ol className="grid gap-2.5">
                {visibleEntries.map((entry) => (
                  <QaTimelineRow key={entry.id} entry={entry} />
                ))}
              </ol>
            )}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function QaTimelineRow({ entry }: { entry: QaActivityEntry }) {
  const palette = eventPalette(entry);
  return (
    <li>
      <details className="group relative overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow-xs)]">
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${palette.rail}`} />
        <summary className="cursor-pointer list-none px-3 py-3 pl-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] ${palette.badge}`}
            >
              {KIND_LABEL[entry.kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-[color:var(--ink)]">{entry.title}</p>
              <div className="mt-1 flex flex-wrap gap-x-2 text-[10.5px] text-[color:var(--ink-faint)]">
                <time dateTime={entry.timestamp}>{formatClock(entry.timestamp)}</time>
                <span>{entry.actorLabel || entry.actorEmail || "Signed out"}</span>
                <span className="max-w-[15rem] truncate font-mono">{entry.path || "/"}</span>
              </div>
            </div>
            <Icon
              name="chevD"
              size={15}
              className="mt-1 shrink-0 text-[color:var(--ink-faint)] transition-transform group-open:rotate-180"
            />
          </div>
        </summary>
        <div className="border-t border-[color:var(--line)] px-4 py-3">
          <p className="break-words text-xs leading-5 text-[color:var(--slate)]">{entry.detail}</p>
          <div className="mt-3 rounded-xl bg-[color:var(--champagne)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--purple)]">
              Why this happened
            </p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--ink)]">{entry.explanation}</p>
          </div>
          {typeof entry.status === "number" ? (
            <p className="mt-2 font-mono text-[10.5px] text-[color:var(--ink-faint)]">
              HTTP {entry.status || "no response"}
              {typeof entry.duration === "number" ? ` in ${entry.duration} ms` : ""}
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}
