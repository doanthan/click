import fs from "node:fs";
import pg from "pg";
const env = fs.readFileSync(".env.local","utf8");
const url = env.match(/DATABASE_URL=(.+)/)[1].replace(/["']/g,"").trim();
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const JANEY = "f3832769-7cd5-4e4a-9225-b33667fa73df";
const r = await pool.query(`
  select
    case when m.profile_a_id=$1::uuid then pb.display_name else pa.display_name end as other,
    event.slug as suggested_slug, event.title as suggested_title,
    both_going.slug as both_going_slug, both_going.title as both_going_title
  from mutual_clicks m
  join profiles pa on pa.id=m.profile_a_id
  join profiles pb on pb.id=m.profile_b_id
  left join event_proposals p on p.mutual_click_id=m.id
  left join events event on event.id=coalesce(p.suggested_event_id,m.suggested_event_id)
    and event.starts_at>now() and event.status in ('live','featured','waitlist')
    and (select count(*) from event_attendees fc where fc.event_id=event.id and (fc.status='confirmed' or (fc.status='pending_payment' and fc.hold_expires_at>now())))<event.capacity
  left join lateral (
    select e2.slug,e2.title from events e2
    join event_attendees me on me.event_id=e2.id and me.profile_id=$1::uuid and me.status='confirmed'
    join event_attendees them on them.event_id=e2.id and them.status='confirmed' and them.profile_id=(case when m.profile_a_id=$1::uuid then m.profile_b_id else m.profile_a_id end)
    where e2.starts_at>now() order by e2.starts_at asc limit 1
  ) both_going on true
  where m.profile_a_id=$1::uuid or m.profile_b_id=$1::uuid
  order by m.created_at desc`, [JANEY]);
console.log("As Janey, mutual clicks:");
for (const row of r.rows) console.log(JSON.stringify(row));
await pool.end();
