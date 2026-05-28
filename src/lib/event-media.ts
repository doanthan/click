/**
 * Event media gallery — for now we derive a 5-tile gallery from the single
 * `image_url` stored on `events` plus deterministic category-themed fillers
 * pulled from the bundled stock photo set in `/public/media`.
 *
 * Type supports `kind: "video"` so the gallery component renders posters and
 * play affordances correctly. When an `event_media` table is added, swap
 * `buildEventMediaGallery` to read from it — the consumers won't change.
 */

export type MediaImage = {
  kind: "image";
  url: string;
  alt: string;
};

export type MediaVideo = {
  kind: "video";
  url: string;
  posterUrl: string;
  alt: string;
};

export type MediaItem = MediaImage | MediaVideo;

const STOCK_POOL: ReadonlyArray<{ url: string; alt: string }> = [
  { url: "/media/open-yoga.jpg", alt: "Outdoor community group meeting in the open air" },
  { url: "/media/yoga.jpg", alt: "Group warming up together for an active session" },
  { url: "/media/networking.jpg", alt: "Hosts and guests chatting at a warm dinner table" },
  { url: "/media/concert.jpg", alt: "Crowd at a small, warmly-lit live performance" },
];

function hashSeed(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a deterministic 5-item gallery: the primary event image first,
 * followed by category-themed stock photos in an order varied per slug so
 * different events surface different supporting frames.
 */
export function buildEventMediaGallery({
  slug,
  primaryImage,
  primaryAlt,
}: {
  slug: string;
  primaryImage: string;
  primaryAlt: string;
}): MediaItem[] {
  const seed = hashSeed(slug);
  const primary: MediaImage = {
    kind: "image",
    url: primaryImage,
    alt: primaryAlt,
  };

  const filler = STOCK_POOL.filter((item) => item.url !== primaryImage).map<MediaImage>(
    (item) => ({ kind: "image", url: item.url, alt: item.alt }),
  );

  // Stable rotation per slug so each event has its own filler order.
  const rotated = [...filler.slice(seed % filler.length), ...filler.slice(0, seed % filler.length)];

  // Pad to 5 by repeating from the rotated set if we ran out (small pool).
  const items: MediaItem[] = [primary];
  let i = 0;
  while (items.length < 5) {
    items.push(rotated[i % rotated.length]);
    i += 1;
  }
  return items;
}
