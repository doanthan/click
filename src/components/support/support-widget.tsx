"use client";

/**
 * Report-a-Bug widget: a floating button (bottom-right) that opens a right-side
 * off-canvas panel with two tabs:
 *
 *   • Report - auto-captures a viewport screenshot + the recent console logs and
 *               failed network requests, lets you describe and highlight the bug,
 *               and submits everything to /api/support/ticket.
 *   • Bugs (N) - the open bugs filed against THIS page; tick one off to mark it
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

// ACCENT used to be an off-palette #7c6df2, on the theory that a bug reporter
// should not look like Click chrome. But this widget mounts for EVERY visitor
// pre-launch (see layout.tsx), so the theory put the product's one hardcoded
// hex on top of every page, checkout included - and a floating periwinkle pill
// pulls more eye than the Deep Purple CTA beside it, not less. Deep Purple is
// the accent role in the DS; the bug glyph and the label are what say this is
// not a product action.
const ACCENT = "var(--purple)";
// The one colour that CANNOT be var(--token), and why. ANNOTATION is consumed
// by <canvas> (ctx.fillStyle / ctx.strokeStyle resolve a colour, not a custom
// property) and by SVG attributes built with hex-alpha concatenation
// (`${ANNOTATION}1a`), so a literal is genuinely required here. It is --danger
// verbatim (#B5362F) so the baked screenshot matches the red the drawer paints
// - anything on a plain DOM element uses the token instead.
const ANNOTATION = "#B5362F";

type Rect = { x: number; y: number; w: number; h: number };
type Annotation = { id: string; x: number; y: number; w: number; h: number; label: string };
type BugStatus = "open" | "ai_fixed" | "fixed" | "not_issue";
const BUG_STATUS_OPTIONS: { value: BugStatus; label: string }[] = [
  { value: "open", label: "Open - needs fixing" },
  { value: "ai_fixed", label: "AI fixed - verify" },
  { value: "fixed", label: "Fixed" },
  { value: "not_issue", label: "Not an issue" },
];

/** Build a bounds-clamped rect from two opposite corner points (handles flips). */
function rectFromCorners(ax: number, ay: number, bx: number, by: number, maxW: number, maxH: number): Rect {
  const x = Math.max(0, Math.min(ax, bx));
  const y = Math.max(0, Math.min(ay, by));
  const right = Math.min(maxW, Math.max(ax, bx));
  const bottom = Math.min(maxH, Math.max(ay, by));
  return { x, y, w: right - x, h: bottom - y };
}
type Shot = { blob: Blob; objectUrl: string; width: number; height: number };
type OpenBug = {
  ticketRef: string;
  subject: string;
  message: string;
  expected: string | null;
  createdAt: string;
  reporterName: string | null;
  screenshotUrl: string | null;
  aiFixed: boolean;
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
      ctx.fillStyle = "#ffffff"; // canvas literal: label text on the ANNOTATION pill
      ctx.fillText(a.label, a.x + padX, pillY + fontH - 2);
    }
  }

  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? shot.blob), "image/jpeg", 0.85),
  );
}

// `canTriage` is resolved on the server (see src/lib/support-access.ts) and
// decides whether the "Bugs on this page" tab exists at all. Anyone may REPORT;
// only an operator may read the queue, because a ticket carries the reporter's
// name and whatever they typed. This is presentation only - both the list and
// the triage mutations are enforced server-side.
export default function SupportWidget({ canTriage = false }: { canTriage?: boolean }) {
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
  // Exactly one highlight box at a time. Drawing a fresh box replaces it; it can
  // be moved (drag the body) or resized (drag a corner handle).
  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false); // label input focused - suppresses draw + Escape-close
  // Displayed-vs-natural scale for the screenshot - measured from the <img>, kept
  // in state (never read ref.current during render).
  const [dispScale, setDispScale] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Active pointer drag. `draw` and `resize` track an anchor (opposite corner);
  // `move` tracks the grab point + the box geometry at grab time.
  const dragRef = useRef<
    | { kind: "draw"; ax: number; ay: number }
    | { kind: "resize"; ax: number; ay: number }
    | { kind: "move"; px: number; py: number; orig: Rect }
    | null
  >(null);

  const measure = useCallback(() => {
    const el = imgRef.current;
    if (!el || !shot) return;
    const width = el.getBoundingClientRect().width;
    if (width > 0) setDispScale(width / shot.width);
  }, [shot]);

  // Keep the displayed-vs-natural scale fresh. Measuring only on the <img>
  // onLoad left dispScale stale when the drawer was still animating open, or
  // when the viewport/orientation changed afterwards - the annotation box then
  // rendered offset from the cursor and the dragger looked broken. A
  // ResizeObserver on the image plus a window resize listener re-measure on any
  // layout change so the drawn box always tracks the pointer.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !shot) return;
    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [shot, measure]);

  // --- checklist state ------------------------------------------------------
  const [bugs, setBugs] = useState<OpenBug[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  // The bug whose "Not fixed" note editor is open, plus its draft + in-flight flag.
  const [reopening, setReopening] = useState<string | null>(null);
  const [reopenNote, setReopenNote] = useState("");
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  // The bug whose inline edit form is open, plus its drafts + in-flight flag.
  const [editingBug, setEditingBug] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editExpected, setEditExpected] = useState("");
  const [editStatus, setEditStatus] = useState<BugStatus>("open");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadBugs = useCallback(async () => {
    if (!canTriage) return;
    setLoadingBugs(true);
    try {
      const res = await fetch(`/api/support/ticket?url=${encodeURIComponent(pageUrl())}`);
      if (res.ok) setBugs((await res.json()).bugs ?? []);
    } catch {
      /* non-fatal */
    } finally {
      setLoadingBugs(false);
    }
  }, [canTriage]);

  const capture = useCallback(async () => {
    setCapturing(true);
    setAnnotation(null);
    try {
      const s = await captureViewport();
      setShot((prev) => {
        if (prev) URL.revokeObjectURL(prev.objectUrl);
        return { blob: s.blob, objectUrl: URL.createObjectURL(s.blob), width: s.width, height: s.height };
      });
      setCounts(getCounts());
    } catch (err) {
      console.warn("screenshot failed", err);
      toast.error("Couldn't capture a screenshot - you can still describe the bug.");
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

  // Escape closes - plus the rest of what `aria-modal="true"` promises. The
  // panel claimed to be modal while doing none of it: Tab walked straight out
  // onto the page behind the scrim, nothing was focused on open, and closing
  // dumped you at the top of the document instead of back on the pill. This is
  // ModalShell's job everywhere else; the drawer geometry here is why it is
  // open-coded rather than a fourth hand-rolled copy of the whole primitive.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const raf = window.requestAnimationFrame(() => panelRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing) {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
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

  // Pointer down on empty canvas → start drawing a new box. (Grabs on the box body
  // or a corner handle set dragRef first, via their own handlers below, so this
  // bails out and doesn't start a competing draw.)
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (editing || !shot) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (dragRef.current) return; // a handle/body grab already claimed this drag
    const p = toImageCoords(e.clientX, e.clientY);
    dragRef.current = { kind: "draw", ax: p.x, ay: p.y };
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !shot) return;
    const p = toImageCoords(e.clientX, e.clientY);
    if (d.kind === "draw") {
      setDraft(rectFromCorners(d.ax, d.ay, p.x, p.y, shot.width, shot.height));
    } else if (d.kind === "resize") {
      const r = rectFromCorners(d.ax, d.ay, p.x, p.y, shot.width, shot.height);
      setAnnotation((a) => (a ? { ...a, ...r } : a));
    } else {
      const nx = Math.max(0, Math.min(shot.width - d.orig.w, d.orig.x + (p.x - d.px)));
      const ny = Math.max(0, Math.min(shot.height - d.orig.h, d.orig.y + (p.y - d.py)));
      setAnnotation((a) => (a ? { ...a, x: nx, y: ny } : a));
    }
  }
  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind !== "draw") return;
    const r = draft;
    setDraft(null);
    if (!r || r.w < 8 || r.h < 8) return; // ignore tiny boxes - keep any existing one
    setAnnotation({ id: "box", ...r, label: "" });
    setEditing(true);
  }

  // Begin resizing from a corner handle: the anchor is the opposite corner.
  function startResize(anchorX: number, anchorY: number) {
    if (editing) return;
    dragRef.current = { kind: "resize", ax: anchorX, ay: anchorY };
  }
  // Begin moving the whole box.
  function startMove(e: React.PointerEvent) {
    if (editing || !annotation) return;
    const p = toImageCoords(e.clientX, e.clientY);
    dragRef.current = {
      kind: "move",
      px: p.x,
      py: p.y,
      orig: { x: annotation.x, y: annotation.y, w: annotation.w, h: annotation.h },
    };
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
      const list = annotation ? [annotation] : [];
      const baked = await bakeAnnotations(shot, list);
      form.set("screenshot", baked, "screenshot.jpg");
      form.set("annotations", JSON.stringify(list.map(({ x, y, w, h, label }) => ({ x, y, w, h, label }))));
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
    // toast if it actually fails. Close the drawer and reset to the default
    // (Report) tab so the widget is back to normal for the next open.
    setMessage("");
    setExpected("");
    setAnnotation(null);
    setSubmitting(false);
    setTab("report");
    setOpen(false);
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
        toast.error(err instanceof Error ? err.message : "Couldn't submit the bug - please try again.");
      }
    })();
  }

  function markFixed(ticketRef: string) {
    // Optimistic: drop the bug from the list the instant it's ticked, so there's
    // zero lag. The PATCH runs in the background - only if it fails do we slot the
    // bug back exactly where it was and surface an error.
    const index = bugs.findIndex((b) => b.ticketRef === ticketRef);
    if (index === -1) return;
    const bug = bugs[index];
    setBugs((prev) => prev.filter((b) => b.ticketRef !== ticketRef));

    void (async () => {
      try {
        const res = await fetch(`/api/support/ticket/${encodeURIComponent(ticketRef)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "fixed" }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed");
      } catch (err) {
        setBugs((prev) => {
          if (prev.some((b) => b.ticketRef === ticketRef)) return prev; // already back
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, bug);
          return next;
        });
        toast.error(err instanceof Error ? err.message : "Couldn't update the bug.");
      }
    })();
  }

  function openReopen(ticketRef: string) {
    setEditingBug(null);
    setReopening((cur) => (cur === ticketRef ? null : ticketRef));
    setReopenNote("");
  }

  function openEdit(bug: OpenBug) {
    setReopening(null);
    setEditingBug((cur) => (cur === bug.ticketRef ? null : bug.ticketRef));
    setEditMessage(bug.message);
    setEditExpected(bug.expected ?? "");
    // Listed bugs are always open; aiFixed just means "AI says fixed - verify".
    setEditStatus(bug.aiFixed ? "ai_fixed" : "open");
  }

  async function submitEdit(ticketRef: string) {
    const message = editMessage.trim();
    if (!message || editSubmitting) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/support/ticket/${encodeURIComponent(ticketRef)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "edit", message, expected: editExpected.trim(), bugStatus: editStatus }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed");
      setEditingBug(null);
      toast.success("Bug updated");
      await loadBugs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the bug.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function submitNotFixed(ticketRef: string) {
    const note = reopenNote.trim();
    if (!note || reopenSubmitting) return;
    setReopenSubmitting(true);
    try {
      const res = await fetch(`/api/support/ticket/${encodeURIComponent(ticketRef)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open", note }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed");
      setReopening(null);
      setReopenNote("");
      toast.success("Sent back to the AI fixer");
      await loadBugs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the bug.");
    } finally {
      setReopenSubmitting(false);
    }
  }

  return (
    <div data-support-widget>
      {/* Floating trigger. bottom-20 alone sat ON the mobile bottom nav once a
          notched phone added its safe-area inset (56px tabs + ~34px inset >
          80px), so the offset carries the inset too. Above lg the nav is gone.
          rounded-xl is radius-12: in this DS a pill is a tag or an avatar, and
          this is a button, so it wears the one button footprint. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Report a bug"
          className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[80] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[color:var(--champagne)] shadow-lg transition hover:scale-105 lg:bottom-5"
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
            className="absolute inset-0 bg-[color:var(--ink)]/30 backdrop-blur-[1px]"
          />
          <aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Report a bug"
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[color:var(--line)] bg-[color:var(--paper)] shadow-2xl outline-none"
          >
            {/* Header */}
            <header
              className="flex items-center justify-between px-4 py-3 text-[color:var(--champagne)]"
              style={{ backgroundColor: ACCENT }}
            >
              <div className="flex items-center gap-2 font-semibold">
                <BugIcon />
                <span>Report a bug</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:bg-[color-mix(in_srgb,var(--paper)_20%,transparent)]">
                <CloseIcon />
              </button>
            </header>

            {/* Tabs */}
            <nav className="flex border-b border-[color:var(--line)] text-sm">
              <TabButton active={tab === "report"} onClick={() => setTab("report")}>Report</TabButton>
              {canTriage ? (
                <TabButton active={tab === "list"} onClick={() => setTab("list")}>
                  Bugs on this page{bugs.length ? ` (${bugs.length})` : ""}
                </TabButton>
              ) : null}
            </nav>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === "report" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[color:var(--ink-soft)]">What is wrong?</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={5000}
                      rows={3}
                      placeholder="What you did · what actually happened."
                      className="w-full resize-y rounded-md border border-[color:var(--line)] p-2 text-sm outline-none focus:border-[color:var(--slate)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[color:var(--ink-soft)]">
                      What should it do instead? <span className="font-normal text-[color:var(--ink-faint)]">(optional)</span>
                    </label>
                    <textarea
                      value={expected}
                      onChange={(e) => setExpected(e.target.value)}
                      maxLength={5000}
                      rows={2}
                      placeholder="What you expected to happen instead."
                      className="w-full resize-y rounded-md border border-[color:var(--line)] p-2 text-sm outline-none focus:border-[color:var(--slate)]"
                    />
                  </div>

                  {/* Screenshot + annotation */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-[color:var(--ink-soft)]">Screenshot</span>
                      <button
                        type="button"
                        onClick={() => void capture()}
                        className="text-xs text-[color:var(--slate)] underline hover:text-[color:var(--ink)]"
                      >
                        Recapture
                      </button>
                    </div>
                    <p className="mb-2 text-xs text-[color:var(--slate)]">
                      {annotation
                        ? "Drag a corner to resize, or drag the box to move it. Draw again to start over."
                        : "Click and drag on the screenshot to highlight one area."}
                    </p>

                    <div className="relative select-none overflow-hidden rounded-md border border-[color:var(--line-soft)] bg-[color:var(--champagne)]">
                      {capturing && (
                        <div className="flex h-40 items-center justify-center text-sm text-[color:var(--ink-faint)]">Capturing…</div>
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
                            {/* Committed box (hidden while drafting a replacement) */}
                            {!draft && annotation && (
                              <g>
                                <rect
                                  x={annotation.x * dispScale}
                                  y={annotation.y * dispScale}
                                  width={annotation.w * dispScale}
                                  height={annotation.h * dispScale}
                                  fill={`${ANNOTATION}1a`}
                                  stroke={ANNOTATION}
                                  strokeWidth={2}
                                  className="cursor-move"
                                  onPointerDown={startMove}
                                />
                                {annotation.label && (
                                  <text
                                    x={annotation.x * dispScale + 2}
                                    y={annotation.y * dispScale - 4}
                                    fill={ANNOTATION}
                                    fontSize={11}
                                    fontWeight={600}
                                  >
                                    {annotation.label}
                                  </text>
                                )}
                                {/* Corner resize handles - anchor is the opposite corner */}
                                {(
                                  [
                                    ["nw", annotation.x, annotation.y, annotation.x + annotation.w, annotation.y + annotation.h, "nwse-resize"],
                                    ["ne", annotation.x + annotation.w, annotation.y, annotation.x, annotation.y + annotation.h, "nesw-resize"],
                                    ["sw", annotation.x, annotation.y + annotation.h, annotation.x + annotation.w, annotation.y, "nesw-resize"],
                                    ["se", annotation.x + annotation.w, annotation.y + annotation.h, annotation.x, annotation.y, "nwse-resize"],
                                  ] as const
                                ).map(([key, hx, hy, ax, ay, cursor]) => (
                                  <rect
                                    key={key}
                                    x={hx * dispScale - 5}
                                    y={hy * dispScale - 5}
                                    width={10}
                                    height={10}
                                    fill="var(--paper)"
                                    stroke={ANNOTATION}
                                    strokeWidth={2}
                                    style={{ cursor }}
                                    onPointerDown={() => startResize(ax, ay)}
                                  />
                                ))}
                              </g>
                            )}
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
                        <div className="flex h-40 items-center justify-center text-sm text-[color:var(--ink-faint)]">No screenshot</div>
                      )}
                    </div>

                    {/* Inline label editor for the box */}
                    {annotation && (
                      <AnnotationEditor
                        value={annotation.label}
                        onChange={(label) => setAnnotation((a) => (a ? { ...a, label } : a))}
                        onDelete={() => { setAnnotation(null); setEditing(false); }}
                        onFocus={() => setEditing(true)}
                        onBlur={() => setEditing(false)}
                      />
                    )}
                  </div>

                  {/* Diagnostics toggles */}
                  <div className="space-y-2 rounded-md bg-[color:var(--champagne)] p-3">
                    <Checkbox checked={includeConsole} onChange={setIncludeConsole} label={`Console logs (${counts.console})`} />
                    <Checkbox checked={includeNetwork} onChange={setIncludeNetwork} label={`Failed network requests (${counts.network})`} />
                  </div>

                  <button
                    type="button"
                    disabled={!message.trim() || submitting}
                    onClick={() => void submit()}
                    className="w-full rounded-md py-2.5 text-sm font-semibold text-[color:var(--champagne)] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {submitting ? "Submitting…" : "Submit ticket"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[color:var(--slate)]">Open bugs reported on <code className="rounded bg-[color:var(--champagne-deep)] px-1">{pageUrl()}</code>. Tick one off when it&apos;s fixed, <span className="font-medium">Edit</span> to refine it, or hit <span className="font-medium">Not fixed</span> to send it back to the AI.</p>
                  {loadingBugs && <p className="text-sm text-[color:var(--ink-faint)]">Loading…</p>}
                  {!loadingBugs && bugs.length === 0 && (
                    <p className="rounded-md bg-[color-mix(in_srgb,var(--sage)_10%,var(--paper))] p-3 text-sm text-[color:var(--sage-ink)]">No open bugs on this page. 🎉</p>
                  )}
                  {bugs.map((b) => (
                    <div key={b.ticketRef} className="flex gap-3 rounded-md border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper))] p-3">
                      <button
                        type="button"
                        onClick={() => markFixed(b.ticketRef)}
                        title="Mark fixed"
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-[color-mix(in_srgb,var(--danger)_55%,transparent)] bg-[color:var(--paper)] transition hover:bg-[color-mix(in_srgb,var(--sage)_16%,var(--paper))]"
                      />
                      <div className="min-w-0 flex-1">
                        {b.aiFixed && (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--amber)_16%,var(--paper))] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--amber-ink)]">
                            AI says fixed - verify
                          </span>
                        )}
                        {editingBug !== b.ticketRef && (
                          <>
                            <p className="whitespace-pre-wrap break-words text-sm font-medium text-[color:var(--ink)]">{b.message}</p>
                            {b.expected && (
                              <p className="mt-0.5 break-words text-xs text-[color:var(--slate)]">
                                <span className="font-medium">Should:</span> {b.expected}
                              </p>
                            )}
                          </>
                        )}
                        <p className="mt-1 text-xs text-[color:var(--slate)]">
                          {b.ticketRef}{b.reporterName ? ` · ${b.reporterName}` : ""}
                        </p>
                        <div className="mt-1 flex items-center gap-3">
                          {b.screenshotUrl && (
                            // screenshot_url is a PRIVATE-bucket object KEY ("support/<ref>.jpg"),
                            // not a URL. Linking it straight resolved relative to the current page
                            // and 404'd. Go through the route that mints a 60-second signed URL -
                            // the same link the Sheet uses.
                            <a
                              href={`/api/support/ticket/${encodeURIComponent(b.ticketRef)}/screenshot`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block text-xs underline"
                              style={{ color: ACCENT }}
                            >
                              View screenshot
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            className="text-xs font-medium underline hover:opacity-80"
                            style={{ color: ACCENT }}
                          >
                            {editingBug === b.ticketRef ? "Cancel" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openReopen(b.ticketRef)}
                            className="text-xs font-medium text-[color:var(--danger)] underline hover:text-[color:var(--danger)]"
                          >
                            {reopening === b.ticketRef ? "Cancel" : "Not fixed →"}
                          </button>
                        </div>

                        {editingBug === b.ticketRef && (
                          <div className="mt-2 space-y-2 rounded-md border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-[color:var(--ink-soft)]">What is wrong?</label>
                              <textarea
                                autoFocus
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                maxLength={5000}
                                rows={3}
                                className="w-full resize-y rounded-md border border-[color:var(--line)] p-2 text-sm outline-none focus:border-[color:var(--slate)]"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-[color:var(--ink-soft)]">
                                What should it do instead? <span className="font-normal text-[color:var(--ink-faint)]">(optional)</span>
                              </label>
                              <textarea
                                value={editExpected}
                                onChange={(e) => setEditExpected(e.target.value)}
                                maxLength={5000}
                                rows={2}
                                className="w-full resize-y rounded-md border border-[color:var(--line)] p-2 text-sm outline-none focus:border-[color:var(--slate)]"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-[color:var(--ink-soft)]">Status</label>
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as BugStatus)}
                                className="w-full rounded-md border border-[color:var(--line)] bg-[color:var(--paper)] p-2 text-sm outline-none focus:border-[color:var(--slate)]"
                              >
                                {BUG_STATUS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingBug(null)}
                                className="rounded px-2 py-1 text-xs font-medium text-[color:var(--slate)] hover:text-[color:var(--ink)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!editMessage.trim() || editSubmitting}
                                onClick={() => void submitEdit(b.ticketRef)}
                                className="rounded px-3 py-1 text-xs font-semibold text-[color:var(--champagne)] transition disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ backgroundColor: ACCENT }}
                              >
                                {editSubmitting ? "Saving…" : "Save changes"}
                              </button>
                            </div>
                          </div>
                        )}

                        {reopening === b.ticketRef && (
                          <div className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color:var(--paper)] p-2">
                            <label className="mb-1 block text-xs font-medium text-[color:var(--ink-soft)]">
                              What&apos;s still wrong? <span className="font-normal text-[color:var(--ink-faint)]"> - the AI will pick it up again</span>
                            </label>
                            <textarea
                              autoFocus
                              value={reopenNote}
                              onChange={(e) => setReopenNote(e.target.value)}
                              maxLength={5000}
                              rows={3}
                              placeholder="Describe what still doesn't work, so the AI fixer knows what to retry."
                              className="w-full resize-y rounded-md border border-[color:var(--line)] p-2 text-sm outline-none focus:border-[color:var(--slate)]"
                            />
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openReopen(b.ticketRef)}
                                className="rounded px-2 py-1 text-xs font-medium text-[color:var(--slate)] hover:text-[color:var(--ink)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!reopenNote.trim() || reopenSubmitting}
                                onClick={() => void submitNotFixed(b.ticketRef)}
                                className="rounded px-3 py-1 text-xs font-semibold text-[color:var(--champagne)] transition disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ backgroundColor: "var(--danger)" }}
                              >
                                {reopenSubmitting ? "Sending…" : "Send back to AI"}
                              </button>
                            </div>
                          </div>
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
      className={`flex-1 px-3 py-2 font-medium transition ${active ? "border-b-2 text-[color:var(--ink)]" : "text-[color:var(--slate)] hover:text-[color:var(--ink-soft)]"}`}
      style={active ? { borderColor: ACCENT } : undefined}
    >
      {children}
    </button>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--ink-soft)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: ACCENT }}
        className="h-4 w-4" />
      {label}
    </label>
  );
}

function AnnotationEditor({
  value,
  onChange,
  onDelete,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (label: string) => void;
  onDelete: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
        placeholder="Label this box (optional)"
        className="flex-1 rounded border border-[color:var(--line)] px-2 py-1 text-sm outline-none focus:border-[color:var(--slate)]"
      />
      <button type="button" onClick={onDelete} aria-label="Delete box" className="rounded px-2 py-1 text-xs font-semibold text-[color:var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper))]">
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
