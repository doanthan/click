"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type EventSuccessDetails = {
  title: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  suburb: string;
  slug: string;
  calendarUrl: string;
};

// Self-contained canvas confetti — avoids pulling in a dependency. Spawns a
// burst of physics-y particles that fall + fade over ~2.5s, then stops the RAF
// loop so we don't keep painting an idle canvas.
function runConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const g = ctx; // non-null capture so nested closures keep the narrowing

  // Canvas needs literal colours - these mirror the DS tokens (--lavender,
  // --purple, --sage, --amber, --coral) since var() can't reach into 2D paint.
  const colors = ["#C8B8F8", "#3B2F81", "#5B8C6E", "#E0A33A", "#E8674C"];
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const w = () => canvas.width / dpr;
  const count = 160;
  const particles = Array.from({ length: count }, (_, i) => ({
    x: w() / 2 + (Math.random() - 0.5) * w() * 0.4,
    y: window.innerHeight * 0.35 + (Math.random() - 0.5) * 80,
    vx: (Math.random() - 0.5) * 12,
    vy: Math.random() * -14 - 4,
    size: Math.random() * 8 + 4,
    color: colors[i % colors.length],
    rot: Math.random() * Math.PI,
    vrot: (Math.random() - 0.5) * 0.3,
  }));

  let raf = 0;
  let frame = 0;
  const maxFrames = 160;
  const gravity = 0.45;

  function tick() {
    frame += 1;
    g.clearRect(0, 0, w(), window.innerHeight);
    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vrot;
      const alpha = Math.max(0, 1 - frame / maxFrames);
      g.save();
      g.globalAlpha = alpha;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      g.restore();
    }
    if (frame < maxFrames) {
      raf = requestAnimationFrame(tick);
    } else {
      g.clearRect(0, 0, w(), window.innerHeight);
    }
  }
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}

export function EventRsvpSuccessOverlay({
  details,
  onClose,
}: {
  details: EventSuccessDetails;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stop = canvas ? runConfetti(canvas) : undefined;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      stop?.();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsvp-success-title"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-[color:var(--surface-deep)]/70 backdrop-blur-sm" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />

      <div className="relative w-full max-w-md rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-7 text-center shadow-[var(--shadow-lg)]">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-lg text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
        >
          ✕
        </button>

        <p className="eyebrow">Click ✷</p>
        <h2
          id="rsvp-success-title"
          className="font-display mt-2 text-4xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]"
        >
          You&apos;re in!
        </h2>

        <div className="mt-5 rounded-2xl bg-[color:var(--champagne-deep)] p-5 text-left">
          <p className="font-display text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
            {details.title}
          </p>
          <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
            {details.dateLabel}
          </p>
          <p className="text-sm font-medium text-[color:var(--slate)]">
            {details.timeLabel}
          </p>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ink)]">
            {details.location}
          </p>
          <p className="text-sm font-medium text-[color:var(--slate)]">
            {details.suburb}
          </p>
        </div>

        <div className="mt-6 grid gap-2">
          <a
            href={details.calendarUrl}
            target="_blank"
            rel="noreferrer"
            className="ck-btn ck-btn--md ck-btn--full ck-btn--primary"
          >
            Add to calendar
          </a>
          <Link
            href="/confirmed-events"
            className="ck-btn ck-btn--md ck-btn--full ck-btn--secondary"
          >
            See my confirmed events
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="ck-btn ck-btn--md ck-btn--full ck-btn--ghost"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
