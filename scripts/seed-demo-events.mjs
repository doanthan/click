// Seeds believable Sydney demo events for the front page (trending band +
// discover) without touching tester-created rows. Additive + idempotent:
// re-running first clears ONLY its own rows (event slugs ending in "-demo",
// profiles at @seed.letsclick.app). Images reuse the generated candids in
// public/home/. Run: `node scripts/seed-demo-events.mjs` (or with `--clean`
// to remove the demo rows and stop).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env.local"), "utf8");
const url = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!url) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });

// Next occurrence of a Sydney-local weekday+time, always in the future.
function nextSydney(weekday, hour, minute = 0) {
  const now = new Date();
  for (let d = 0; d < 9; d++) {
    const probe = new Date(now.getTime() + d * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZoneName: "longOffset",
    }).formatToParts(probe);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    if (get("weekday") !== weekday) continue;
    const offset = get("timeZoneName").replace("GMT", "") || "+10:00";
    const iso = `${get("year")}-${get("month")}-${get("day")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
    const when = new Date(iso);
    if (when.getTime() > now.getTime() + 3 * 3600_000) return when;
  }
  throw new Error(`no upcoming ${weekday}`);
}

const PROFILES = [
  ["Mia", "female"], ["Tom", "male"], ["Priya", "female"], ["Jess", "female"],
  ["Ken", "male"], ["Sofia", "female"], ["Liam", "male"], ["Aisha", "female"],
  ["Nick", "male"], ["Grace", "female"], ["Marcus", "male"], ["Lena", "female"],
  ["Ravi", "male"], ["Chloe", "female"], ["Dan", "male"], ["Hana", "female"],
  ["Ollie", "male"], ["Zara", "female"], ["Ben", "male"], ["Ivy", "female"],
  ["Sam", null], ["Ruby", "female"], ["Jack", "male"], ["Nadia", "female"],
];

const EVENTS = [
  {
    slug: "rooftop-sundowners-kirribilli-demo",
    title: "Rooftop sundowners",
    group: "Harbour Socials",
    host: "Mia",
    category: "Nightlife",
    starts: nextSydney("Thu", 18), hours: 3,
    location: "The Terrace rooftop", suburb: "Kirribilli", lat: -33.8478, lng: 151.2115,
    price: 1500, capacity: 40, going: 23,
    image: "/home/hero-rooftop.jpg",
    alt: "Friends talking at a rooftop party with the Harbour Bridge behind",
    description: "Golden hour over the bridge, a terrace full of new faces, and nowhere anyone needs to be. Come solo or bring a mate - the icebreaker rounds do the heavy lifting and the view does the rest.",
    goal: "Great for people who want to meet new faces over a drink without the big-night energy.",
    fomo: "A Thursday favourite - the terrace fills early.",
  },
  {
    slug: "bronte-run-club-coffee-demo",
    title: "Saturday run club + coffee",
    group: "Bronte Runners",
    host: "Tom",
    category: "Fitness",
    starts: nextSydney("Sat", 7), hours: 1.5,
    location: "Bronte Beach south end", suburb: "Bronte", lat: -33.9036, lng: 151.2649,
    price: 0, capacity: 30, going: 18,
    image: "/home/hero-run.jpg",
    alt: "A run club regrouping by the beach after a Saturday morning run",
    description: "An easy 5k along the coast path, then flat whites on the grass. Every pace is welcome - the coffee queue is where everyone actually meets.",
    goal: "Great for early risers who want their weekends to start with people, not a screen.",
    fomo: "Sydney's easiest hello.",
  },
  {
    slug: "newtown-trivia-night-demo",
    title: "Big-room trivia night",
    group: "Inner West Trivia",
    host: "Priya",
    category: "Games",
    starts: nextSydney("Wed", 19), hours: 2.5,
    location: "The Duke of Enmore", suburb: "Newtown", lat: -33.8963, lng: 151.1794,
    price: 500, capacity: 36, going: 21,
    image: "/home/wall-trivia.jpg",
    alt: "A trivia team huddled over an answer sheet at a pub",
    description: "Teams are drawn on the night, so nobody arrives with an advantage or alone. Six rounds, one jackpot question, and a room that gets louder every round.",
    goal: "Great for people whose ideal night out has a scoreboard and a snack menu.",
    fomo: "Now live for members to discover.",
  },
  {
    slug: "marrickville-pickleball-social-demo",
    title: "Pickleball social - all levels",
    group: "Paddle Up",
    host: "Jess",
    category: "Fitness",
    starts: nextSydney("Sun", 16), hours: 2,
    location: "Marrickville outdoor courts", suburb: "Marrickville", lat: -33.9111, lng: 151.1553,
    price: 1200, capacity: 24, going: 17,
    image: "/home/hero-pickleball.jpg",
    alt: "A pickleball social on an outdoor court at golden hour",
    description: "Rotating doubles so you play with everyone, paddles provided, zero experience needed. The rallies are short and the sideline chat is most of the point.",
    goal: "Great for people who make friends faster with a paddle in hand.",
    fomo: "Courts booked till sunset.",
  },
  {
    slug: "haymarket-ktv-night-demo",
    title: "KTV private-room karaoke",
    group: "Midnight Mics",
    host: "Ken",
    category: "Nightlife",
    starts: nextSydney("Fri", 19, 30), hours: 3,
    location: "Big Echo KTV", suburb: "Haymarket", lat: -33.8797, lng: 151.2043,
    price: 2000, capacity: 12, going: 9,
    image: "/home/wall-karaoke.jpg",
    alt: "Friends mid-song in a private karaoke room in Haymarket",
    description: "A private room, a shared queue, and a strict no-judgement rule. Duets encouraged, jugs and fried snacks included - the group playlist is built together on the night.",
    goal: "Great for people who click over a shared microphone and a terrible high note.",
    fomo: "Small room, big voices.",
  },
];

async function clean(client) {
  await client.query(
    `delete from event_attendees where event_id in (select id from events where slug like '%-demo')`,
  );
  await client.query(`delete from events where slug like '%-demo'`);
  await client.query(`delete from profiles where email like '%@seed.letsclick.app'`);
}

const client = await pool.connect();
try {
  await client.query("begin");
  await clean(client);
  if (process.argv.includes("--clean")) {
    await client.query("commit");
    console.log("Demo rows removed.");
    process.exit(0);
  }

  const profileIds = [];
  for (const [name, gender] of PROFILES) {
    const idx = profileIds.length;
    const r = await client.query(
      `insert into profiles (email, display_name, gender, suburb, age, photo_url)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        `demo.${name.toLowerCase()}@seed.letsclick.app`,
        name,
        gender,
        ["Newtown", "Bronte", "Surry Hills", "Marrickville", "Kirribilli", "Redfern"][idx % 6],
        24 + (idx % 11),
        // First 16 wear the generated contact-sheet faces (public/home/avatars/),
        // sliced by the avatar sheet one-off; the rest stay photo-less.
        idx < 16 ? `/home/avatars/av-${idx + 1}.jpg` : null,
      ],
    );
    profileIds.push(r.rows[0].id);
  }

  let eventIdx = 0;
  for (const e of EVENTS) {
    const ends = new Date(e.starts.getTime() + e.hours * 3600_000);
    const ev = await client.query(
      `insert into events (slug, title, description, group_name, host_name, category, status,
         starts_at, ends_at, location_name, suburb, latitude, longitude,
         price_cents, capacity, image_url, image_alt, relationship_goal, fomo)
       values ($1,$2,$3,$4,$5,$6,'live',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning id`,
      [e.slug, e.title, e.description, e.group, e.host, e.category, e.starts, ends,
       e.location, e.suburb, e.lat, e.lng, e.price, e.capacity, e.image, e.alt, e.goal, e.fomo],
    );
    const eventId = ev.rows[0].id;
    for (let i = 0; i < e.going; i++) {
      // Joined over the past two weeks, oldest first, so the counts read
      // lived-in; the start offset rotates per event so each card's avatar
      // preview leads with different faces.
      const joined = new Date(Date.now() - (e.going - i) * 13 * 3600_000);
      await client.query(
        `insert into event_attendees (event_id, profile_id, status, created_at, updated_at)
         values ($1, $2, 'confirmed', $3, $3)`,
        [eventId, profileIds[(eventIdx * 5 + i) % profileIds.length], joined],
      );
    }
    eventIdx++;
    console.log(`✔ ${e.title} - ${e.going}/${e.capacity} going, ${e.starts.toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}`);
  }

  await client.query("commit");
  console.log("\nSeeded 5 demo events + 24 demo profiles.");
} catch (err) {
  await client.query("rollback");
  console.error("Seed failed, rolled back:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
