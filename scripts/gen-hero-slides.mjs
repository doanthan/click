// Generator for the home hero's photo cycle: public/home/hero-slide-*.jpg.
// Re-roll with `node scripts/gen-hero-slides.mjs [name ...]` (no args = every
// spec). The slides sit next to the warm night-courtyard hero
// (hero-courtyard.jpg), so they carry their own warm-evening TAIL rather than
// gen-home-images.mjs's cool phone-photo LOOK. Renders through OpenRouter's
// Image API with Meta's Muse Image model. Needs OPENROUTER_API_KEY in .env.local.
//
// Candidates land in <os tmpdir>/click-hero-slides/<name>-<n>.jpg, never in
// public/home, because a slide has to be judged IN PLACE: a 16:9 contact sheet
// passed a face behind "next" and another behind the MutualToast card. Copy a
// candidate over public/home/hero-slide-<name>.jpg, freeze the page on its slot
// from the devtools console, and look at 1440x900 and 390x844:
//   document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 12000; });
// (12000 = rooftop, 20000 = bowls, 28000 = gig.) In image coordinates the
// headline covers x 14.5-51.6%, y 27-73%, the search form reaches x 62% at
// y 64-73%, the MutualToast card covers x 70-90%, y 17-29%, and a 16:10 screen
// crops 5% off each side. On a phone the frame is each slide's `crop` in
// HERO_SLIDES (src/app/page.tsx).
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(tmpdir(), "click-hero-slides");
mkdirSync(outDir, { recursive: true });

const env = readFileSync(join(root, ".env.local"), "utf8");
const apiKey = env.match(/^OPENROUTER_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
if (!apiKey) {
  console.error("OPENROUTER_API_KEY not found in .env.local");
  process.exit(1);
}

// The look and the framing every slide shares. The framing half is what made
// the set work as a hero: an earlier round without it came back as medium
// shots, with faces behind the headline and the card.
const TAIL = `This must look like a real candid photograph by a friend who happens to be a good photographer - an unposed moment on a real night out, not an ad, not a stock shoot, not a film still. A full-frame camera with a fast prime lens wide open in available light: shallow depth of field, soft round bokeh from the lights, true blacks in the shadows, fine natural grain, honest colour - warm only where a lamp or bulb is actually warm, blue where the sky or the shadows are blue. Real people of different ages, heights, builds and backgrounds, bare-headed, in everyday going-out clothes with creases, natural unretouched skin. Nobody looks into the lens, poses, waves or performs for the camera; everyone is reacting to something happening in the frame. Nobody holds a drink up. No text, no logos, no brand names, no readable signage anywhere.

Website hero framing - this matters more than anything else. A WIDE shot from five or six metres back, the way an event photographer stands off to take in the whole scene: the place is most of the picture and the people are small in it, each head only about a twelfth of the frame's height. Every person sits in the RIGHT half of the frame (52% to 95% of the way across) and in its middle band, heads between 40% and 65% of the way down. The LEFT HALF holds no people at all - only dark, out-of-focus surroundings - because a headline covers it. The TOP-RIGHT corner holds no faces either - only sky, lights or background - because a card covers it.`;

// One full prompt per slide, each naming its own angle, lens, light, place and
// cast, so the set doesn't read as one shoot. These rendered the live files.
const SPECS = [
  {
    name: "bowls",
    prompt: `A candid wide photo at a Friday twilight barefoot bowls session at an old suburban bowling club in Sydney's inner west.

Camera: 35mm lens from the corner of the green, six metres away at eye level, so the empty green fills the lower left of the frame.

Moment: in the lower right, a woman in her late twenties with a short black bob and a mustard knit jumper crouches low on the mat, one arm still extended from her delivery, watching her bowl roll away across the grass - the bowl touches the ground, never in the air. Just behind her, a tall Maori-Australian guy with his curly hair tied up in a knot and a white linen shirt sits forward on the edge of a timber bench, both hands on his head in suspense, and beside him a woman in her fifties with a silver pixie cut and a denim jacket is laughing.

Place: the floodlit green stretches away to the left; the club's low brick clubhouse sits in the soft background with its windows glowing; a white picket fence; dark gum trees against the sky. No other players.

Light: blue hour - a deep blue-violet sky, the floodlights just switched on and cool white, warm light from the clubhouse windows.`,
  },
  {
    name: "rooftop",
    prompt: `A candid wide photo across a small rooftop terrace above a Darlinghurst terrace row in Sydney, at the end of blue hour on a warm spring evening.

Camera: 35mm lens from the far corner of the rooftop, five or six metres back, at standing eye level looking slightly down.

Moment: in the lower right of the frame, four friends sit on low outdoor cushions and a timber bench around a low table. A Lebanese-Australian guy in his thirties with a trimmed beard and an olive overshirt is mid-story, one hand up; a woman with long curly red hair and an oversized grey cardigan laughs; a Korean-Australian guy with round tortoiseshell glasses and a navy crewneck listens with a small smile; a South Asian woman with a small nose ring and a worn brown leather jacket has her arms folded, eyebrows raised. Candle jars, a bowl of chips and a jug of water with lemon on the table.

Place: the rest of the frame is the rooftop and the view - a low brick parapet, a few potted olive trees, the chimneys and slate roofs of the terraces falling away to the left, lit windows in the neighbouring terraces, a few city towers far off, the sky nearly dark blue.

Light: the warm glow of the candle jars on the four faces; everything else the cool deep blue of late dusk.`,
  },
  // The live gig file is this roll after a Gemini (gemini-3-pro-image-preview)
  // edit that thinned the packed crowd to about ten people, because the user
  // found it staged. A fresh roll brings the crowd back, so ask for a sparse room.
  {
    name: "gig",
    prompt: `A candid wide photo from the back of a small live gig in the back room of a pub in Newtown, Sydney, about 10pm on a Saturday.

Camera: 28mm lens from the back of the room, standing on a step so it looks slightly down over the crowd.

Moment: the stage is at the far back on the RIGHT side of the frame - the band only blurred shapes in magenta and amber light. A few metres in front of the camera, on the right side of the crowd, two friends have turned from the stage toward each other, both mid-laugh at something one of them just shouted: a guy in his late twenties with a shaved head, a septum ring and a plain black tee, and a woman in her thirties with short platinum hair and a plain olive jacket. Everyone else is a dark silhouette seen from behind - the backs of heads and shoulders.

Place: black-painted walls, a little haze in the air, a dim bar along the left wall in deep shadow.

Light: the magenta and amber stage wash from the back right rim-lights the crowd and haloes the two friends' hair; the left side of the room is nearly black.`,
  },
];

async function render(spec) {
  const prompt = `${spec.prompt}\n\n${TAIL}\n\nOUTPUT FRAME: one complete photograph in 16:9 aspect ratio at the model's native resolution.`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      // Muse ignores aspect_ratio on its own; the explicit size is what holds 16:9.
      body: JSON.stringify({ model: "meta/muse-image", prompt, aspect_ratio: "16:9", size: "2048x1152" }),
      signal: AbortSignal.timeout(300_000),
    }).catch((error) => ({ status: 0, text: async () => String(error) }));
    const body = await res.text();
    if (res.status !== 200) {
      console.warn(`  ${spec.name}: attempt ${attempt} HTTP ${res.status}: ${body.slice(0, 200)}`);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    const data = JSON.parse(body);
    const item = data.data?.[0];
    const bytes = item?.b64_json
      ? Buffer.from(item.b64_json, "base64")
      : item?.url
        ? Buffer.from(await (await fetch(item.url)).arrayBuffer())
        : null;
    if (!bytes) continue;
    let n = 1;
    while (existsSync(join(outDir, `${spec.name}-${n}.jpg`))) n++;
    const file = join(outDir, `${spec.name}-${n}.jpg`);
    const info = await sharp(bytes)
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(file);
    console.log(`✔ ${file} ${info.width}x${info.height} ($${(Number(data.usage?.cost) || 0).toFixed(3)})`);
    console.log(`  to try it: cp "${file}" public/home/hero-slide-${spec.name}.jpg`);
    return;
  }
  console.error(`✖ ${spec.name}: all attempts failed`);
}

const only = process.argv.slice(2);
const queue = SPECS.filter((spec) => !only.length || only.includes(spec.name));
if (!queue.length) {
  console.error(`No spec named ${only.join(", ")}. Pick from: ${SPECS.map((spec) => spec.name).join(", ")}`);
  process.exit(1);
}
console.log(`Rendering ${queue.length} candidate(s) with meta/muse-image → ${outDir}`);
await Promise.all(queue.map(render));
