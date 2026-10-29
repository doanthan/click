// The profile photo check behind profiles.photo_status (01 §2 Step 4, build
// prompt 1). One check for every writer - the upload route, the Google/Facebook
// rehost, the gallery paths and the backfill script - so "a passing photo"
// means the same thing everywhere.
//
// Standalone - no project imports - so scripts/backfill-build-prompt-1.mjs and the
// tests load this file directly (Node strips the types), the way
// src/lib/clicks/daily-picks.ts is shared.
//
// A photo is 'ok' only when the STORED object loads from its public URL, with
// no credentials, as a real image that is not a placeholder, stock or default
// picture. Anything else is 'failed' with a reason, and the member is shown
// that their photo did not work - never a silent silhouette.
//
// ponytail: no face detection. 01 §2's MVP quality floor (one detectable face,
// no nudity) needs a vision model; this catches what actually reached the click
// pool: dead storage, placeholder services, blank or default avatars, and the
// site's own generated faces. Add the vision pass here when it is bought.

export type PhotoStatus = "none" | "pending" | "ok" | "failed";
export type PhotoCheck = { status: "none" | "ok" | "failed"; reason: string };

// Image hosts that only ever serve stock people or generated placeholders.
const STOCK_HOSTS = [
  "unsplash.com",
  "pexels.com",
  "pravatar.cc",
  "randomuser.me",
  "thispersondoesnotexist.com",
  "generated.photos",
  "istockphoto.com",
  "shutterstock.com",
  "gettyimages.com",
];
const PLACEHOLDER_HOSTS = [
  "ui-avatars.com",
  "placehold.co",
  "placehold.it",
  "placeholder.com",
  "dummyimage.com",
  "placekitten.com",
  "dicebear.com",
  "robohash.org",
  "boringavatars.com",
];
// The site's own generated faces. Seed and QA profiles wore them, and one is
// never a member's own photo.
const STOCK_PATH_PREFIXES = ["/home/avatars/"];
// Provider defaults that say so in their URL (Google's old default-user path,
// Facebook and Gravatar silhouettes, generic "no avatar" files).
const DEFAULT_URL_PATTERNS = [
  /\/default[-_]?(user|avatar|profile)/i,
  /silhouette/i,
  /placeholder/i,
  /no[-_]?(avatar|photo|image)/i,
  /blank[-_]?(avatar|profile|user)/i,
  /[?&]d=(mp|mm|identicon|monsterid|wavatar|retro|robohash|blank)\b/i,
];

// Calibration knobs. A flat-colour letter avatar or a grey silhouette sits well
// under 3 bits of greyscale entropy; a photo of a person, even on a plain wall,
// sits above 5. MIN_SIDE stops a 1x1 tracking pixel or a favicon passing.
export const MIN_ENTROPY_BITS = 3.5;
export const MIN_SIDE_PX = 64;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
// dHash distance at or under which an image is the same picture as a stock face.
export const STOCK_DHASH_MAX_DISTANCE = 6;

// dHash (64-bit, hex) of each generated face in public/home/avatars, as
// computed by dHashHex below. The upload pipeline's 512 crop moves a face by at
// most 1 bit, so a re-uploaded copy still matches. tests/photo-gate.test.mjs
// recomputes these from the files, so swapping a face without updating this
// list fails the suite.
export const STOCK_FACE_DHASHES: Record<string, string> = {
  "av-1.jpg": "4f337378bb70d496",
  "av-2.jpg": "2f634a7b333375c5",
  "av-3.jpg": "efdbdbd9d97cd6ec",
  "av-4.jpg": "99394dc9c9cf0f07",
  "av-5.jpg": "ce70b969e9ec6464",
  "av-6.jpg": "8c9e8c376e65f092",
  "av-7.jpg": "27272b6969694f97",
  "av-8.jpg": "0f762a29b73356d6",
  "av-9.jpg": "76f2e3c9c9694949",
  "av-10.jpg": "1eb2ba5a1a78ccda",
  "av-11.jpg": "0c326169696a2530",
  "av-12.jpg": "c3736b13336ccc92",
  "av-13.jpg": "073323727673f9b9",
  "av-14.jpg": "9bb8666434331513",
  "av-15.jpg": "d3f36949ede96d69",
  "av-16.jpg": "6d544c8d4c4f2b37",
};

function hostMatches(host: string, list: string[]) {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * Where members' photos are stored: R2's public base, and the legacy Supabase
 * avatars bucket (public-media-storage.ts, avatar-storage.ts, gallery-storage.ts).
 */
export function photoStorageBases(env: Record<string, string | undefined> = process.env): string[] {
  const bases: string[] = [];
  const r2 = (env.R2_PUBLIC_URL ?? env.R2_TEMP_PUBLIC ?? "").trim().replace(/\/$/, "");
  if (r2) bases.push(`${r2}/`);
  const supabase = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  if (supabase) bases.push(`${supabase}/storage/v1/object/public/avatars/`);
  return bases;
}

/**
 * Every URL one stored object can be saved under: `url` itself plus the same
 * key and query string under each other storage base. The photos copied from
 * Supabase to R2 kept their keys (scripts/move-supabase-media-to-r2.mjs), so a
 * page opened before the copy still sends the Supabase form of a photo its row
 * now holds as R2. A delete that matched only the exact form would leave the
 * row alone and still remove the key from both backends - a row pointing at
 * nothing. A URL under no storage base comes back alone.
 */
export function sameObjectUrls(url: string, bases = photoStorageBases()): string[] {
  const base = bases.find((candidate) => url.startsWith(candidate));
  if (!base) return [url];
  const rest = url.slice(base.length);
  return [url, ...bases.filter((other) => other !== base).map((other) => `${other}${rest}`)];
}

/**
 * The object key when `url` is one of this member's OWN stored photos - their
 * avatar (`<id>.jpg`) or a gallery photo (`gallery/<id>/...`) - else null. Only
 * such a URL is ever fetched: anything else a profile holds is not a photo they
 * uploaded, and fetching it would let a saved URL make the server call any
 * address (or pass someone else's photo off as theirs).
 */
export function ownStoredPhotoKey(url: string, ownerId: string, bases = photoStorageBases()): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  for (const base of bases) {
    const root = new URL(base);
    if (parsed.origin !== root.origin || !parsed.pathname.startsWith(root.pathname)) continue;
    let key: string;
    try {
      key = decodeURIComponent(parsed.pathname.slice(root.pathname.length));
    } catch {
      return null;
    }
    if (key.includes("..")) return null;
    if (key === `${ownerId}.jpg` || key.startsWith(`gallery/${ownerId}/`)) return key;
  }
  return null;
}

/**
 * What can be said about a photo from its URL alone. Null means the URL is a
 * candidate and has to be fetched to know.
 */
export function classifyPhotoUrl(raw: string | null | undefined): PhotoCheck | null {
  const url = raw?.trim() ?? "";
  if (!url) return { status: "none", reason: "no photo" };
  if (url.startsWith("/")) {
    if (STOCK_PATH_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      return { status: "failed", reason: "stock image (the site's generated faces)" };
    }
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "failed", reason: "not a valid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { status: "failed", reason: `unsupported URL scheme ${parsed.protocol}` };
  }
  const host = parsed.hostname.toLowerCase();
  if (hostMatches(host, STOCK_HOSTS)) return { status: "failed", reason: `stock image host (${host})` };
  if (hostMatches(host, PLACEHOLDER_HOSTS)) {
    return { status: "failed", reason: `placeholder image host (${host})` };
  }
  if (STOCK_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) {
    return { status: "failed", reason: "stock image (the site's generated faces)" };
  }
  if (DEFAULT_URL_PATTERNS.some((pattern) => pattern.test(`${parsed.pathname}${parsed.search}`))) {
    return { status: "failed", reason: "default or placeholder avatar" };
  }
  return null;
}

type SharpLike = (input: Buffer) => {
  metadata(): Promise<{ width?: number; height?: number }>;
  stats(): Promise<{ entropy: number }>;
  greyscale(): ReturnType<SharpLike>;
  resize(width: number, height: number, options?: { fit?: string }): ReturnType<SharpLike>;
  raw(): ReturnType<SharpLike>;
  toBuffer(): Promise<Buffer>;
};

async function loadSharp(): Promise<SharpLike> {
  // Loaded on use, never at module scope: a failed native load at module scope
  // takes the whole route down before the handler runs (avatar-storage.ts).
  return (await import("sharp")).default as unknown as SharpLike;
}

/** 64-bit difference hash of an image, as 16 hex characters. */
export async function dHashHex(image: Buffer): Promise<string> {
  const sharp = await loadSharp();
  const pixels = await sharp(image).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let hex = "";
  for (let row = 0; row < 8; row += 1) {
    let byte = 0;
    for (let col = 0; col < 8; col += 1) {
      const left = pixels[row * 9 + col];
      const right = pixels[row * 9 + col + 1];
      byte = (byte << 1) | (left > right ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function hammingHex(a: string, b: string): number {
  let distance = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** Whether these bytes are a real, non-placeholder, non-stock photo. */
export async function checkPhotoBytes(image: Buffer): Promise<PhotoCheck> {
  if (image.byteLength === 0) return { status: "failed", reason: "empty file" };
  if (image.byteLength > MAX_PHOTO_BYTES) return { status: "failed", reason: "file too large" };
  const sharp = await loadSharp();
  let width = 0;
  let height = 0;
  let entropy = 0;
  try {
    const meta = await sharp(image).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    entropy = (await sharp(image).stats()).entropy;
  } catch {
    return { status: "failed", reason: "not a readable image" };
  }
  if (Math.min(width, height) < MIN_SIDE_PX) {
    return { status: "failed", reason: `placeholder (only ${width}x${height})` };
  }
  if (entropy < MIN_ENTROPY_BITS) {
    return { status: "failed", reason: `placeholder or default avatar (flat image, ${entropy.toFixed(2)} bits)` };
  }
  const hash = await dHashHex(image);
  for (const [name, stock] of Object.entries(STOCK_FACE_DHASHES)) {
    if (hammingHex(hash, stock) <= STOCK_DHASH_MAX_DISTANCE) {
      return { status: "failed", reason: `stock image (matches ${name})` };
    }
  }
  return { status: "ok", reason: "loads publicly as a real photo" };
}

/** What the member is told when their photo fails - always shown, never hidden. */
export function photoFailureMessage(check: PhotoCheck): string {
  const reason = check.reason.toLowerCase();
  if (reason.startsWith("unreachable") || reason.includes("did not download")) {
    return "We saved your photo but couldn't load it back. Try uploading it again in a moment.";
  }
  if (reason.startsWith("stock")) {
    return "That looks like a stock photo. Upload a photo of you - it's how people recognise you at events.";
  }
  if (reason.includes("placeholder") || reason.includes("default")) {
    return "That looks like a placeholder, not a photo of you. Try a clear photo of your face.";
  }
  return "We couldn't read that image. Try a different photo.";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type VerifyOptions = {
  /** Retries after the first attempt, for network errors and non-2xx answers. */
  retries?: number;
  /** Delay before retry n is n * backoffMs. */
  backoffMs?: number;
  timeoutMs?: number;
  /** Defaults to photoStorageBases() - the deployment's own storage. */
  storageBases?: string[];
  fetchImpl?: typeof fetch;
};

/**
 * The whole check for a member's stored photo URL: the URL rules, then that it
 * is their own stored object, then a public fetch with no credentials and no
 * redirects (retried), then the bytes. Never throws.
 */
export async function verifyPhotoUrl(
  raw: string | null | undefined,
  ownerId: string,
  options: VerifyOptions = {},
): Promise<PhotoCheck> {
  const byUrl = classifyPhotoUrl(raw);
  if (byUrl) return byUrl;

  const target = raw!.trim();
  if (!ownStoredPhotoKey(target, ownerId, options.storageBases ?? photoStorageBases())) {
    return { status: "failed", reason: "not a photo this member uploaded to Click storage" };
  }

  const retries = options.retries ?? 3;
  const backoffMs = options.backoffMs ?? 500;
  const doFetch = options.fetchImpl ?? fetch;
  let lastReason = "unreachable";
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(attempt * backoffMs);
    let response: Response;
    try {
      response = await doFetch(target, {
        // Storage answers directly; a redirect could lead anywhere.
        redirect: "error",
        cache: "no-store",
        headers: { "User-Agent": "ClickPhotoCheck/1.0", Accept: "image/*" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      });
    } catch (error) {
      lastReason = `unreachable (${error instanceof Error ? error.name : "network error"})`;
      continue;
    }
    if (!response.ok) {
      lastReason = `unreachable (HTTP ${response.status})`;
      await response.body?.cancel().catch(() => {});
      continue;
    }
    const type = response.headers.get("content-type") ?? "";
    if (type && !type.toLowerCase().startsWith("image/")) {
      await response.body?.cancel().catch(() => {});
      return { status: "failed", reason: `not an image (${type.split(";")[0]})` };
    }
    const declared = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declared) && declared > MAX_PHOTO_BYTES) {
      await response.body?.cancel().catch(() => {});
      return { status: "failed", reason: "file too large" };
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch {
      lastReason = "unreachable (body did not download)";
      continue;
    }
    return checkPhotoBytes(bytes);
  }
  return { status: "failed", reason: lastReason };
}
