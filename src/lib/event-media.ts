/**
 * Event media gallery — derived from the real images stored on `events`
 * (`image_urls[]`, falling back to the single `image_url`).
 *
 * We deliberately do NOT pad the gallery with unrelated stock photos: a
 * floral-arrangement event was surfacing concert/yoga frames, which read as
 * fake. When a merchant uploads only one image we show only that one tile —
 * the gallery component (`EventMediaGallery`) renders cleanly with <5 tiles.
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

/**
 * Returns a gallery built only from the event's real images, in order. No
 * synthetic stock fillers — an event with a single upload yields a single
 * tile. Blank/duplicate URLs are dropped.
 */
export function buildEventMediaGallery({
  images,
  primaryAlt,
}: {
  images: ReadonlyArray<string | null | undefined>;
  primaryAlt: string;
}): MediaItem[] {
  const seen = new Set<string>();
  const urls = images.filter((url): url is string => {
    if (!url || url.trim().length === 0) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  return urls.map<MediaImage>((url, index) => ({
    kind: "image",
    url,
    alt: index === 0 ? primaryAlt : `${primaryAlt} - photo ${index + 1}`,
  }));
}
