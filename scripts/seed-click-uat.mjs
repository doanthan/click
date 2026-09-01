// Makes the click mechanic testable on a staff account.
//
// The problem this solves: /post-login sent every ADMIN_EMAILS address straight
// to /admin, so no admin ever passed through /onboarding - the only writer of
// profiles.birth_date and profiles.age. sendClickInner reads age directly
// ((age ?? 0) < 18), so staff accounts were refused on every click they sent,
// and the four rosters gated on role = 'attendee', so nobody could click them
// back either. Both are fixed in code now; this fills the columns those admins
// never got a chance to write, so a tester does not have to re-onboard first.
//
// What it does NOT do: fabricate a mutual_clicks or click_proposals row. A
// mutual is built by sendClickInner inside one transaction, under a per-pair
// advisory lock, with a proposal row + notifications + the one click-engine
// email. Hand-writing the outcome produces a state the app never makes, which
// makes UAT worse, not better. Instead it seeds a PENDING click FROM a QA
// persona TO the admin - exactly the row shape the engine writes - so the first
// time the tester clicks that persona back through the UI, the real detector
// fires and the whole mutual → proposal → confirm flow runs for real.
//
// Additive + idempotent. Re-running changes nothing. `--clean` removes only the
// pending clicks this script seeded; profile columns are left alone (they are
// what makes the account work, and /profile/edit can change them).
//
// Run: node scripts/seed-click-uat.mjs [--clean]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function envValue(file, key) {
  try {
    const raw = readFileSync(join(root, file), "utf8");
    return raw.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

const url = envValue(".env.local", "DATABASE_URL");
if (!url) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const adminEmails = (
  envValue(".env.local", "ADMIN_EMAILS") ??
  envValue(".env.production.local", "ADMIN_EMAILS") ??
  ""
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (adminEmails.length === 0) {
  console.error("ADMIN_EMAILS not found in .env.local or .env.production.local");
  process.exit(1);
}

// A placeholder date of birth, and it is meant to look like one. It exists only
// to satisfy the 18+ gate that reads birth_date/age; nobody should mistake it
// for a real record. The tester can correct their age in /profile/edit.
const PLACEHOLDER_BIRTH_DATE = "1990-01-01";
const PLACEHOLDER_SUBURB = "Surry Hills";
const PLACEHOLDER_BIO =
  "Testing the click flow. Placeholder profile - swap this out in /profile/edit.";

const pool = new pg.Pool({ connectionString: url, max: 1 });
const client = await pool.connect();

try {
  await client.query("begin");

  if (process.argv.includes("--clean")) {
    const removed = await client.query(
      `delete from clicks
        where status = 'pending'
          and event_id is null
          and sender_id in (select id from profiles where email like '%@click.local')
          and receiver_id in (select id from profiles where lower(email::text) = any($1::text[]))
        returning id`,
      [adminEmails],
    );
    await client.query("commit");
    console.log(`Removed ${removed.rowCount} seeded pending click(s). Profiles left untouched.`);
    process.exit(0);
  }

  // 1. Fill ONLY the columns an admin never got to write. coalesce everywhere:
  //    this must never overwrite a real value someone already set.
  const filled = await client.query(
    `update profiles p set
       birth_date = coalesce(p.birth_date, $2::date),
       age        = coalesce(p.age, extract(year from age(current_date, $2::date))::int),
       suburb     = coalesce(p.suburb, $3),
       bio        = coalesce(nullif(p.bio, ''), $4),
       photo_url  = coalesce(nullif(p.photo_url, ''), '/home/avatars/av-' || (1 + (abs(hashtext(p.email::text)) % 16))::text || '.jpg'),
       connection_intents =
         case when cardinality(coalesce(p.connection_intents, '{}')) > 1
              then p.connection_intents
              else '{friendship,hobbies,community}'::connection_intent[] end,
       updated_at = now()
     where lower(p.email::text) = any($1::text[])
     returning p.email::text as email, p.age, p.suburb, p.photo_url`,
    [adminEmails, PLACEHOLDER_BIRTH_DATE, PLACEHOLDER_SUBURB, PLACEHOLDER_BIO],
  );

  for (const row of filled.rows) {
    console.log(`✔ profile ready  ${row.email}  age=${row.age}  ${row.suburb}`);
  }
  const missing = adminEmails.filter(
    (e) => !filled.rows.some((r) => r.email.toLowerCase() === e),
  );
  for (const email of missing) {
    console.log(`· no profile yet ${email} (they have never signed in - nothing to fill)`);
  }

  // 2. Give each admin the same three interest tags the QA personas carry, so the
  //    People Card has a real overlap line to draw instead of a bare card.
  const tagged = await client.query(
    `insert into user_tags (profile_id, tag_id, source)
     -- 'user' is what saveOnboarding writes for interest tags; user_tags_source_check
     -- only allows user | quiz | music | system, and these stand in for tags the
     -- person would have picked in the wizard they never reached.
     select p.id, t.tag_id, 'user'
     from profiles p
     cross join (
       select ut.tag_id
       from user_tags ut
       join tags tag on tag.id = ut.tag_id and tag.tag_type = 'interest'
       join profiles persona on persona.id = ut.profile_id
       where persona.email like '%@click.local' and persona.role = 'attendee'
       group by ut.tag_id
       order by count(*) desc, ut.tag_id
       limit 3
     ) t
     where lower(p.email::text) = any($1::text[])
     on conflict do nothing
     returning profile_id`,
    [adminEmails],
  );
  console.log(`✔ ${tagged.rowCount} interest tag(s) attached`);

  // 3. A pending discovery click from EVERY eligible QA persona to each admin.
  //    Same row shape sendClickInner writes: event_id null, surface 'discovery',
  //    7-day window (DISCOVERY_CLICK_WINDOW_DAYS). The admin clicking a persona
  //    back through the UI is what forms the mutual - the engine does it, we do
  //    not. `on conflict do nothing` plus the pending guard keeps re-runs inert.
  //
  //    Every persona, not one: /people shows a daily set of THREE, rotated by the
  //    Sydney date (dayKey % clickable.length), so which faces a tester sees today
  //    is not predictable from here. Seeding one reciprocal makes the mutual a
  //    coin flip on the calendar; seeding all of them means whoever is on screen
  //    is a person who clicks back. Receiving has no cap - only sending does.
  const seeded = await client.query(
    `insert into clicks (sender_id, receiver_id, event_id, intent_mode, surface, status, expires_at)
     select persona.id, admin.id, null, 'friendship', 'discovery', 'pending', now() + interval '7 days'
     from profiles admin
     join profiles persona
       on persona.email like '%@click.local'
      and persona.role = 'attendee'
      and persona.age >= 18
      and persona.suburb is not null and persona.bio is not null
      and persona.photo_url is not null and persona.photo_url <> ''
      and persona.is_banned = false and persona.social_visible = true
     where lower(admin.email::text) = any($1::text[])
       and not exists (
         select 1 from clicks c
         where c.sender_id = persona.id and c.receiver_id = admin.id
           and c.event_id is null and c.status = 'pending' and c.expires_at > now()
       )
     on conflict do nothing
     returning receiver_id`,
    [adminEmails],
  );
  console.log(`✔ ${seeded.rowCount} pending click(s) waiting on an admin`);

  // The project has no local Postgres and the only reachable database is the
  // live one, so "run it and see" is the same as "write to production". A dry
  // run does every statement and rolls back, which is the only honest way to
  // check this script before it lands.
  const dryRun = process.argv.includes("--dry-run");
  await client.query(dryRun ? "rollback" : "commit");
  if (dryRun) {
    console.log("\nDRY RUN - everything above was rolled back. Nothing was written.");
    process.exit(0);
  }

  console.log(
    [
      "",
      "Done. To finish a mutual for real:",
      "  1. sign in, open /people",
      "  2. click the QA persona whose card is showing",
      "  3. the reciprocal is already pending, so sendClickInner forms the mutual,",
      "     writes the click_proposals row and logs mutual-click-attendee",
      "",
      `NOTE: birth_date was set to the placeholder ${PLACEHOLDER_BIRTH_DATE}. It only`,
      "exists to satisfy the 18+ gate - correct the age in /profile/edit.",
      "Undo the seeded clicks with: node scripts/seed-click-uat.mjs --clean",
    ].join("\n"),
  );
} catch (err) {
  await client.query("rollback");
  console.error(err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
