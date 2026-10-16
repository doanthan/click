// The three build-prompt-1 backfills. Each takes an EXPLICIT id list - the one
// Cindy and Doan confirmed from scripts/prepare-build-prompt-1-lists.mjs - and
// is a dry run unless --apply is given. Needs migration 076. Not a migration:
// it lives outside database/ so no run of the migrations can ever apply it.
//
//   node --env-file=<.env> scripts/backfill-build-prompt-1.mjs <kind> --ids <file> [--apply]
//   node --env-file=<.env> scripts/backfill-build-prompt-1.mjs photo --pending [--apply]
//
//   kind = photo   <file> lists the profile ids to check. Each one's CURRENT
//                  photo_url is checked again right now, exactly as the app
//                  checks an upload (src/lib/photo-verify.ts, 3 retries), and
//                  photo_status is set to ok / failed (none if the photo is
//                  gone). --pending instead of --ids checks every photo still
//                  'pending' - run it once right after the deploy, for photos
//                  changed between the backfill and the deploy (076's trigger
//                  makes each of those 'pending').
//          is_test <file> lists the ids to mark profiles.is_test = true.
//          member  <file> lists the ids that finished the user onboarding
//                  flow before member_onboarded_at existed. It is set to their
//                  account's created_at - the closest record of when they
//                  onboarded - and only where it is still NULL.
//
// <file> is JSON (an array of ids, or of { id }) or plain text, one id per line.
// Every applied run writes one audit_logs row (action backfill.<kind>) with the
// ids it changed. The repo is public: keep the id files out of git.
import { readFileSync } from "node:fs";
import pg from "pg";
import { verifyPhotoUrl } from "../src/lib/photo-verify.ts";

const [kind] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
const idsIndex = process.argv.indexOf("--ids");
const idsFile = idsIndex > -1 ? process.argv[idsIndex + 1] : null;
const pendingOnly = kind === "photo" && process.argv.includes("--pending");
if (!["photo", "is_test", "member"].includes(kind) || !idsFile === !pendingOnly) {
  console.error("Usage: node --env-file=<.env> scripts/backfill-build-prompt-1.mjs <photo|is_test|member> --ids <file> [--apply]");
  console.error("       node --env-file=<.env> scripts/backfill-build-prompt-1.mjs photo --pending [--apply]");
  process.exit(1);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readIds(file) {
  const text = readFileSync(file, "utf8").trim();
  let raw;
  try {
    const parsed = JSON.parse(text);
    raw = (Array.isArray(parsed) ? parsed : []).map((entry) => (typeof entry === "string" ? entry : entry?.id));
  } catch {
    raw = text.split(/\s+/);
  }
  const ids = [...new Set(raw.filter(Boolean).map((id) => id.trim()))];
  const bad = ids.filter((id) => !UUID.test(id));
  if (bad.length > 0) throw new Error(`Not uuids: ${bad.join(", ")}`);
  if (ids.length === 0) throw new Error("The id file lists nobody.");
  return ids;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString,
  max: 1,
  ssl: /supabase\.(co|com)/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});
const db = await pool.connect();

try {
  const ids = pendingOnly
    ? (await db.query(`select id::text from profiles where photo_status = 'pending' order by id`)).rows.map((row) => row.id)
    : readIds(idsFile);
  if (ids.length === 0) throw new Error("No profile to check.");
  const found = await db.query(`select id::text from profiles where id = any($1::uuid[])`, [ids]);
  const missing = ids.filter((id) => !found.rows.some((row) => row.id === id));
  if (missing.length > 0) throw new Error(`No profile for: ${missing.join(", ")}`);

  let changes = [];
  if (kind === "photo") {
    const rows = (
      await db.query(
        `select id::text, photo_url, photo_status from profiles where id = any($1::uuid[]) order by id`,
        [ids],
      )
    ).rows;
    for (const row of rows) {
      const check = await verifyPhotoUrl(row.photo_url, row.id, { retries: 3, backoffMs: 700 });
      const status = check.status === "ok" ? "ok" : check.status === "none" ? "none" : "failed";
      changes.push({ id: row.id, url: row.photo_url, from: row.photo_status, to: status, reason: check.reason });
    }
  } else if (kind === "is_test") {
    const rows = (
      await db.query(`select id::text, is_test from profiles where id = any($1::uuid[]) and not is_test`, [ids])
    ).rows;
    changes = rows.map((row) => ({ id: row.id, from: false, to: true }));
  } else {
    const rows = (
      await db.query(
        `select id::text, created_at from profiles
          where id = any($1::uuid[]) and member_onboarded_at is null and deleted_at is null`,
        [ids],
      )
    ).rows;
    changes = rows.map((row) => ({ id: row.id, from: null, to: row.created_at }));
  }

  for (const change of changes) console.log(JSON.stringify(change));
  console.log(`${changes.length} of ${ids.length} listed profile(s) would change.`);
  if (!apply) {
    console.log("Dry run - nothing written. Add --apply to write.");
  } else {
    await db.query("begin");
    for (const change of changes) {
      if (kind === "photo") {
        // Only while the profile still holds the photo that was checked.
        await db.query(
          `update profiles set photo_status = $3 where id = $1::uuid and photo_url is not distinct from $2`,
          [change.id, change.url, change.to],
        );
      } else if (kind === "is_test") {
        await db.query(`update profiles set is_test = true where id = $1::uuid and not is_test`, [change.id]);
      } else {
        await db.query(
          `update profiles set member_onboarded_at = created_at
            where id = $1::uuid and member_onboarded_at is null`,
          [change.id],
        );
      }
    }
    await db.query(
      `insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
       values (null, $1, 'profiles', null, $2::jsonb)`,
      [`backfill.${kind}`, JSON.stringify({ listed: ids.length, changed: changes })],
    );
    await db.query("commit");
    console.log(`Applied: ${changes.length} profile(s) updated, audited as backfill.${kind}.`);
  }
} catch (error) {
  await db.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.release();
  await pool.end();
}
