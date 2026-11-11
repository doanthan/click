// Generator for the home hero's photo cycle: public/home/hero-slide-*.jpg.
// Re-roll with `node scripts/gen-hero-slides.mjs [name ...]` (no args = every
// spec). The slides sit next to the warm night-courtyard hero
// (hero-courtyard.jpg), so they carry their own TAIL rather than
// gen-home-images.mjs's cool phone-photo LOOK: the warm-evening TAIL for a
// night slide, DAY_TAIL for a daytime one. The cycle is day and night on
// purpose - four evening photos in a row read as a bar, not as things to do.
// Renders through OpenRouter's Image API with Meta's Muse Image model. Needs
// OPENROUTER_API_KEY in .env.local.
//
// Candidates land in <os tmpdir>/click-hero-slides/<name>-<n>.jpg, never in
// public/home, because a slide has to be judged IN PLACE: a 16:9 contact sheet
// passed a face behind "next" and another behind the MutualToast card. Copy a
// candidate over public/home/hero-slide-<name>.jpg, freeze the page on its slot
// from the devtools console, and look at 1440x900 and 390x844:
//   document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 12000; });
// (12000 = pickleball, 20000 = surf, 28000 = gig.) In image coordinates the
// headline covers x 14.5-51.6%, y 27-73%, the search form reaches x 62% at
// y 64-73%, the MutualToast card covers x 70-90%, y 17-29%, and a 16:10 screen
// crops 5% off each side. On a phone the frame is each slide's `crop` in
// HERO_SLIDES (src/app/page.tsx).
//
// hero-courtyard.jpg itself is not rolled here. It is the original courtyard
// photo after one Gemini edit (gemini-3-pro-image-preview, source image plus
// instruction, temperature 0.3, imageConfig {aspectRatio 16:9, imageSize 2K},
// resized to 2048x1152) that threw the background out of focus: the wall and
// the dancers soft, the string-light bulbs swollen into bokeh discs, the people
// at the table untouched. The instruction has to forbid new lights - a looser
// one kept the background sharp and painted big discs over the dark left half.
// The pre-edit file is in git history (public/home/hero-courtyard.jpg).
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

// The daytime look. Same framing rules; the light is whatever the place has,
// exposed for the highlights, because flash and evenly lit faces are what make
// a daylight roll read as generated. The left half is bright here, not dark -
// .hero-scrim covers it - so it only has to be empty of people and detail.
// Heads sit in a narrow band, 32-46% down: above it the MutualToast card covers
// them on a desktop, below it the headline covers them on a phone.
const DAY_TAIL = `This must look like a real candid photograph by a friend who happens to be a good photographer - an unposed moment on a real weekend morning, not an ad, not a stock shoot, not a film still. A full-frame camera with a 35mm prime in available daylight only, no flash and no fill light: the exposure is set for the highlights, so faces in shade stay a little dark and the brightest sky or glare is allowed to blow out. Hard-edged shadows where the sun reaches, fine natural grain, honest slightly cool daylight colour - no golden wash, no teal-and-orange grade, no HDR. Real people of different ages, heights, builds and backgrounds, bare-headed with no hats, caps or sunglasses, in ordinary well-worn clothes, natural unretouched skin, hair messy from moving. Nobody looks into the lens, poses, waves or performs for the camera; everyone is reacting to something happening in the frame. No text, no logos, no brand names, no readable signage anywhere - plain clothing and plain equipment.

Website hero framing - this matters more than anything else. A WIDE shot from five or six metres back, the way an event photographer stands off to take in the whole scene: the place is most of the picture and the people are small in it, each head only about a twelfth of the frame's height. Every person sits in the RIGHT half of the frame (55% to 92% of the way across), and every head sits between 32% and 46% of the way down - never higher, never lower. The LEFT HALF holds no people at all - only empty ground, plain surfaces, trees, water or sky - because a headline covers it. The TOP-RIGHT corner holds no faces either - only sky, trees or background - because a card covers it.`;

// One full prompt per slide, each naming its own angle, lens, light, place and
// cast, so the set doesn't read as one shoot. These rendered the live files.
const SPECS = [
  // ---- Daytime slides (DAY_TAIL) ----
  // Two people only: a doubles game of four read as staged. Both in their
  // early twenties, and a park with no skyline: Sydney Tower over the trees
  // was asked out ("remove centrepoint tower, just make it sydney park, and
  // have it young people" - the user's calls, 2026-11-11). They play each
  // other across the net, well apart, so it reads as a game and not a couple.
  // The court layout is spelled out because the first park roll that shipped
  // had the net running beside the near player and her standing on the green
  // surround - check net, posts and lines on every candidate, not just faces.
  // The trees are deliberately ordinary: a huge Moreton Bay fig with buttress
  // roots came back looking fake (the user's call).
  {
    name: "pickleball",
    tail: DAY_TAIL,
    prompt: `A candid wide photo of two friends in their early twenties playing a casual Saturday-morning game of pickleball on an outdoor public court in a big leafy park in Sydney's inner west, in November.

The court must be laid out correctly - this matters as much as the people. One pickleball court: a blue rectangle of playing surface marked with white lines, on a green surround. The net stretches straight across the middle of the court from one sideline to the other, at right angles to the sidelines, with one post at each sideline, dividing the court into a near half and a far half. The two players are on opposite sides of the net, one in each half, each standing ON the blue playing surface well INSIDE the white lines. Nobody stands on the green surround, beside a net post, or outside the lines.

Camera: 35mm lens, standing three metres behind the near baseline, just outside the court's left corner, at eye level and tilted slightly down, looking straight down the length of the court. The court lies in the right half of the picture with its sidelines running away from the camera, the net crosses it as a straight horizontal band in the middle distance, and the horizon sits about 38% of the way down the frame. The left half of the picture is the green surround, the fence and the park.

Moment: only two people in the whole picture, playing each other - they are not a couple. In the near half of the court, two metres inside the baseline and about three-quarters of the way across the frame, a woman of about 23 with long box braids tied back, a faded teal t-shirt and black bike shorts has just hit the ball: seen from behind and to the side, her head turned so her face is in profile, paddle still up by her shoulder, laughing with her mouth open. In the far half, beyond the net, facing the camera and about 62% of the way across the frame, smaller, a lanky guy of about 24 with messy dark curly hair, a plain rust-coloured t-shirt and black shorts has both arms flung wide in mock disbelief, laughing, his paddle in one hand. Both plainly look their age - early twenties, fresh-faced, the age of uni students - not teenagers and not thirty. The yellow ball sits on the court surface on the near side of the net, not in the air.

Place: an ordinary, well-used Sydney suburban park, nothing grand about it. Behind the chain-link fence at the far end of the court, a wide stretch of slightly patchy mown grass, and set well back across it a loose scatter of everyday park trees of ordinary size - a few slim eucalypts with thin pale trunks and sparse grey-green leaves, two paperbarks, one jacaranda in purple bloom - with plain gaps of sky between them. No giant tree, no fig tree, no buttress roots, no tree that dominates the picture or arches over the court; every tree is a normal tree you would not look at twice. A low sandstone wall along the park's far edge, and beyond it, only glimpsed, a row of Victorian terrace houses with cast-iron lace balconies. Fallen purple jacaranda flowers on the green surround. A timber bench with two tote bags and water bottles outside the right sideline. No city skyline, no towers and no tall buildings anywhere - above the trees there is only sky. Nobody else anywhere - no spectators, no other players, no passers-by.

Light: about 9am, low sun coming through the trees from behind and to the right, long tree shadows across the court, the players half in shade with a rim of light on their hair and shoulders, the sky pale and partly blown out.`,
  },
  {
    name: "surf",
    tail: DAY_TAIL,
    prompt: `A candid wide photo of a beginners' group surf lesson on the sand at Bondi Beach in Sydney, about 7.30 on a summer morning.

Camera: 35mm lens, eight metres back, at standing eye level looking slightly down and south along the beach, so that wet sand and the water's edge fill the left of the frame, the horizon sits high - a fifth of the way down - and every head is well below it, in the middle band of the frame.

Moment: in the right half of the frame, four adults in plain black short-sleeved wetsuits practise the pop-up on plain pale-blue foam surfboards laid flat on the dry sand. A woman in her late twenties with wet dark curly hair has just popped up into a low wobbly crouch on her board - knees deeply bent, bottom low, arms flung out for balance - cracking up. Nobody stands upright. Beside her a stocky Tongan-Australian guy in his thirties is still on his knees on his board, looking up at her and laughing. Behind them a tall woman with a grey-streaked ponytail lies flat on her board, chin up, grinning, and a slight guy with a shaved head is halfway up. The instructor, a woman in her fifties with cropped sun-bleached hair and a plain long-sleeved yellow rash shirt, crouches in front of them with one hand flat on the sand.

Place: unmistakably Bondi. The long crescent of pale sand curves away to the south; on the right, the low seawall and promenade, the cream arches of the Bondi Pavilion, a line of tall Norfolk Island pines and the low cream-and-brick apartment blocks of Campbell Parade; at the far end, the rocky south headland stepped with apartment blocks and the white ocean pool at its foot. A red-and-yellow surf lifesaving flag stands on a pole in the sand in the middle distance. Small clean waves break on the left. The beach is almost empty: two tiny walkers and one jogger far off.

Light: low morning sun from the left, off the ocean, side-lighting the group - bright edges on wet hair and shoulders, faces half in shade, long shadows running to the right across the sand, hard glare off the wet sand, the sky pale and blown out over the water.`,
  },
  {
    name: "climb",
    tail: DAY_TAIL,
    prompt: `A candid wide photo inside a bouldering gym in a converted brick warehouse in Sydney's inner west, on a Sunday morning social climb.

Camera: 28mm lens from the far side of the padded floor, six metres back, at standing eye level.

Moment: on the right side of the frame, a low overhanging bouldering wall. A wiry woman in her thirties with a short dark ponytail, a plain grey singlet and green climbing pants is two metres up, one arm fully stretched for the next hold. On the grey crash mat below her, three friends watch with their heads tipped back: a tall Sudanese-Australian guy in a plain mustard t-shirt with both arms half raised, ready to spot; a woman with a silver buzz cut and chalky hands, mouth open mid-cheer; a guy with shoulder-length black hair sitting cross-legged, laughing. A chalk bag and two pairs of climbing shoes lie on the mat.

Place: the left of the frame is the rest of the gym - an empty stretch of grey crash mat, a tall plain plywood wall with only a scatter of coloured holds, exposed brick and steel roof trusses above. Nobody else in the gym.

Light: daylight only, from a long row of dusty skylights and one tall arched window on the left: a hard bright patch on the mat, chalk dust hanging in the beam, the climbers lit from the side with the far corners of the room dim.`,
  },

  // ---- Night slides (TAIL) ----
  // bowls and rooftop left the cycle on 2026-11-11 for the two daytime slides.
  // Their files and specs stay, so either can come back with a one-line swap
  // in HERO_SLIDES.
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
  const prompt = `${spec.prompt}\n\n${spec.tail ?? TAIL}\n\nOUTPUT FRAME: one complete photograph in 16:9 aspect ratio at the model's native resolution.`;
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
