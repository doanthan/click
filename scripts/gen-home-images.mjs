// One-shot generator for the front-page party photos. Re-run any time the
// home collage needs a re-roll: `node scripts/gen-home-images.mjs [name ...]`
// (no args = every spec). Uses the same Gemini models + prompt system as
// POST /api/generate, writes compressed JPGs to public/home/.
// Plain .mjs so Next's build typecheck skips it; Node strips the types from
// the imported src/lib/image-gen.ts natively.
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildPrompt } from "../src/lib/image-gen.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "home");
mkdirSync(outDir, { recursive: true });

const env = readFileSync(join(root, ".env.local"), "utf8");
const apiKey = env.match(/^GOOGLE_AI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!apiKey) {
  console.error("GOOGLE_AI_API_KEY not found in .env.local");
  process.exit(1);
}

const MODELS = {
  pro: "gemini-3-pro-image-preview",
  flash: "gemini-3.1-flash-image-preview",
};

// Direction law for every spec (the render rules live in image-gen.ts):
// each shot gets its OWN light x camera x grade combo, a concrete VERB the
// people are caught doing, and NOBODY performing at the lens - a wave or
// held grin aimed at camera is a reject, laughter must have an in-frame
// trigger. Captions live in the page, not here.
const SPECS = [
  // Full-bleed hero - ONE natural Partiful-style candid. People weighted to the
  // right two-thirds so the headline owns the darker left third; max 2048
  // because it renders full-bleed.
  { name: "hero-main", aspect: "21:9", size: "4K", max: 6400, opts: { shot: "friends", event: "house_party", light: "night_flash", group: "pair", camera: "y2k", extra: "Ultra-wide 21:9 website hero composition, AFTER DARK at a small house party. THE moment: TWO friends mid-dance caught by the flash, filling the RIGHT two-thirds of the wide frame - one mid-laugh with eyes shut and hair mid-whip, the other grinning mid-move with arms up, pure joy at the song that just dropped. They read as best mates losing it together, NOT a couple - no embrace, no slow-dancing, a little air between them. The party is SMALL: at most TWO other people, and they stand BEHIND the dancers on the RIGHT side of the frame, heavily out of focus in the dark with empty hands. ZERO alcohol and ZERO handheld objects anywhere in frame - no cans, no bottles, no glasses, no cups, no snack packets, nothing held in anyone's hands. The LEFT HALF of the wide frame is truly EMPTY - no people, no silhouettes, no faces - only the dark room falling away and one warm string of party lights trailing into the darkness - quiet space where a headline will sit. ONE single continuous photograph taken in one exposure, flowing edge to edge - NOT a diptych, NO borders. Plain unprinted clothing only - NO band t-shirts, NO printed logos, NO legible branding anywhere in frame." } },
  { name: "hero-alt", aspect: "16:9", max: 2048, opts: { shot: "crowd", event: "rooftop", light: "night_flash", group: "small_group", camera: "y2k", extra: "Website hero composition, AFTER DARK - night sky, city lights on, flash-lit foreground. The EVENT is the subject: a Sydney rooftop party in full swing. The ONE moment in this frame: a group toast just landed - FOUR OR FIVE friends fill the RIGHT two-thirds, schooners and cans raised mid-cheer, everyone reacting at once, caught from within the group, laughing at each other NOT at the camera. A mixed group of women and men, NOT a couple, nobody embracing or paired off romantically - this is mates at an event. Behind them more of the party carries on out of focus, festoon lights, the Sydney skyline glowing far behind. The LEFT third of the frame is truly EMPTY of people - the nearest person stands no further left than the centre of frame; the left holds only dark night sky, distant harbour lights and a festoon strand trailing away - quiet space where a headline will sit. ONE single continuous photograph filling the whole frame edge to edge - NOT a diptych, NOT a collage, NO borders. Plain unprinted clothing only - NO band t-shirts, NO printed logos; any cans or bottles face away from camera or fall out of focus - NO legible branding anywhere in frame." } },
  // Hero polaroid fan - the four "this is what events look like" prints that
  // pop onto the hero photo. Alcohol-free by directive (they sit next to the
  // dry hero). rings + dinner are custom events; pickleball + run reuse the
  // collage prints below.
  { name: "hero-rings", aspect: "4:5", opts: { shot: "friends", event: "pottery", customEvent: "a silver ring-making workshop in a small Sydney jewellery studio - one shared timber workbench, small green handheld blowtorches, jewellery pliers, ring mandrels and white soldering blocks scattered across the bench", light: "window_daylight", group: "small_group", camera: "retro", grade: "neutral_film", extra: "LIGHT OVERRIDE - CRITICAL: NOT golden hour, no orange glow. Soft cool window daylight in a warm timber studio. Two friends lean in close watching a third torch-solder a tiny silver ring, the small blue torch flame visible; one holds up their half-finished ring. Takeaway coffee cups on the bench - NO alcohol anywhere, no wine, no beer. NO readable text or logos anywhere." } },
  { name: "hero-dinner", aspect: "4:5", opts: { shot: "friends", event: "wine_bar", customEvent: "a long-table group dinner at a small buzzy Sydney restaurant - one long shared table, tea-light candles, big shared plates of pasta and salads being passed around", light: "indoor_ambient", group: "small_group", camera: "street", extra: "LIGHT OVERRIDE - CRITICAL: NO camera flash. Only the restaurant's warm pendant lamps and tea-light candles - amber, murky, high ISO grain. Five friends mid-dinner: one passing a big plate, one mid-story with hands up, the others laughing; water glasses and food only - NO alcohol anywhere, no wine glasses, no beer. NO readable text or logos anywhere." } },
  // Hero collage
  { name: "hero-rooftop", aspect: "4:5", opts: { shot: "friends", event: "rooftop", light: "night_flash", group: "small_group", camera: "y2k" } },
  { name: "hero-pickleball", aspect: "4:5", opts: { shot: "lifestyle", event: "pickleball", light: "hard_noon", group: "small_group", camera: "retro", extra: "Only the four friends by the bench at one court; at most two distant players on the far court. NO readable text or logos anywhere." } },
  { name: "hero-wine", aspect: "1:1", opts: { shot: "friends", event: "wine_bar", light: "night_flash", group: "pair", camera: "street" } },
  { name: "hero-run", aspect: "4:5", opts: { shot: "lifestyle", event: "run_club", light: "golden_hour", group: "small_group", camera: "bright" } },
  // Photo-wall rail. Each print gets its OWN light key + colour grade (see
  // the additions in src/lib/image-gen.ts) so the rail never reads as one
  // warm-orange batch; extras cap how many people are in frame so each looks
  // like a real small event, not a festival.
  { name: "wall-warehouse", aspect: "4:5", opts: { shot: "crowd", event: "warehouse", light: "night_flash", group: "small_group", camera: "y2k", extra: "AT MOST seven people in the entire frame: three sharp friends up front lit by the flash, two or three blurred figures well behind them, and the rest of the room empty darkness with one string of fairy lights. NOT a packed dancefloor - a party still filling up. Looks like a photo a mate fired off on a cheap camera." } },
  { name: "wall-picnic", aspect: "3:2", opts: { shot: "lifestyle", event: "picnic", light: "overcast", group: "small_group", camera: "retro", grade: "neutral_film", extra: "ONE picnic rug with the five friends on it; the park behind is nearly EMPTY - open grass, big fig trees, at most two tiny distant walkers. Grass reads green not gold. Looks like a photo taken from the rug by one of them." } },
  { name: "wall-pottery", aspect: "1:1", opts: { shot: "friends", event: "pottery", light: "window_daylight", group: "small_group", camera: "ugc", grade: "neutral_film", extra: "Only the three friends at one wheel - NO fourth person, no hands or arms reaching in from any frame edge; behind them empty shelves of unfired pots. All three are locked on the wobbly pot ON THE WHEEL: one shaping it with muddy hands, the other two watching the pot - at most ONE of them laughing at it. NOBODY looks at the camera, nobody waves or shows their hands to the camera. Plain unprinted clothing only - NO graphic tees, NO printed words or logos." } },
  { name: "wall-trivia", aspect: "4:5", opts: { shot: "crowd", event: "trivia", light: "indoor_ambient", group: "small_group", camera: "street", extra: "A quiz team of FOUR huddled around one table over a paper answer sheet, one person mid-scribble, another leaning back thinking, pint glasses everywhere. A mixed group of women and men, NOT a couple, nobody embracing or paired off romantically - this is teammates arguing over an answer. A quiet weeknight: one half-empty table far behind, the rest of the room dark empty chairs." } },
  { name: "wall-volleyball", aspect: "3:2", opts: { shot: "crowd", event: "beach_volleyball", light: "hard_noon", group: "small_group", camera: "bright", grade: "cool_digital", extra: "ONLY the four players mid-rally at one net; the beach behind is almost empty - a couple of distant swimmers at most, NO crowd, NO spectators. Blinding white sand, blue-green water." } },
  { name: "wall-darts", aspect: "1:1", opts: { shot: "detail", event: "darts", light: "indoor_ambient", group: "pair", camera: "moody", extra: "Only the dartboard's own overhead spot lamp and dim pub gloom around it, murky amber falloff. Exactly ONE dartboard, mounted on the wall. One hand mid-throw from the side, a pint and chalk scoreboard nearby, nobody else visible. NO brand names, NO readable words anywhere in frame - the board shows only its number ring." } },
  { name: "wall-karaoke", aspect: "4:5", opts: { shot: "crowd", customEvent: "a private-room karaoke (KTV) night in Haymarket, Sydney - padded booth seats, a glowing lyric screen, wireless mics, jugs and fried snacks on the low table", event: "karaoke", light: "neon_night", group: "small_group", camera: "y2k", grade: "cool_digital", extra: "A group of East and Southeast Asian Australian friends in their mid-twenties in their own private KTV room - one mid-belt into the mic with eyes shut, one up dancing with a tambourine, the others collapsed laughing into the padded booth. The lyric screen glows soft and OUT OF FOCUS behind them - NO readable words on it. LED strip colour catches the walls and faces. NOT a public bar - a small private padded room, nobody outside this group of five. NO readable text or logos anywhere." } },
];

async function callGemini(model, prompt, imageConfig) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.95,
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig,
          },
        }),
        signal: controller.signal,
      },
    );
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function generate(spec) {
  const prompt = buildPrompt(spec.opts);
  // Two pro attempts for quality, flash as the safety net.
  for (const model of [MODELS.pro, MODELS.pro, MODELS.flash]) {
    let reply;
    try {
      // size (e.g. "4K") only where it matters - the full-bleed heroes.
      reply = await callGemini(model, prompt, { aspectRatio: spec.aspect, ...(spec.size ? { imageSize: spec.size } : {}) });
    } catch {
      console.warn(`  ${spec.name}: ${model} timed out, retrying`);
      continue;
    }
    if (reply.status === 429 || reply.status === 503) {
      console.warn(`  ${spec.name}: ${model} ${reply.status}, backing off`);
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }
    if (reply.status !== 200) {
      console.warn(`  ${spec.name}: ${model} HTTP ${reply.status}: ${reply.body.slice(0, 160)}`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(reply.body);
    } catch {
      continue;
    }
    const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    if (!inline?.data) {
      console.warn(`  ${spec.name}: ${model} returned no image, retrying`);
      continue;
    }
    const out = join(outDir, `${spec.name}.jpg`);
    await sharp(Buffer.from(inline.data, "base64"))
      .resize(spec.max ?? 1400, spec.max ?? 1400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(out);
    console.log(`✔ ${spec.name}.jpg (${model})`);
    return true;
  }
  console.error(`✖ ${spec.name}: all attempts failed`);
  return false;
}

const only = process.argv.slice(2);
const queue = only.length ? SPECS.filter((s) => only.includes(s.name)) : [...SPECS];
console.log(`Generating ${queue.length} image(s) → public/home/`);

const failed = [];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let spec = queue.shift(); spec; spec = queue.shift()) {
      if (!(await generate(spec))) failed.push(spec.name);
    }
  }),
);

if (failed.length) {
  console.error(`\nFailed: ${failed.join(", ")} - re-run with: node scripts/gen-home-images.mjs ${failed.join(" ")}`);
  process.exit(1);
}
console.log("\nAll images generated.");
