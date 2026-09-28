// One-shot generator for the front-end photos (home hero, lane tiles, story
// frame, event-card fallbacks). Re-run any time they need a re-roll:
// `node scripts/gen-home-images.mjs [name ...]` (no args = every spec).
// Renders through OpenRouter's Image API with Meta's Muse Image model and
// writes compressed JPGs to public/home/. Most specs use the prompt system from
// src/lib/image-gen.ts plus the LOOK block below; the home lane tiles carry
// their own full prompt instead (see TAIL). Needs OPENROUTER_API_KEY in .env.local.
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
const apiKey = env.match(/^OPENROUTER_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!apiKey) {
  console.error("OPENROUTER_API_KEY not found in .env.local");
  process.exit(1);
}

const MODEL = "meta/muse-image";

// Muse ignores aspect_ratio on its own (a 16:9 ask came back 3:2), so each
// request also pins the native pixel frame for its ratio - OpenRouter treats
// an explicit size as authoritative. Same table as wizelfront's
// MUSE_NATIVE_FRAME_SIZES (lib/image-model-policy.js).
const MUSE_SIZES = {
  "1:1": "1600x1600", "9:16": "1152x2048", "16:9": "2048x1152",
  "2:3": "1280x1920", "3:2": "1920x1280", "3:4": "1344x1792", "4:3": "1792x1344",
};

// The look for every frame, appended after buildPrompt(). It has to override
// in words rather than options: HUMAN_MODEL_DIRECTIVE always asks for a warm
// 35mm film render and UGC_DIRECTIVE is written for product selfies, and both
// are verbatim spec text that must not be reworded.
const LOOK = `LOOK - FINAL WORD (overrides every earlier film, grade, warmth or light instruction above)
A real phone photo one of the friends took at the event: a modern iPhone on auto, handheld from a few steps back - not a selfie, not a mirror shot, nothing over the lens. Ignore any bedroom, bathroom or product clutter mentioned above; the only clutter is what belongs at THIS event.
COLOUR: true-to-life, neutral-to-slightly-cool white balance - the way a phone renders the light that is actually there. Whites are white, greys are grey, greens are green, skin is natural and varied. NEVER amber, orange, golden, honey or sepia. No golden hour, no sunset glow, no warm tungsten, candle or string-light cast, no film emulation, no film grain, no light leaks, no vignette, no colour grade.
ORGANIC: nobody poses or looks at the camera, nobody waves at all, and nobody in the background grins or looks into the lens either; everyone is caught mid-action by something happening in the frame. No finger, thumb or phone edge over any part of the frame - ignore any earlier instruction to show one. Everyday clothes, real bodies, real skin texture, slightly imperfect handheld framing, ordinary background detail left exactly as it was. It should look like a photo from someone's camera roll, not a campaign.`;

// The home lane tiles skip buildPrompt. Its output is ~28k characters that are
// the same for every image bar at most 800 (customEvent + extra), and that
// shared text - CASTING's "bucket hats where they fit", the beach and Norfolk
// pine PLACE block, the crowd shot's "nearest three or four people" - brought
// every tile back as the same cast, framed the same way. A spec with its own
// `prompt` names its angle, lens, light, hour, Sydney setting and cast; only
// this tail is shared. Muse habits seen while tuning them: a man and a woman
// shoulder to shoulder reads as a couple, a crouched ultra-wide reads as a
// sports ad, and a runner looking back from the pack grins into the lens.
// Light is only what each place already has, never a flash: flash and evenly
// lit faces read as AI (user feedback 2026-09-25). The grain comes from
// addGrain afterwards, not from the prompt.
const TAIL = `This must look like a real photo from a friend's camera roll - not an ad, not stock, not a film still. An ordinary smartphone on auto with the flash off, in whatever light the place already has. Nothing is lit for the photo, so the exposure is a little off: bright patches blow out, shadows go properly dark, and some faces fall into shade. Slightly crooked handheld framing, focus a touch soft, no HDR look, no filter and no colour grade. Real people of different ages, heights and builds, bare-headed, in everyday clothes with creases, natural unretouched skin seen at a normal distance. Nobody poses or performs for the camera. No text, no logos, no brand names anywhere.`;

// Direction law for every spec: a concrete VERB the people are caught doing,
// NOBODY performing at the lens - a wave or held grin aimed at camera is a
// reject, background included, and laughter must have an in-frame trigger -
// daylight, a phone flash or cool room light (the lane tiles take no flash,
// see TAIL), never golden hour, candles or amber practicals. `aspect` is what the slot crops to, from
// Muse's native set (1:1, 16:9, 9:16, 3:2, 2:3, 4:3, 3:4): the lane tiles and
// 16:9 event cards want landscape, the 4:5 story frame wants 3:4. `extra` is
// clamped to 600 chars by buildPrompt. Captions live in the page, not here.
const SPECS = [
  // Full-bleed hero, also the OG image. The left half sits under the dark
  // scrim and the headline, and mobile crops at 68% across - people go right.
  { name: "hero-discover-v2", aspect: "16:9", max: 2048, opts: { shot: "crowd", event: "picnic", customEvent: "a long Sunday lunch at one shared outdoor table in the leafy backyard of a Sydney terrace house - share plates, a jug of water, mismatched chairs", light: "overcast", group: "small_group", camera: "ugc", grade: "cool_digital", extra: "Website hero: every person sits in the RIGHT 45% of the wide frame - no head, face or raised hand left of the centre line, because a headline covers the left side. The left 55% is only shaded backyard - dark green hedge, fig-tree shade and the near end of the table running out of frame. One friend is mid-story with a hand up, one passes a plate across, the others react to the story, not the camera. Plain unprinted clothing; no readable text or logos." } },
  // Home lane tiles (LANES in src/app/page.tsx): a 4:3 crop with the title
  // below. hero-dinner, hero-run and wall-karaoke double as the 16:9 event-card
  // fallbacks (src/lib/event-images.ts), so they render 3:2, which loses the
  // least to either crop. hero-run and wall-karaoke are also the images of the
  // seeded "Saturday run club + coffee" and "KTV private-room karaoke" demo
  // events (scripts/seed-demo-events.mjs), so those two scenes have to stay.
  {
    name: "hero-rings",
    aspect: "4:3",
    grain: true,
    prompt: `A candid phone photo at an evening silver ring-making workshop in a small upstairs jewellery studio in Surry Hills, Sydney.

Camera: over the shoulder of a guy working at the bench - his shoulder and the back of his head are a soft dark blur along the left edge of the frame. The phone focuses past him onto the bench and the friend opposite.

Moment: his hands, in focus, tap a silver ring around a steel ring mandrel with a small rawhide mallet. Across the narrow timber bench his friend - a woman in her early thirties with a long straight black ponytail and a navy work apron - leans on her elbows watching, mid-laugh at how badly it is going. At the next bench along, a man in his fifties with round glasses solders with a small blue torch flame, paying no attention to anyone.

Bench clutter: pliers, files, a jeweller's saw, a scratched wooden bench peg, silver offcuts, sandpaper, a steel block, a mug of tea, a phone face down.

Place: an old sash window behind them looks out over the corrugated-iron roofs, brick chimneys and iron-lace balconies of Surry Hills terraces under a pale dusk sky. Bare white walls and a pegboard of tools.

Light: the overhead light is off. The only light is the fading dusk through the window and small cool-white LED lamps clamped to the benches, which throw hard little pools of light onto the hands, the ring and the tools and spill up onto faces that stay half in shadow. Away from the lamps the room is dim and murky grey-blue - the walls, the pegboard, the corners. The window is the brightest thing in the frame. The phone struggles a little: soft focus, noise in the shadows. Neutral to cool colour, no golden glow.`,
  },
  {
    name: "hero-dinner",
    aspect: "3:2",
    grain: true,
    prompt: `A candid phone photo taken from directly above a big round yum cha table on a busy Sunday late morning in a huge old-school Chinatown restaurant in Haymarket, Sydney - one of the friends is standing on their chair, holding the phone straight down over the table.

From above: a crowded glass lazy Susan in the middle - open bamboo steamers of har gow, siu mai and fluffy char siu bao, a plate of gai lan glossy with oyster sauce, a few egg tarts, a metal teapot, little dishes of chilli oil and soy - on a white tablecloth with tea splashes and crumpled napkins. Around the rim, five friends seen from above and slightly behind: two pairs of chopsticks reaching into the same steamer, one person spinning the lazy Susan, one topping up everyone's tea, one leaning back in their chair laughing at something across the room. We mostly see the tops of heads, shoulders, arms and hands, and a couple of faces turned to each other.

People: a Chinese-Australian guy in his thirties with a short fade and a navy polo, a woman with short curly red hair in a striped tee, a Lebanese-Australian woman in a cream knit with her dark hair loose, a lanky guy with a mullet in a faded green flannel shirt, a young woman with box braids.

Light: a grey, overcast day, and the dining room is dimmer than it seems in person - the ceiling lights add little. The main light is flat daylight from the tall windows along one side: the window side of the table is bright, the tablecloth there almost blown out, while the far side and the faces there sink into soft shadow. The friend holding the phone blocks some of it, so a soft shadow of their head and arm falls across the table. Neutral, slightly grey colour. The busy carpeted dining room and the edge of a steaming food trolley show at the corners of the frame.`,
  },
  {
    name: "hero-run",
    aspect: "3:2",
    grain: true,
    prompt: `A candid phone photo from a Saturday-morning run club on the Bondi-to-Bronte coastal walk in Sydney.

Camera: taken on the phone's 3x zoom by a club member waiting about twenty metres further up the path - compressed telephoto perspective, so the runners coming toward the camera, the sandstone headland and the ocean behind them all stack close together. Eye level, straight on, nothing dramatic.

Moment: the group strung out along the path, the front two talking as they run. A stocky Samoan-Australian guy in his thirties in a faded black singlet is mid-sentence, gesturing with one hand; the tall woman beside him, late thirties with a short grey-blonde crop, listens while puffing, red-faced. Behind them, smaller: a lanky twenty-something with long hair tied back, a Korean-Australian woman in an oversized white tee, and two more further back. Worn mismatched activewear, sweat patches. A little motion blur on arms and feet.

Place: the concrete coastal path with its white-painted metal railing, honey-coloured sandstone cliffs and low coastal scrub, the Pacific and a line of white surf breaking on the rocks.

Light: early morning with the low sun behind the runners, just out of the top of the frame. Their faces and fronts are in shade, with bright edges on hair and shoulders; the path and the sea behind them glare pale, nearly blown out, and a faint haze of flare washes over the frame. Pale, cool morning colour, not golden.`,
  },
  {
    name: "wall-karaoke",
    aspect: "3:2",
    grain: true,
    prompt: `A candid phone photo inside a small private karaoke room in Haymarket, Sydney, around 11pm on a Friday, taken without flash.

Camera: taken from the far end of the room across the low table, flash off.

Light: only the room's own light. Violet and blue LED strips run along the ceiling, and the big lyric screen at the back of the room is the brightest thing in the frame, blown out to a pale blurred glow. The people are lit by the screen and the LEDs - faces in blue-violet half-light, the singer's edges picked out against the screen - while the near end of the table and the booth sit in near-darkness with a few glints on the glasses. The phone struggles in the dark: heavy noise, soft focus, motion blur on the flung arm.

Moment: a tall guy in a baggy white tee stands on the booth seat, eyes squeezed shut, belting into a wireless mic with his other arm flung out. Beside him a Vietnamese-Australian woman with a blunt fringe is doubled over laughing, a tambourine in one hand. At the right end of the booth a guy in a denim jacket ignores them both, chin in hand, scrolling the song list on a tablet that lights his face from below. The lyric screen's words are blurred and unreadable.

Table: popcorn chicken in a paper boat, a jug of iced lemon tea, scattered glasses, scrunched napkins, a phone face down.`,
  },
  // Story frame (4:5 box on the home page) and the default event-card fallback.
  // `crowd`, not `lifestyle`: that scene's "arriving" cue kept adding a
  // background figure waving at the lens.
  { name: "hero-rooftop", aspect: "3:4", opts: { shot: "crowd", event: "rooftop", light: "overcast", group: "small_group", camera: "ugc", grade: "cool_digital", extra: "A relaxed daytime rooftop get-together on a grey afternoon, city towers flat and cool behind. Four people who only just met stand in a loose circle FACING EACH OTHER - not the view, not the camera: one mid-laugh at what another just said, one mid-sentence, one listening with arms folded. Drinks rest on a ledge, nobody holds one up. Faces sit in the middle of the frame. No readable text or logos." } },
  // Event-card fallbacks only (src/lib/event-images.ts, 16:9 cards).
  { name: "hero-pickleball", aspect: "16:9", opts: { shot: "lifestyle", event: "pickleball", light: "hard_noon", group: "small_group", camera: "ugc", grade: "cool_digital", extra: "Only four friends by the bench at one court, one mid-laugh bouncing a ball on a paddle; at most two distant players on the far court. NO readable text or logos anywhere." } },
  { name: "wall-pottery", aspect: "16:9", opts: { shot: "crowd", event: "pottery", light: "window_daylight", group: "small_group", camera: "ugc", grade: "cool_digital", extra: "Only three friends at one wheel - no fourth person, no hands reaching in from the frame edges; empty shelves of unfired pots behind. All three are locked on the wobbly pot on the wheel: one shaping it with muddy hands, two watching it, at most one laughing. Nobody looks at the camera. Plain unprinted clothing, no printed words or logos." } },
  { name: "wall-picnic", aspect: "16:9", opts: { shot: "lifestyle", event: "picnic", customEvent: "a picnic mixer in Centennial Park, Sydney - one big rug on the grass, shared snacks, a small portable speaker, big fig trees behind", light: "overcast", group: "small_group", camera: "ugc", grade: "cool_digital", extra: "Five friends sit on one rug FACING EACH OTHER, not the view: one mid-story with a hand up, one reaching into the snacks, two laughing at the story. The park behind is nearly empty - open green grass, fig trees, at most two tiny distant walkers. Grass reads green, not gold. Looks like a photo taken from the rug by one of them. No readable text or logos." } },
  { name: "wall-trivia", aspect: "16:9", opts: { shot: "crowd", event: "trivia", light: "night_flash", group: "small_group", camera: "ugc", grade: "cool_digital", extra: "A quiz team of four huddled over one paper answer sheet - one mid-scribble, one leaning back thinking, one arguing an answer; a mixed group of women and men, not a couple. One phone flash lights them neutral white; the pub behind is dim and grey-green, never amber. A quiet weeknight: empty chairs behind, any other team busy with its own sheet. No readable writing on the sheet, no logos." } },
];

async function callOpenRouter(prompt, aspectRatio) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, aspect_ratio: aspectRatio, size: MUSE_SIZES[aspectRatio] }),
      signal: controller.signal,
    });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

// Film grain for specs with `grain` (the lane tiles). The tiles reach the
// screen shrunk to 384-640w by next/image, re-encoded as WebP and resampled
// again by the polaroid tilt, which smooths pixel-fine noise away (half-size
// noise at sigma 14 was invisible there). So the noise is made at a third of
// the size and scaled up into ~3px grains. Overlay keeps the average
// brightness and puts the grain in the midtones, like film.
async function addGrain(image) {
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const grain = await sharp({
    create: { width: Math.ceil(width / 3), height: Math.ceil(height / 3), channels: 3, noise: { type: "gaussian", mean: 128, sigma: 24 } },
  })
    .greyscale()
    .resize(width, height)
    .png()
    .toBuffer();
  return sharp(data, { raw: { width, height, channels } }).composite([{ input: grain, blend: "overlay" }]);
}

let totalCost = 0;

async function generate(spec) {
  const body = spec.prompt ? `${spec.prompt}\n\n${TAIL}` : `${buildPrompt(spec.opts)}\n\n${LOOK}`;
  // Belt and braces with MUSE_SIZES: the frame is restated in words too.
  const prompt = `${body}\n\nOUTPUT FRAME: one complete photograph in ${spec.aspect} aspect ratio at the model's native resolution.`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let reply;
    try {
      reply = await callOpenRouter(prompt, spec.aspect);
    } catch {
      console.warn(`  ${spec.name}: attempt ${attempt} timed out, retrying`);
      continue;
    }
    if (reply.status === 429 || reply.status >= 500) {
      console.warn(`  ${spec.name}: HTTP ${reply.status}, backing off`);
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }
    if (reply.status !== 200) {
      console.warn(`  ${spec.name}: HTTP ${reply.status}: ${reply.body.slice(0, 300)}`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(reply.body);
    } catch {
      continue;
    }
    const item = data.data?.[0];
    const bytes = item?.b64_json
      ? Buffer.from(item.b64_json, "base64")
      : item?.url
        ? Buffer.from(await (await fetch(item.url)).arrayBuffer())
        : null;
    if (!bytes) {
      console.warn(`  ${spec.name}: no image in the response, retrying`);
      continue;
    }
    const cost = Number(data.usage?.cost) || 0;
    totalCost += cost;
    const out = join(outDir, `${spec.name}.jpg`);
    let image = sharp(bytes).resize(spec.max ?? 1400, spec.max ?? 1400, { fit: "inside", withoutEnlargement: true });
    if (spec.grain) image = await addGrain(image);
    const info = await image.jpeg({ quality: 82, mozjpeg: true }).toFile(out);
    console.log(`✔ ${spec.name}.jpg ${info.width}x${info.height} ($${cost.toFixed(3)})`);
    return true;
  }
  console.error(`✖ ${spec.name}: all attempts failed`);
  return false;
}

const only = process.argv.slice(2);
const queue = only.length ? SPECS.filter((s) => only.includes(s.name)) : [...SPECS];
console.log(`Generating ${queue.length} image(s) with ${MODEL} → public/home/`);

const failed = [];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let spec = queue.shift(); spec; spec = queue.shift()) {
      if (!(await generate(spec))) failed.push(spec.name);
    }
  }),
);

console.log(`\nOpenRouter cost: $${totalCost.toFixed(3)}`);
if (failed.length) {
  console.error(`Failed: ${failed.join(", ")} - re-run with: node scripts/gen-home-images.mjs ${failed.join(" ")}`);
  process.exit(1);
}
console.log("All images generated.");
