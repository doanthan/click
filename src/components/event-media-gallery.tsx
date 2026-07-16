"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { MediaItem } from "@/lib/event-media";

type EventMediaGalleryProps = {
  items: MediaItem[];
  statusLabel?: string;
  categoryLabel?: string;
};

/**
 * Editorial-style 5-tile mosaic with a fullscreen lightbox.
 *
 * Layout:
 * - Mobile (<sm): single hero + horizontal thumb strip + "View all" pill
 * - Tablet (sm–lg): 2×2 grid with hero spanning + "View all" pill
 * - Desktop (lg+): 4-col × 2-row mosaic — small | hero(2×2) | small | small,
 *                  with the second small column stacked below the first.
 *
 * Each tile is an independent card (radius-lg + soft shadow) to match the
 * Click DS instead of the tight-edged stock-photo mosaic.
 * Video tiles render a play affordance over the poster image; clicking opens
 * a fullscreen `<video controls autoplay>` in the lightbox.
 */
export function EventMediaGallery({ items, statusLabel, categoryLabel }: EventMediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);
  const next = useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? current : (current + 1) % items.length,
    );
  }, [items.length]);
  const prev = useCallback(() => {
    setLightboxIndex((current) =>
      current === null ? current : (current - 1 + items.length) % items.length,
    );
  }, [items.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") prev();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxIndex, close, next, prev]);

  if (items.length === 0) return null;

  const count = items.length;
  const visible = items.slice(0, 5);
  const extraCount = Math.max(0, count - 5);
  const [m1, m2, m3, m4, m5] = visible;
  const open = (index: number) => () => setLightboxIndex(index);

  // Shared chrome so every count-specific layout gets the same chips overlay
  // and lightbox without duplicating the markup.
  const chips =
    statusLabel || categoryLabel ? (
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-3">
        {statusLabel ? (
          <span className="ck-badge pointer-events-auto bg-[rgba(28,24,48,0.62)] text-white">{statusLabel}</span>
        ) : (
          <span />
        )}
        {categoryLabel ? (
          <span className="ck-badge pointer-events-auto bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]">
            {categoryLabel}
          </span>
        ) : null}
      </div>
    ) : null;

  const lightbox =
    lightboxIndex !== null ? (
      <Lightbox items={items} index={lightboxIndex} onClose={close} onNext={next} onPrev={prev} />
    ) : null;

  // Layout adapts to how many photos the merchant actually uploaded — no sparse
  // mosaic with empty hero slots when there are only 2–4, no stock fillers.

  // 1 → one honest full-width hero (no "view all").
  if (count === 1) {
    return (
      <section aria-label="Event photos" className="relative">
        {chips}
        <Tile item={m1} onOpen={open(0)} priority className="aspect-[4/5] w-full sm:aspect-[16/9]" />
        {lightbox}
      </section>
    );
  }

  // 2 → side-by-side pair (stacks on mobile).
  if (count === 2) {
    return (
      <section aria-label="Event photos" className="relative">
        {chips}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Tile item={m1} onOpen={open(0)} priority className="aspect-[4/3]" />
          <Tile item={m2} onOpen={open(1)} priority className="aspect-[4/3]" />
        </div>
        {lightbox}
      </section>
    );
  }

  // 3 → three equal columns (stacks on mobile).
  if (count === 3) {
    return (
      <section aria-label="Event photos" className="relative">
        {chips}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile item={m1} onOpen={open(0)} priority className="aspect-[4/5] sm:aspect-[3/4]" />
          <Tile item={m2} onOpen={open(1)} priority className="aspect-[4/5] sm:aspect-[3/4]" />
          <Tile item={m3} onOpen={open(2)} className="aspect-[4/5] sm:aspect-[3/4]" />
        </div>
        {lightbox}
      </section>
    );
  }

  // 4 → even 2×2 grid.
  if (count === 4) {
    return (
      <section aria-label="Event photos" className="relative">
        {chips}
        <div className="grid grid-cols-2 gap-3">
          <Tile item={m1} onOpen={open(0)} priority className="aspect-square" />
          <Tile item={m2} onOpen={open(1)} priority className="aspect-square" />
          <Tile item={m3} onOpen={open(2)} className="aspect-square" />
          <Tile item={m4} onOpen={open(3)} className="aspect-square" />
        </div>
        {lightbox}
      </section>
    );
  }

  // 5+ → editorial mosaic with a "view all" pill for the overflow.
  return (
    <section aria-label="Event photos and videos" className="relative">
      {/* Floating chips overlay the gallery top-row */}
      {chips}

      {/* Desktop mosaic: 4 cols × 2 rows, hero spans center 2×2 */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4 lg:grid-rows-2">
        <Tile item={m1} onOpen={() => setLightboxIndex(0)} priority className="aspect-square" />
        {m3 ? (
          <Tile
            item={m3}
            onOpen={() => setLightboxIndex(2)}
            priority
            className="col-span-2 row-span-2 aspect-square h-full w-full"
          />
        ) : null}
        {m4 ? (
          <Tile item={m4} onOpen={() => setLightboxIndex(3)} className="aspect-square" />
        ) : null}
        {m2 ? (
          <Tile item={m2} onOpen={() => setLightboxIndex(1)} className="aspect-square" />
        ) : null}
        {m5 ? (
          <Tile
            item={m5}
            onOpen={() => setLightboxIndex(4)}
            extraCount={extraCount}
            className="aspect-square"
          />
        ) : null}
      </div>

      {/* Tablet: 2×2 grid */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 sm:grid-rows-2 lg:hidden">
        <Tile
          item={m1}
          onOpen={() => setLightboxIndex(0)}
          priority
          className="row-span-2 aspect-[3/4]"
        />
        {m3 ? <Tile item={m3} onOpen={() => setLightboxIndex(2)} className="aspect-[5/3]" /> : null}
        {m4 ? (
          <Tile
            item={m4}
            onOpen={() => setLightboxIndex(3)}
            extraCount={extraCount + (m5 ? 1 : 0) + (m2 ? 1 : 0)}
            className="aspect-[5/3]"
          />
        ) : null}
      </div>

      {/* Mobile: single hero */}
      <div className="sm:hidden">
        <Tile
          item={m1}
          onOpen={() => setLightboxIndex(0)}
          priority
          className="aspect-[4/5] w-full"
        />
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="ck-btn ck-btn--sm ck-btn--secondary mt-3 w-full"
        >
          View all {items.length} photos
        </button>
      </div>

      {/* "View all" pill on desktop/tablet (bottom-right corner of mosaic) */}
      <button
        type="button"
        onClick={() => setLightboxIndex(0)}
        className="absolute bottom-3 right-3 z-10 hidden items-center gap-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--champagne)_92%,transparent)] px-4 py-2 text-[13px] font-semibold text-[color:var(--ink)] shadow-[var(--shadow-sm)] transition hover:bg-[color:var(--paper)] sm:inline-flex"
      >
        <GridIcon className="size-3.5" />
        View all {items.length}
      </button>

      {lightboxIndex !== null ? (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={close}
          onNext={next}
          onPrev={prev}
        />
      ) : null}
    </section>
  );
}

function Tile({
  item,
  onOpen,
  priority,
  className = "",
  extraCount = 0,
}: {
  item: MediaItem;
  onOpen: () => void;
  priority?: boolean;
  className?: string;
  extraCount?: number;
}) {
  const poster = item.kind === "video" ? item.posterUrl : item.url;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative block overflow-hidden rounded-[var(--radius-lg)] bg-[color:var(--champagne-deep)] shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--purple)] ${className}`}
      aria-label={item.kind === "video" ? `Play video: ${item.alt}` : `Open photo: ${item.alt}`}
    >
      <Image
        src={poster}
        alt={item.alt}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        priority={priority}
      />
      {item.kind === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--champagne)_92%,transparent)] shadow-[var(--shadow-sm)] transition group-hover:scale-110">
            <PlayIcon className="size-6 translate-x-0.5 text-[color:var(--ink)]" />
          </span>
        </span>
      ) : null}
      {extraCount > 0 ? (
        <span className="absolute inset-0 flex items-center justify-center bg-[color:var(--ink)]/55 backdrop-blur-[1px]">
          <span className="font-display text-3xl font-semibold tracking-[-0.025em] text-[color:var(--on-deep)]">
            +{extraCount}
          </span>
        </span>
      ) : null}
    </button>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onNext,
  onPrev,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const item = items[index];
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[color:var(--ink)]/95"
      role="dialog"
      aria-modal="true"
      aria-label="Event media viewer"
    >
      <div className="flex items-center justify-between px-4 py-3 text-[color:var(--on-deep)] sm:px-6">
        <span className="text-xs font-semibold tabular-nums">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--champagne)_14%,transparent)] px-4 py-1.5 text-[13px] font-semibold text-[color:var(--on-deep)] transition hover:bg-[color-mix(in_srgb,var(--champagne)_26%,transparent)]"
        >
          Close
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-6 sm:px-12">
        {items.length > 1 ? (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous"
            className="absolute left-2 z-10 flex size-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--champagne)_14%,transparent)] text-[color:var(--on-deep)] transition hover:bg-[color-mix(in_srgb,var(--champagne)_26%,transparent)] sm:left-6"
          >
            <ChevronIcon className="size-5 rotate-180" />
          </button>
        ) : null}

        <div className="relative h-full max-h-[80vh] w-full max-w-5xl">
          {item.kind === "video" ? (
            <video
              key={item.url}
              controls
              autoPlay
              playsInline
              poster={item.posterUrl}
              className="h-full w-full rounded-2xl bg-black object-contain"
            >
              <source src={item.url} />
              Your browser can&apos;t play this video.
            </video>
          ) : (
            <Image
              key={item.url}
              src={item.url}
              alt={item.alt}
              fill
              sizes="(min-width: 1024px) 960px, 100vw"
              className="rounded-2xl object-contain"
              priority
            />
          )}
        </div>

        {items.length > 1 ? (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next"
            className="absolute right-2 z-10 flex size-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--champagne)_14%,transparent)] text-[color:var(--on-deep)] transition hover:bg-[color-mix(in_srgb,var(--champagne)_26%,transparent)] sm:right-6"
          >
            <ChevronIcon className="size-5" />
          </button>
        ) : null}
      </div>

      <p className="px-4 pb-6 text-center text-sm font-medium text-[color:var(--on-deep-soft)] sm:px-12">
        {item.alt}
      </p>
    </div>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
