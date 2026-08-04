// TEMP QA seed for the 2.5b coordination-drawer §10 pass. Seeds Maya (maya@click.local,
// the attendee test-login) four active mutuals covering every drawer state, then prints
// their ids for ?open= deep-linking. Idempotent (clears Maya's mutuals to these 4 first).
// Run: node scripts/_seed_maya_qa.mjs   |   clean: node scripts/_seed_maya_qa.mjs --clean
import { readFileSync } from "node:fs"; import { Pool } from "pg";
for (const f of [".env.local", ".env"]) { try { for (const l of readFileSync(f, "utf8").split("\n")) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; } } catch {} }
const cs = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: cs, max: 3, ssl: /supabase\.(co|com)/.test(cs) ? { rejectUnauthorized: false } : undefined });
const q = (t, p) => pool.query(t, p);
const id = async (email) => (await q(`select id::text from profiles where email=$1`, [email])).rows[0]?.id;
const evId = async (slug) => (await q(`select id::text from events where slug=$1`, [slug])).rows[0]?.id;

const maya = await id("maya@click.local");
const cindy = await id("cindy@gmail.com");
const jane = await id("jane@gmail.com");
const test = await id("test@gmail.com");
const theo = await id("theo@click.local");
const partners = [cindy, jane, test, theo].filter(Boolean);

// Always clear Maya's mutuals to these partners first (idempotent + --clean).
for (const pid of partners) {
  const mm = (await q(`select id from mutual_clicks where (user_a_id=least($1::uuid,$2::uuid) and user_b_id=greatest($1::uuid,$2::uuid))`, [maya, pid])).rows;
  for (const r of mm) {
    await q(`delete from click_proposals where mutual_click_id=$1`, [r.id]);
    await q(`delete from mutual_clicks where id=$1`, [r.id]);
  }
}
if (process.argv.includes("--clean")) {
  // Also drop the QA event_attendees rows we added for Maya/Test on the both-going event.
  const mk = await evId("marrickville-pickleball-social-demo");
  if (mk) await q(`delete from event_attendees where event_id=$1 and profile_id = any($2::uuid[])`, [mk, [maya, test]]);
  console.log("cleaned Maya's QA mutuals.");
  await pool.end(); process.exit(0);
}

async function mkMutual(partner, coord, { seenByMaya, expired = false } = {}) {
  const exp = expired ? "now() - interval '1 day'" : "now() + interval '7 days'";
  const r = await q(
    `insert into mutual_clicks (user_a_id, user_b_id, intent_a, intent_b, status, coord_state, mutual_at, expires_at)
     values (least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid), 'friendship','friendship','active',$3, now(), ${exp})
     returning id::text`,
    [maya, partner, coord],
  );
  const mid = r.rows[0].id;
  if (seenByMaya) {
    await q(`update mutual_clicks set seen_at_a = case when user_a_id=$2::uuid then now() else seen_at_a end,
             seen_at_b = case when user_b_id=$2::uuid then now() else seen_at_b end where id=$1`, [mid, maya]);
  }
  return mid;
}
async function mkProposal(mid, ev, by, status, { expired = false } = {}) {
  const exp = expired ? "now() - interval '1 day'" : "now() + interval '7 days'";
  const confirmed = status === "accepted" ? `, confirmed_by='${maya}', confirmed_at=now()` : "";
  await q(`insert into click_proposals (mutual_click_id, suggested_event_id, proposed_by, status, expires_at${status === "accepted" ? ", confirmed_by, confirmed_at" : ""})
           values ($1::uuid,$2::uuid,$3::uuid,$4, ${exp}${status === "accepted" ? ", $5::uuid, now()" : ""})`,
    status === "accepted" ? [mid, ev, by, status, maya] : [mid, ev, by, status]);
}

const bronte = await evId("bronte-run-club-coffee-demo");
const pickle = await evId("marrickville-pickleball-social-demo");

// MA — open, NO plan, reveal UNSEEN → tests the one-time reveal → suggest step.
const MA = await mkMutual(cindy, "open", { seenByMaya: false });
// MB — Jane suggested; Maya is the recipient, reveal seen → "you in?" + confirm/decline.
const MB = await mkMutual(jane, "proposed", { seenByMaya: true });
await mkProposal(MB, bronte, jane, "pending");
// MC — both going: accepted plan + both hold confirmed seats → both-going + add to calendar.
const MC = await mkMutual(test, "confirmed_together", { seenByMaya: true });
await mkProposal(MC, pickle, maya, "accepted");
await q(`insert into event_attendees (event_id, profile_id, status) values ($1::uuid,$2::uuid,'confirmed'),($1::uuid,$3::uuid,'confirmed')
         on conflict do nothing`, [pickle, maya, test]);
// MD — lapsed: past mutual clock + past proposal → "Wound down" past-clicks row.
const MD = await mkMutual(theo, "open", { seenByMaya: true, expired: true });
await mkProposal(MD, bronte, theo, "pending", { expired: true });

console.log(JSON.stringify({ maya, MA_reveal: MA, MB_youin: MB, MC_bothgoing: MC, MD_wounddown: MD }, null, 2));
await pool.end();
