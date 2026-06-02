"use client";

/**
 * Report-a-Bug widget: a floating button (bottom-right) that opens a right-side
 * off-canvas panel with two tabs:
 *
 *   • Report  — auto-captures a viewport screenshot + the recent console logs and
 *               failed network requests, lets you describe and highlight the bug,
 *               and submits everything to /api/support/ticket.
 *   • Bugs (N) — the open bugs filed against THIS page; tick one off to mark it
 *               fixed (which also turns its Google Sheet row green).
 *
 * Importing this module also starts the always-on capture (side-effect import of
 * support-capture), so console/network history exists before the panel opens.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import "@/lib/support-capture";
import { getConsoleLogs, getCounts, getNetworkErrors } from "@/lib/support-capture";
import { captureViewport } from "@/lib/support-screenshot";

const ACCENT = "#7c6df2"; // lavender — bug brand
const ANNOTATION = "#B03824"; // brand red stroke

type Annotation = { id: string; x: number; y: number; w: number; h: number; label: string };
type Shot = { blob: Blob; objectUrl: string; width: number; height: number };
type OpenBug = {
  ticketRef: string;
  subject: string;
  message: string;
  expected: string | null;
  createdAt: string;
  reporterName: string | null;
  screenshotUrl: string | null;
};

function pageUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

function parseBrowserMetadata(): Record<string, string> {
  const ua = navigator.userAgent;
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /chrome|crios/i.test(ua)
      ? "Chrome"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /safari/i.test(ua)
          ? "Safari"
          : "Unknown";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /mac os|macintosh/i.test(ua)
      ? "macOS"
      : /android/i.test(ua)
        ? "Android"
        : /iphone|ipad|ipod/i.test(ua)
          ? "iOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Unknown";
  return {
    browser,
    os,
    user_agent: ua,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
  };
}

/** Bake annotation rectangles + labels into the screenshot, returning a JPEG blob. */
async function bakeAnnotations(shot: Shot, annotations: Annotation[]): Promise<Blob> {
  if (annotations.length === 0) return shot.blob;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = shot.objectUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = shot.width;
  canvas.height = shot.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return shot.blob;

  ctx.drawImage(img, 0, 0);
  ctx.lineWidth = Math.max(2, Math.round(shot.width / 400));
  ctx.strokeStyle = ANNOTATION;
  ctx.font = `${Math.max(12, Math.round(shot.width / 90))}px sans-serif`;

  for (const a of annotations) {
    ctx.strokeRect(a.x, a.y, a.w, a.h);
    if (a.label) {
      const padX = 6;
      const fontH = Math.max(14, Math.round(shot.width / 70));
      const textW = ctx.measureText(a.label).width;
      const pillY = Math.max(0, a.y - fontH - 6);
      ctx.fillStyle = ANNOTATION;
      ctx.fillRect(a.x, pillY, textW + padX * 2, fontH + 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(a.label, a.x + padX, pillY + fontH - 2);
    }
  }

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? shot.blob), "image/jpeg", 0.85),
  );
}

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"report" | "list">("report");

  // --- report state ---------------------------------------------------------
  const [message, setMessage] = useState("");
  const [expected, setExpected] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [counts, setCounts] = useState({ console: 0, network: 0 });
  const [includeConsole, setIncludeConsole] = useState(true);
  const [includeNetwork, setIncludeNetwork] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- annotation state -----------------------------------------------------
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Displayed-vs-natural scale for the screenshot — measured from the <img>, kept
  // in state (never read ref.current during render).
  const [dispScale, setDispScale] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (!el || !shot) return;
    setDispScale(el.getBoundingClientRect().width / shot.width);
  }, [shot]);

  // --- checklist state ------------------------------------------------------
  const [bugs, setBugs] = useState<OpenBug[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);

  const loadBugs = useCallback(async () => {
    setLoadingBugs(true);
    try {
      const res = await fetch(`/api/support/ticket?url=${encodeURIComponent(pageUrl())}`);
      if (res.ok) setBugs((await res.json()).bugs ?? []);
    } catch {
      /* non-fatal */
    } finally {
      setLoadingBugs(false);
    }
  }, []);

  const capture = useCallback(async () => {
    setCapturing(true);
    setAnnotations([]);
    try {
      const s = await captureViewport();
      setShot((prev) => {
        if (prev) URL.revokeObjectURL(prev.objectUrl);
        return { blob: s.blob, objectUrl: URL.createObjectURL(s.blob), width: s.width, height: s.height };
      });
      setCounts(getCounts());
    } catch (err) {
      console.warn("screenshot failed", err);
      toast.error("Couldn't capture a screenshot — you can still describe the bug.");
    } finally {
      setCapturing(false);
    }
  }, []);

  // On open: grab a fresh screenshot + the open-bug list for this page.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async loads on open
    void capture();
    void loadBugs();
  }, [open, capture, loadBugs]);

  // Keep the annotation overlay aligned with the displayed image on resize.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, measure]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing]);

  // Clean up the last object URL on unmount.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.objectUrl); }, [shot]);

  // --- annotation geometry --------------------------------------------------
  // Displayed image is scaled; convert pointer coords → image-pixel coords.
  function toImageCoords(clientX: number, clientY: number) {
    const el = imgRef.current;
    if (!el || !shot) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = shot.width / rect.width;
    const scaleY = shot.height / rect.height;
    return {
      x: Math.max(0, Math.min(shot.width, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(shot.height, (clientY - rect.top) * scaleY)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (editing) return;
    const p = toImageCoords(e.clientX, e.clientY);
    dragStart.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const p = toImageCoords(e.clientX, e.clientY);
    const s = dragStart.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }
  function onPointerUp() {
    const d = draft;
    dragStart.current = null;
    setDraft(null);
    if (!d || d.w < 8 || d.h < 8) return; // ignore tiny boxes
    const id = `a${annotations.length + 1}_${d.x | 0}`;
    setAnnotations((prev) => [...prev, { id, ...d, label: "" }]);
    setEditing(id);
  }

  async function submit() {
    if (!message.trim() || submitting) return;
    setSubmitting(true);

    // Build the payload from the current form state before we reset it. The
    // screenshot bake is local canvas work (fast); the network POST is the slow
    // part, so we fire that off in the background below.
    const form = new FormData();
    form.set("type", "bug");
    form.set("message", message.trim());
    if (expected.trim()) form.set("expected", expected.trim());
    if (shot) {
      const baked = await bakeAnnotations(shot, annotations);
      form.set("screenshot", baked, "screenshot.jpg");
      form.set("annotations", JSON.stringify(annotations.map(({ x, y, w, h, label }) => ({ x, y, w, h, label }))));
    }
    form.set(
      "client_metadata",
      JSON.stringify({
        ...parseBrowserMetadata(),
        url: pageUrl(),
        fullUrl: window.location.origin + pageUrl(),
      }),
    );
    if (includeConsole) form.set("console_logs", JSON.stringify(getConsoleLogs()));
    if (includeNetwork) form.set("network_errors", JSON.stringify(getNetworkErrors()));

    // Optimistic: confirm and reset right away so the user never waits on the
    // round-trip. The POST keeps running in the background and only surfaces a
    // toast if it actually fails.
    setMessage("");
    setExpected("");
    setAnnotations([]);
    setSubmitting(false);
    setTab("list");
    void capture();
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    } catch {
      /* confetti is optional */
    }
    toast.success("Bug reported");

    void (async () => {
      try {
        const res = await fetch("/api/support/ticket", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Submit failed");
        await loadBugs();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't submit the bug — please try again.");
      }
    })();
  }

  async function markFixed(ticketRef: string) {
    setFixing(ticketRef);
    try {
      const res = await fetch(`/api/support/ticket/${encodeURIComponent(ticketRef)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "fixed" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed");
      setBugs((prev) => prev.filter((b) => b.ticketRef !== ticketRef));
      toast.success("Marked fixed — Sheet row turned green.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the bug.");
    } finally {
      setFixing(null);
    }
  }

  return (
    <div data-support-widget>
      {/* Floating trigger */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Report a bug"
          className="fixed bottom-20 right-5 z-[80] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-105"
          style={{ backgroundColor: ACCENT }}
        >
          <BugIcon />
          <span>Report a bug</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Report a bug"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-black/10 bg-white shadow-2xl"
          >
            {/* Header */}
            <header
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ backgroundColor: ACCENT }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <BugIcon />
                <span>Report a bug</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:bg-white/20">
                <CloseIcon />
              </button>
            </header>

            {/* Tabs */}
            <nav className="flex border-b border-black/10 text-sm">
              <TabButton active={tab === "report"} onClick={() => setTab("report")}>Report</TabButton>
              <TabButton active={tab === "list"} onClick={() => setTab("list")}>
                Bugs on this page{bugs.length ? ` (${bugs.length})` : ""}
              </TabButton>
            </nav>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "report" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">What is wrong?</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={5000}
                      rows={3}
                      placeholder="What you did · what actually happened."
                      className="w-full resize-y rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      What should it do instead? <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={expected}
                      onChange={(e) => setExpected(e.target.value)}
                      maxLength={5000}
                      rows={2}
                      placeholder="The expected behaviour — helps the AI fixer know the target."
                      className="w-full resize-y rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-gray-500"
                    />
                  </div>

                  {/* Screenshot + annotation */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Screenshot</span>
                      <button
                        type="button"
                        onClick={() => void capture()}
                        className="text-xs text-gray-500 underline hover:text-gray-800"
                      >
                        Recapture
                      </button>
                    </div>
                    <p className="mb-2 text-xs text-gray-500">
                      Click and drag on the screenshot to highlight an area · {annotations.length} annotation
                      {annotations.length === 1 ? "" : "s"}
                    </p>

                    <div className="relative select-none overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                      {capturing && (
                        <div className="flex h-40 items-center justify-center text-sm text-gray-400">Capturing…</div>
                      )}
                      {!capturing && shot && (
                        <div className="relative" style={{ touchAction: "none" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- blob screenshot, not a remote asset */}
                          <img
                            ref={imgRef}
                            src={shot.objectUrl}
                            alt="Captured screenshot"
                            className="block w-full"
                            draggable={false}
                            onLoad={measure}
                          />
                          {/* SVG overlay for drawing/preview */}
                          <svg
                            className="absolute inset-0 h-full w-full cursor-crosshair"
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                          >
                            {annotations.map((a) => (
                              <g key={a.id}>
                                <rect
                                  x={a.x * dispScale}
                                  y={a.y * dispScale}
                                  width={a.w * dispScale}
                                  height={a.h * dispScale}
                                  fill="transparent"
                                  stroke={ANNOTATION}
                                  strokeWidth={2}
                                  className="cursor-pointer"
                                  onPointerDown={(e) => { e.stopPropagation(); setEditing(a.id); }}
                                />
                                {a.label && (
                                  <text x={a.x * dispScale + 2} y={a.y * dispScale - 4} fill={ANNOTATION} fontSize={11} fontWeight={600}>
                                    {a.label}
                                  </text>
                                )}
                              </g>
                            ))}
                            {draft && (
                              <rect
                                x={draft.x * dispScale}
                                y={draft.y * dispScale}
                                width={draft.w * dispScale}
                                height={draft.h * dispScale}
                                fill={`${ANNOTATION}22`}
                                stroke={ANNOTATION}
                                strokeWidth={2}
                                strokeDasharray="4 3"
                              />
                            )}
                          </svg>
                        </div>
                      )}
                      {!capturing && !shot && (
                        <div className="flex h-40 items-center justify-center text-sm text-gray-400">No screenshot</div>
                      )}
                    </div>

                    {/* Inline label editor for the selected annotation */}
                    {editing && annotations.some((a) => a.id === editing) && (
                      <AnnotationEditor
                        annotation={annotations.find((a) => a.id === editing)!}
                        onSave={(label) => {
                          setAnnotations((prev) => prev.map((a) => (a.id === editing ? { ...a, label } : a)));
                          setEditing(null);
                        }}
                        onDelete={() => {
                          setAnnotations((prev) => prev.filter((a) => a.id !== editing));
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    )}
                  </div>

                  {/* Diagnostics toggles */}
                  <div className="space-y-2 rounded-md bg-gray-50 p-3">
                    <Checkbox checked={includeConsole} onChange={setIncludeConsole} label={`Console logs (${counts.console})`} />
                    <Checkbox checked={includeNetwork} onChange={setIncludeNetwork} label={`Failed network requests (${counts.network})`} />
                  </div>

                  <button
                    type="button"
                    disabled={!message.trim() || submitting}
                    onClick={() => void submit()}
                    className="w-full rounded-md py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {submitting ? "Submitting…" : "Submit ticket"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">Open bugs reported on <code className="rounded bg-gray-100 px-1">{pageUrl()}</code>. Tick one off when it&apos;s fixed.</p>
                  {loadingBugs && <p className="text-sm text-gray-400">Loading…</p>}
                  {!loadingBugs && bugs.length === 0 && (
                    <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">No open bugs on this page. 🎉</p>
                  )}
                  {bugs.map((b) => (
                    <div key={b.ticketRef} className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3">
                      <button
                        type="button"
                        disabled={fixing === b.ticketRef}
                        onClick={() => void markFixed(b.ticketRef)}
                        title="Mark fixed"
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-red-400 bg-white transition hover:bg-green-100 disabled:opacity-50"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-gray-800">{b.message}</p>
                        {b.expected && (
                          <p className="mt-0.5 break-words text-xs text-gray-600">
                            <span className="font-medium">Should:</span> {b.expected}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {b.ticketRef}{b.reporterName ? ` · ${b.reporterName}` : ""}
                        </p>
                        {b.screenshotUrl && (
                          <a href={b.screenshotUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline" style={{ color: ACCENT }}>
                            View screenshot
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 font-medium transition ${active ? "border-b-2 text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
      style={active ? { borderColor: ACCENT } : undefined}
    >
      {children}
    </button>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#7c6df2]" />
      {label}
    </label>
  );
}

function AnnotationEditor({
  annotation,
  onSave,
  onDelete,
  onCancel,
}: {
  annotation: Annotation;
  onSave: (label: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(annotation.label);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(value);
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Label this area (optional)"
        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-gray-500"
      />
      <button type="button" onClick={() => onSave(value)} className="rounded px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: ACCENT }}>
        Save
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete annotation" className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
        Delete
      </button>
    </div>
  );
}

function BugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
      <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
