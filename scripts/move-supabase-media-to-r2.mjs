// Copy the photos still served from Supabase Storage's public `avatars` bucket
// to R2 under the SAME key, then point the rows at the R2 copy. Uploads have
// gone to R2 since 2026-10-13; this moves what came before, while Supabase
// still serves it (its egress quota cut every image off on and off from
// 2026-09-28). Dry run unless --apply.
//
//   node --env-file=<.env> scripts/move-supabase-media-to-r2.mjs [--apply]
//
// - Same key, nothing deleted: every delete path (deleteAvatarObject,
//   deleteGalleryObject, deleteEventImageObject) removes the key from BOTH
//   backends, so the Supabase original is still cleaned up with its member or
//   event.
// - A row is rewritten only while it still holds the exact old URL, so a member
//   who re-uploads mid-run keeps the new photo.
// - An object already in R2 under the key is never overwritten: the write is
//   create-only (If-None-Match: *, atomic on R2), so a member uploading a new
//   photo to the same key mid-run keeps it. An existing object is used only
//   when it holds the same bytes; otherwise the URL is skipped and reported.
// - Deploy sameObjectUrls (src/lib/photo-verify.ts) before running this: the
//   gallery and event-image deletes need it to see a page opened before the
//   copy, which still sends the Supabase form of the URL.
// - A changed profiles.photo_url turns photo_status 'pending' (076's trigger).
//   Run `scripts/backfill-build-prompt-1.mjs photo --pending --apply` straight
//   after, so the photo check passes or fails each one on its R2 copy.
// - Any other column still holding a Supabase URL (email_events.html and the
//   like) is listed, never touched: it is history.
// Each rewritten URL writes one audit_logs row (action media.moved_to_r2) in the
// same transaction as its rows.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";
import { PERSONAL_PHOTO_CACHE_CONTROL } from "../src/lib/public-media-storage.ts";

export const TARGETS = [
  { table: "profiles", column: "photo_url", array: false },
  { table: "profiles", column: "gallery_photos", array: true },
  { table: "events", column: "image_url", array: false },
  { table: "events", column: "image_urls", array: true },
];
const MAX_BYTES = 15 * 1024 * 1024;
const PUBLIC_PATH = "/storage/v1/object/public/avatars/";

/**
 * The R2 copy of a Supabase public `avatars` URL: same key, same query string
 * (the avatar's ?v= cache-buster). Null for anything else - another host,
 * another bucket, or a key that could climb out of the bucket.
 */
export function r2CopyOf(url, supabaseBase, r2Base) {
  let parsed;
  let root;
  try {
    parsed = new URL(url);
    root = new URL(supabaseBase);
  } catch {
    return null;
  }
  if (parsed.origin !== root.origin || !parsed.pathname.startsWith(PUBLIC_PATH)) return null;
  const raw = parsed.pathname.slice(PUBLIC_PATH.length);
  let key;
  try {
    key = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!key || key.startsWith("/") || key.includes("..")) return null;
  return { key, url: `${r2Base.replace(/\/$/, "")}/${raw}${parsed.search}${parsed.hash}` };
}

const valuesOf = (t) => (t.array ? `unnest("${t.column}")` : `"${t.column}"`);
const holds = (t, param) => (t.array ? `${param} = any("${t.column}")` : `"${t.column}" = ${param}`);

/** Every distinct URL in TARGETS that starts with `prefix`. */
export async function collectUrls(db, prefix) {
  const union = TARGETS.map((t) => `select ${valuesOf(t)} as url from "${t.table}"`).join(" union ");
  const rows = (await db.query(`select distinct url from (${union}) u where url like $1 order by url`, [`${prefix}%`])).rows;
  return rows.map((row) => row.url);
}

/** Rows per target that hold `url`. */
export async function countRefs(db, url) {
  const refs = {};
  for (const t of TARGETS) {
    const n = (await db.query(`select count(*)::int as n from "${t.table}" where ${holds(t, "$1")}`, [url])).rows[0].n;
    if (n) refs[`${t.table}.${t.column}`] = n;
  }
  return refs;
}

/** Point every row still holding `from` at `to`. Returns rows changed per target. */
export async function rewriteRefs(db, from, to) {
  const changed = {};
  for (const t of TARGETS) {
    const set = t.array ? `array_replace("${t.column}", $1, $2)` : "$2";
    const result = await db.query(`update "${t.table}" set "${t.column}" = ${set} where ${holds(t, "$1")}`, [from, to]);
    if (result.rowCount) changed[`${t.table}.${t.column}`] = result.rowCount;
  }
  return changed;
}

const md5 = (bytes) => createHash("md5").update(bytes).digest("hex");

async function fetchImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!type.startsWith("image/")) return { error: `not an image (${type || "no type"})` };
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return { error: `bad size (${bytes.length} bytes)` };
  return { bytes, type };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = (name) => process.env[name]?.trim() ?? "";
  const supabaseBase = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const r2Base = env("R2_PUBLIC_URL").replace(/\/$/, "");
  const missing = ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "R2_PUBLIC_URL", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter((name) => !env(name));
  if (missing.length > 0) throw new Error(`Not set: ${missing.join(", ")}`);

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
  });
  async function r2Etag(key) {
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: env("R2_BUCKET_NAME"), Key: key }));
      return (head.ETag ?? "").replaceAll('"', "");
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }
  // Create-only. False when something landed under the key since the HEAD.
  async function r2CreateOnly(key, bytes, contentType) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: env("R2_BUCKET_NAME"),
          Key: key,
          Body: new Uint8Array(bytes),
          ContentType: contentType,
          // Same headers the uploaders write: event photos are immutable per
          // key; people's photos get the short edge TTL so a delete stops
          // serving within the hour (public-media-storage.ts).
          CacheControl: key.startsWith("events/") ? "public, max-age=31536000, immutable" : PERSONAL_PHOTO_CACHE_CONTROL,
          IfNoneMatch: "*",
        }),
      );
      return true;
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 412) return false;
      throw error;
    }
  }

  const connectionString = env("DATABASE_URL");
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    ssl: /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  const db = await pool.connect();
  const moved = [];
  let skipped = 0;
  try {
    const host = new URL(supabaseBase).host;
    const columns = (
      await db.query(
        `select table_name, column_name, data_type from information_schema.columns
          where table_schema = 'public' and data_type in ('text', 'character varying', 'ARRAY', 'jsonb', 'json')
          order by table_name, column_name`,
      )
    ).rows.filter((c) => !TARGETS.some((t) => t.table === c.table_name && t.column === c.column_name));
    for (const c of columns) {
      const text = c.data_type === "ARRAY" ? `array_to_string("${c.column_name}", ' ')` : `"${c.column_name}"::text`;
      const n = (await db.query(`select count(*)::int as n from "${c.table_name}" where ${text} like $1`, [`%${host}/storage/%`])).rows[0].n;
      if (n) console.log(JSON.stringify({ untouched: `${c.table_name}.${c.column_name}`, rows: n }));
    }

    const urls = await collectUrls(db, `${supabaseBase}/storage/v1/object/public/`);
    for (const url of urls) {
      const report = { url, refs: await countRefs(db, url) };
      const copy = r2CopyOf(url, supabaseBase, r2Base);
      if (!copy) {
        console.log(JSON.stringify({ ...report, skip: "not a key in the public avatars bucket" }));
        skipped += 1;
        continue;
      }
      Object.assign(report, { key: copy.key, to: copy.url });
      const source = await fetchImage(url);
      if (source.error) {
        console.log(JSON.stringify({ ...report, skip: `Supabase copy unreadable: ${source.error}` }));
        skipped += 1;
        continue;
      }
      const etag = await r2Etag(copy.key);
      if (etag !== null && etag !== md5(source.bytes)) {
        console.log(JSON.stringify({ ...report, skip: "R2 already holds a different object under this key" }));
        skipped += 1;
        continue;
      }
      report.r2 = etag === null ? "copy" : "already there";
      if (!apply) {
        console.log(JSON.stringify(report));
        moved.push(report);
        continue;
      }
      if (etag === null && !(await r2CreateOnly(copy.key, source.bytes, source.type))) {
        if ((await r2Etag(copy.key)) !== md5(source.bytes)) {
          console.log(JSON.stringify({ ...report, skip: "something else was written under this key mid-run" }));
          skipped += 1;
          continue;
        }
      }
      const served = await fetchImage(copy.url);
      if (served.error || md5(served.bytes) !== md5(source.bytes)) {
        console.log(JSON.stringify({ ...report, skip: `R2 copy does not serve the same bytes: ${served.error ?? "different bytes"}` }));
        skipped += 1;
        continue;
      }
      await db.query("begin");
      report.changed = await rewriteRefs(db, url, copy.url);
      const changedTables = Object.keys(report.changed);
      if (changedTables.length > 0) {
        await db.query(
          `insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
           values (null, 'media.moved_to_r2', $1, null, $2::jsonb)`,
          [changedTables[0].split(".")[0], JSON.stringify({ from: url, to: copy.url, key: copy.key, changed: report.changed })],
        );
      }
      await db.query("commit");
      console.log(JSON.stringify(report));
      moved.push(report);
    }

    console.log(`${moved.length} of ${urls.length} Supabase URL(s) ${apply ? "moved" : "would move"}, ${skipped} skipped.`);
    if (!apply) {
      console.log("Dry run - nothing written. Add --apply to copy and rewrite.");
    } else if (moved.length > 0) {
      console.log("Audited as media.moved_to_r2. Now run: scripts/backfill-build-prompt-1.mjs photo --pending --apply");
    }
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
