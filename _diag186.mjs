import fs from "node:fs";
import pg from "pg";
const env = fs.readFileSync(".env.local","utf8");
const url = env.match(/DATABASE_URL=(.+)/)[1].replace(/["']/g,"").trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const jazz = await pool.query(`select id::text, slug, title, status, starts_at, ends_at, price_cents, capacity from events where title ilike '%jazz%' order by starts_at`);
console.log("=== JAZZ events ===");
for (const r of jazz.rows) console.log(JSON.stringify(r));

// attendees for each jazz event
for (const e of jazz.rows) {
  const att = await pool.query(
    `select a.status, p.display_name, p.id::text as pid
     from event_attendees a join profiles p on p.id=a.profile_id
     where a.event_id=$1 order by a.status`, [e.id]);
  console.log(`--- attendees for ${e.slug} (${e.status}, starts ${e.starts_at?.toISOString?.()||e.starts_at}) ---`);
  for (const r of att.rows) console.log(`   ${r.status}  ${r.display_name}  ${r.pid}`);
}

console.log("=== mutual_clicks involving Ellen/Jane ===");
const mc = await pool.query(`
  select m.id::text, pa.display_name a, pb.display_name b, m.suggested_event_id::text, e.title sugg_title
  from mutual_clicks m
  join profiles pa on pa.id=m.profile_a_id
  join profiles pb on pb.id=m.profile_b_id
  left join events e on e.id=m.suggested_event_id
  where pa.display_name ilike '%ellen%' or pb.display_name ilike '%ellen%' or pa.display_name ilike '%jane%' or pb.display_name ilike '%jane%'`);
for (const r of mc.rows) console.log(JSON.stringify(r));
await pool.end();
