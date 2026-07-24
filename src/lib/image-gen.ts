// Candid event image generation - prompt assembly for the /images marketing
// tool. Server-only: import from API routes, never from client components
// (the directive texts are the product; don't ship them in the bundle).
//
// Source of truth: the "letsclick.app - Candid Event Image Generation" spec
// (ported from the wizelfront /test-click sandbox, 2026-07-18). Every block
// below is copied VERBATIM from that spec - em-dashes and all - and the
// assembly order in buildPrompt() matches its section 4 exactly. Do not
// "fix" wording in the directive texts; they are tuned prompt payloads.

export type ShotKey = "crowd" | "dj" | "friends" | "lifestyle" | "detail";
export type LightKey =
  | "golden_hour"
  | "night_flash"
  // Additions beyond the ported spec - see the LIGHTS entries below.
  | "overcast"
  | "window_daylight"
  | "indoor_ambient"
  | "hard_noon"
  | "neon_night"
  | "blue_hour";
export type GradeKey = "warm_film" | "neutral_film" | "cool_digital";
export type GroupKey = "pair" | "small_group" | "crowd";
export type CameraKey =
  | "retro"
  | "y2k"
  | "ugc"
  | "street"
  | "editorial"
  | "moody"
  | "bright";

export interface PromptOptions {
  shot: ShotKey;
  event: string;
  customEvent?: string; // free text, overrides the event picker (clamped to 200)
  light: LightKey;
  group: GroupKey;
  camera: CameraKey;
  vibe?: string; // clamped to 300
  extra?: string; // clamped to 600
  grade?: GradeKey; // colour grade; omit = the original warm film grade
}

/* ---------- Section 5: shot types ---------- */

const SHOTS: Record<ShotKey, { people: "full" | "partial"; scene: string }> = {
  crowd: {
    people: "full",
    scene: `The busiest heart of the event photographed from WITHIN it — whatever this event's peak energy is: a dancefloor, a court mid-rally, a table mid-round. The frame belongs to the nearest three or four people, sharp and mid-action; everyone behind them falls away into soft focus. Leave breathing room: gaps between bodies, negative space at the frame edges. NOT a wall-to-wall sea of faces.`,
  },
  dj: {
    people: "full",
    scene: `A DJ mid-set behind the decks, lit by stage lights, crowd blurred in the fore/background. Bucket hat, tattoos, lost in the mix.`,
  },
  friends: {
    people: "full",
    scene: `A close-up candid portrait of two or three friends caught in an unguarded moment — an arm around a shoulder, cans in hand, maybe novelty sunglasses. Warm and personal, but real: the moment defines the expressions, not a group grin.`,
  },
  lifestyle: {
    people: "full",
    scene: `A casual in-between lifestyle moment — friends walking together, arriving, or hanging around the edges of the gathering. Unhurried and un-posed. The SETTING and LIGHT sections below define where and when this is — follow them exactly.`,
  },
  detail: {
    people: "partial",
    scene: `A tight cropped detail shot with NO faces — the small textures of THIS event: paddles and scuffed balls courtside, glasses and shared plates on a table, chalky hands, sneakers, a coffee lid. Hands may appear; faces never do.`,
  },
};

/* ---------- Section 6: the moments (candid variety engine) ---------- */

const MOMENTS = [
  `A lull in the conversation — people gazing out at the party, comfortable silence, drinks resting.`,
  `One person is mid-story with their hands; the others listen with neutral or skeptical faces.`,
  `Someone is mid-sip while someone else talks past them; a third person watches the crowd.`,
  `A deadpan reaction to a bad joke — one smirk at most, someone rolling their eyes.`,
  `Everyone is looking at something happening OFF-frame to the left; we never see what.`,
  `Someone is waving a friend over from across the space; the others have not noticed yet.`,
  `Two people deep in quiet one-on-one conversation, leaning in to hear over the noise.`,
  `One person is fixing their hair or adjusting a jacket, nobody paying attention to anyone.`,
  `Somebody is showing the group their phone; reactions are mixed — one curious, one indifferent.`,
  `Caught between moments — someone standing up or arriving, mid-greeting, drinks being shuffled.`,
];

/* ---------- Section 7: events ---------- */

export const EVENTS: Record<string, { description: string; alcohol: boolean }> = {
  // Parties & nightlife
  house_party: {
    alcohol: true,
    description: `a crowded terrace-house party spilling into a small backyard`,
  },
  beer_garden: {
    alcohol: true,
    description: `a lively Sydney pub beer garden — schooners, picnic tables, festoon lights`,
  },
  warehouse: {
    alcohol: true,
    description: `a Marrickville warehouse party — exposed brick, haze, a modest rig`,
  },
  rooftop: {
    alcohol: true,
    description: `an inner-Sydney rooftop party, harbour and skyline glimpses behind`,
  },
  festival: {
    alcohol: true,
    description: `an outdoor daytime festival in a Sydney park with a stage and truss rig`,
  },
  // Sport & active
  pickleball: {
    alcohol: false,
    description: `a social pickleball mixer on an outdoor court — paddles, mixed-skill rallies, people waiting on the sideline chatting between games`,
  },
  beach_volleyball: {
    alcohol: false,
    description: `a casual beach volleyball social at Bondi — a saggy net in the sand, rotating teams, spectators sitting on towels`,
  },
  run_club: {
    alcohol: false,
    description: `a Saturday-morning run club regrouping after the run — flushed faces, takeaway coffees, activewear, sunrise light`,
  },
  bouldering: {
    alcohol: false,
    description: `a bouldering-gym social — colourful holds, chalky hands, people spotting and problem-solving together`,
  },
  // Activities & classes
  darts: {
    alcohol: true,
    description: `a social darts night at a pub — oche tape on the floor, chalk scoreboard, exaggerated celebrations and commiserations between throws`,
  },
  pottery: {
    alcohol: false,
    description: `a pottery class social — spinning wheels, aprons, clay-splattered hands, people laughing at each other's wonky pots`,
  },
  cooking_class: {
    alcohol: true,
    description: `a group cooking class — shared benches, aprons, steam and sizzle, tasting spoons, someone burning something`,
  },
  // Food & drink
  date_night: {
    alcohol: true,
    description: `a first-date dinner at a small buzzy Sydney restaurant — two people at a table for two, candlelight or warm pendant light, waiters and other diners soft in the background`,
  },
  wine_bar: {
    alcohol: true,
    description: `a small-group meetup at a cosy inner-city wine bar — shared plates, low warm light, elbows on a marble counter`,
  },
  trivia: {
    alcohol: true,
    description: `pub trivia night — teams huddled around answer sheets, competitive leaning-in, schooners on the table`,
  },
  picnic: {
    alcohol: false,
    description: `a picnic mixer in Centennial Park — rugs on the grass, shared snacks, portable speaker, long shadows`,
  },
  coffee: {
    alcohol: false,
    description: `a weekend coffee meetup outside a Sydney cafe — outdoor tables, flat whites, dogs tied up nearby`,
  },
  // Beach hangs
  bondi: {
    alcohol: false,
    description: `Bondi Beach — golden sand, turquoise surf, the grassy hill above the beach, towels and eskies`,
  },
  coastal_walk: {
    alcohol: false,
    description: `the Bondi-to-Bronte coastal walk — sandstone cliffs, ocean pool below, sunburnt grass`,
  },
};

/* ---------- Section 8: group sizes ---------- */

const GROUPS: Record<GroupKey, string> = {
  pair: `one or two people fill the frame`,
  small_group: `a small group of three to five friends`,
  crowd: `a lively crowd — roughly eight to twelve people visible, only the nearest few in sharp focus, the rest dissolving into blur; the frame must still breathe`,
};

/* ---------- Section 9: the Sydney place block ---------- */

const PLACE_BLOCK = `PLACE — SYDNEY, AUSTRALIA
This is unmistakably Sydney in summer: hard bright southern-hemisphere light,
golden sand and turquoise water where the coast is in frame, Norfolk pines and
eucalypts, terrace houses and brick pubs in the urban shots. The crowd is a
real Sydney mix. Nothing American — no red cups, no yellow cabs, no US signage.`;

/* ---------- Section 10: the anti-staged mess block (alcohol-aware) ---------- */

const DRINKS_ALCOHOL = `Drinks live ON TABLES where people actually put them down — different
fill levels, a couple of empties pushed to the table edge, condensation rings.
Nobody carries a drink while walking.`;

const DRINKS_DRY = `NO ALCOHOL ANYWHERE IN FRAME — no beer, no schooners, no cans, no wine,
no glasses perched on walls or benches. This is a public alcohol-free zone in
Australia. If anyone holds anything it is a takeaway coffee, a water bottle,
or nothing at all. Most hands are empty.`;

const DRINKS_UNKNOWN = `Only drinks that genuinely belong at THIS kind of event, in the places
people naturally put them. If alcohol wouldn't be at this event — or the event
is in a public outdoor space (Australian beaches, parks, and streets are
alcohol-free) — then NO alcohol appears at all. Nobody carries a drink while
walking. Most hands are empty.`;

function messBlock(alcohol: boolean | null): string {
  const drinks =
    alcohol === true ? DRINKS_ALCOHOL : alcohol === false ? DRINKS_DRY : DRINKS_UNKNOWN;
  return `MID-EVENT, NOT STYLED — NON-NEGOTIABLE
This photo is caught mid-moment — nothing has been tidied or arranged for the
camera. ${drinks}
Real lived-in texture: someone's tote or jacket over a chair, a towel on a
rail, thongs kicked off on the grass. Clutter may be half cut off at frame
edges. NEVER a neat row of glasses, NEVER symmetrical prop placement, NEVER a
cleared styled surface.`;
}

/* ---------- Section 11: light blocks ---------- */

const LIGHTS: Record<LightKey, string> = {
  golden_hour: `LIGHT — GOLDEN HOUR
Low raking golden-hour sunlight, shooting into the light. Soft blown sun flare,
glowy overexposed highlights that go warm-cream rather than clinical white.`,
  night_flash: `LIGHT — NIGHT FLASH (one real flash, nothing else)
A single small on-camera flash is the ONLY added light — the way a cheap
point-and-shoot fires it. Physics of a real flash photo: slightly overexposed
flat frontal light on the nearest one or two people, a hard thin shadow thrown
directly behind them onto whatever's close, brutal inverse-square falloff so
the background goes murky within a few metres. Slow shutter drags the dim
ambient light into slight smear and background motion blur; visible ISO noise
in the dark areas. Any ambient colour is faint and motivated (a distant bar
light, a streetlamp) — NOT saturated neon washes. FORBIDDEN for this look:
rim light, hair light, fill light, multiple light sources, evenly-lit scenes,
cinematic colour grading, glowing atmosphere. If it looks professionally lit,
it is wrong.`,
  // ---- Additions beyond the ported spec (the two entries above are verbatim
  // payloads - never reworded). These give the home-page shoot real lighting
  // variety so every frame doesn't share the same two looks. ----
  overcast: `LIGHT - FLAT OVERCAST
A solid pale-grey sky is the only light source - one giant softbox. Even,
shadowless wrap on faces, soft murky ground shadows, no flare, no glow.
Colour reads true and slightly muted: grass green, skin neutral, whites
clean. If any sunbeam, golden cast or dramatic sky appears, it is wrong.`,
  window_daylight: `LIGHT - WINDOW DAYLIGHT (interior)
One big window of cool daylight lights the room from the side - bright and
airy near the glass, honest falloff deeper into the interior. A faint
green-white fluorescent tube or bare bulb may mix in further back. Whites
read white, not cream; skin neutral; the sky outside is flat pale grey with
NO sun and NO flare. Never looks lit - looks like a room on a cloudy day.`,
  indoor_ambient: `LIGHT - VENUE AMBIENT (no flash, practicals only)
The venue's own lamps are the only light - tungsten pendants, wall sconces,
candles, a bar glow. Amber and murky with real mixed colour temperature,
faces lit from wherever the nearest lamp hangs, deep soft shadows
elsewhere, visible high-ISO grain. No flash fired, no added light, no rim
or fill - if it looks professionally lit, it is wrong.`,
  hard_noon: `LIGHT - HARD MIDDAY SUN
Overhead southern-hemisphere summer sun in a deep blue cloudless sky. Hard
short shadows directly under people, squint-bright highlights, bounced
glare off sand or concrete. Colour is crisp and saturated by sunlight
alone - zero golden cast, zero flare haze. Honest and harsh, like a photo
taken at noon because that's when the event was.`,
  neon_night: `LIGHT - SIGNS AND SCREENS (no flash)
After dark, lit only by what the place itself emits - LED strips, a glowing
screen, signage, string lights. Colour cast falls on skin honestly (a cyan
edge, a warm wash) and shifts across the room; shadows go quickly to murky
black, slow-shutter smear on moving hands, heavy ISO noise. No flash, no
added light, no clean even exposure - a real camera struggling in a fun
room.`,
  blue_hour: `LIGHT - BLUE HOUR
Just after sunset: deep blue ambient dusk in the sky while the venue's warm
practicals - festoons, windows, signage - switch on against it. Cool blue
fill from above, pockets of warm tungsten below, both honest and slightly
underexposed, grain rising in the shadows. No flash, no neon washes, no
cinematic grade - the ten real minutes when parties start.`,
};

/* ---------- Section 12: film grade block ---------- */

const FILM_GRADE = `FILM GRADE — NON-NEGOTIABLE
Candid documentary party photography shot on 35mm film (Kodak Portra 400 /
Gold 200 character). Warm golden white balance — skin reads sun-kissed and
slightly amber. Fine visible film grain over the whole frame. Lifted, milky
matte blacks — never crushed true black. Creamy warm highlights that bloom
softly and lose a little detail. Rich but natural saturation: reds and oranges
pop, blues and greens slightly muted so nothing fights the warm skin tones.
This must read as a real photo from a real night out — never studio-polished,
never stock, never posed.`;

// Additions beyond the ported spec: alternative colour grades. warm_film is
// the original FILM_GRADE payload untouched; the others exist so a batch of
// generated frames doesn't all share the same warm Portra cast.
const GRADES: Record<GradeKey, string> = {
  warm_film: FILM_GRADE,
  neutral_film: `FILM GRADE - NEUTRAL 35MM
Candid documentary photography on neutral consumer 35mm film (Fuji Superia
character). True-to-life white balance - whites white, greens honest, skin
natural with no warm push. Fine visible grain, gently lifted blacks, soft
un-clipped highlights. Colour is believable rather than pretty: the frame
should look developed at a chemist, not graded by a colourist. Never
studio-polished, never stock, never posed.`,
  cool_digital: `DIGITAL GRADE - EARLY DIGICAM
Shot on an early-2000s compact digital camera or a phone left on auto.
Slightly cool clean white balance, mild in-camera sharpening, honest flat
contrast, faint luminance noise in the shadows, highlights that clip a
touch. No film grain, no warm nostalgia cast, no colourist grade - the
unglamorous true-colour look of a camera that just took the photo. Never
studio-polished, never stock, never posed.`,
};

/* ---------- Section 13: casting + expressions block ---------- */

const CASTING = `CASTING
Real attendees, not hired models: early twenties to mid-thirties, diverse in
gender and ethnicity. Dressed for THIS event, not a lookbook — streetwear and
novelty sunglasses at parties, real activewear (sweaty, mismatched) at sport
socials, smart-casual at dinners and wine bars, whatever-was-clean at coffee
and picnics. Visible tattoos, gold jewellery, bucket hats where they fit.
Nobody looks at the camera unless they were caught doing it.

EXPRESSIONS — MIXED, LIKE A REAL FRAME (NON-NEGOTIABLE)
In a real candid photo most people are NOT smiling. AT MOST ONE person in the
frame may be laughing or grinning. Everyone else is doing something quieter:
listening, mid-sentence with their mouth half-open, deadpan, distracted,
glancing off-frame at something else, mid-sip, squinting, checking a phone,
resting a chin on a hand, or just existing with a neutral relaxed face.
A frame where everyone laughs at once reads as an ad — that is the failure
mode. Asymmetric attention: people are engaged with DIFFERENT things, not all
locked onto one conversation.`;

/* ---------- Appendix: documentary photography-mode block ---------- */

const PHOTOGRAPHY_MODE = `PHOTOGRAPHY MODE — DOCUMENTARY / AUTHENTIC (the strictest register; one AI tell kills the whole email): this image must be indistinguishable from a photograph a working photographer actually took in a REAL place — the kind that could sit unnoticed in a Google Images row for this subject, because that is the test the viewer will run.
- LIGHT: only from sources that plausibly exist in the scene — a window, overcast sky, bare bulbs, string lights, fluorescent tubes, candles — and real interiors MIX colour temperatures (warm tungsten against cool daylight; a green fluorescent cast is honest). Shadows fall one way per source and go soft and murky, never sculpted.
- PLACE: real environments carry friction — worn floors, scuffed paint, cables, crates, dust, ordinary clutter at the edges. Leave the imperfection in; do not art-direct it away or arrange it beautifully.
- CAMERA: available-light exposure with visible film grain or sensor noise, natural handheld framing (horizon a touch off, subject off-centre, edges cropping things mid-object), honest depth of field. A flash-flat frame or slightly blown window highlights are truthful.
- FORBIDDEN — the cinema tells that break the contract (render NONE of these): volumetric light shafts / god rays with visible haze, fog or mist added for drama, cinematic teal-orange or any movie colour grade, wet-look sheen added to stone or wood, rim-lit or hero-lit subjects, perfectly placed props, symmetric one-point-perspective compositions, HDR glow, "epic" atmosphere of any kind.
This mode contract OUTRANKS any "editorial", "art-directed", or "scroll-stopping" styling language elsewhere in this prompt — here the unremarkable REAL frame always beats the beautiful fake one.`;

/* ---------- Appendix: compact realism directive (unknown camera fallback) ---------- */

const COMPACT_REALISM = `PHOTOREALISM (CRITICAL): This must read as a LOUD, luxurious advertising photograph — agency-grade, art-directed, maximally polished. Bold styling, dramatic studio light, saturated colour, glossy cream/condensation/splash, and deliberate photoshopped composites are the GOAL; a hyper-real "too-perfect" finish is welcome, NOT an AI tell. Required: authentic material textures (visible fabric weave, leather pores, glass caustics), one coherent lighting scheme with physically correct shadow falloff and real contact shadows, clean gradients free of banding. Forbidden (genuine broken renders only): plastic/waxy SKIN on a person or animal, melted or morphing edges, merged fingers, wrong anatomy, uncanny facial symmetry, garbled or invented text and logos, texture tiling or banding, inconsistent shadows, CGI/3D-render look, digital-art aesthetic, perfectly round airborne droplets beside a clear see-through liquid stream, extra or duplicated limbs, a product used against its real mechanism (a spray/atomizer or pump bottle pouring a stream — sprayers mist, pumps dollop; liquid through a closed cap; pours only from open-neck vessels), served or scooped food resting directly on a bare surface with no bowl, cone, cup, plate, or packaging.`;

/* ---------- Appendix: camera style directives ---------- */

const CAMERA_STYLES: Record<Exclude<CameraKey, "ugc">, string> = {
  retro: `PHOTOREALISM — RETRO (Film Stock) (CRITICAL): This must read as a LOUD, polished advertising photograph — bold, glossy, campaign-grade, a deliberate dopamine finish welcome — still a real photograph, NOT an illustration or 3D render.
REQUIRED OPTICAL/SENSOR ARTIFACTS FOR THIS CAMERA SYSTEM:
- Kodak Portra grain structure — organic, irregular, visible at all tones
- Warm color cast in highlights with teal/cyan shift in shadows (cross-process feel)
- Slight overall lens softness from vintage uncoated glass
- Light leaks at frame edges — warm orange/red bleeding in from film gate

UNIVERSAL REQUIREMENTS: Authentic material textures (visible fabric weave, leather pores, glass caustics), physically correct lighting with proper shadow falloff, agency-grade finish.
FORBIDDEN (genuine broken renders only): Plastic/waxy SKIN on a person or animal, melted edges, merged fingers, garbled text or logos, texture tiling, inconsistent shadows, CGI/3D-render look, digital-art aesthetic.`,
  y2k: `PHOTOREALISM — Y2K (Early Digital/Disposable) (CRITICAL): This must read as a LOUD, polished advertising photograph — bold, glossy, campaign-grade, a deliberate dopamine finish welcome — still a real photograph, NOT an illustration or 3D render.
REQUIRED OPTICAL/SENSOR ARTIFACTS FOR THIS CAMERA SYSTEM:
- Direct flash creating harsh shadows behind subject on wall/background
- Slight red-eye tendency from on-axis flash close to lens
- Oversaturated processing — boosted reds and greens from early digital pipeline
- Visible digital noise and JPEG compression artifacts in shadow areas

UNIVERSAL REQUIREMENTS: Authentic material textures (visible fabric weave, leather pores, glass caustics), physically correct lighting with proper shadow falloff, agency-grade finish.
FORBIDDEN (genuine broken renders only): Plastic/waxy SKIN on a person or animal, melted edges, merged fingers, garbled text or logos, texture tiling, inconsistent shadows, CGI/3D-render look, digital-art aesthetic.`,
  street: `PHOTOREALISM — STREET (Rangefinder) (CRITICAL): This must read as a LOUD, polished advertising photograph — bold, glossy, campaign-grade, a deliberate dopamine finish welcome — still a real photograph, NOT an illustration or 3D render.
REQUIRED OPTICAL/SENSOR ARTIFACTS FOR THIS CAMERA SYSTEM:
- Rangefinder focus patch artifacts — slight double-image at out-of-focus edges
- Motion blur on periphery from handheld shooting at slower shutter speeds
- Slight chromatic aberration from fast wide-angle lens (purple fringing on bright edges)
- Uneven street lighting color temperature mixing (sodium vapor + daylight)

UNIVERSAL REQUIREMENTS: Authentic material textures (visible fabric weave, leather pores, glass caustics), physically correct lighting with proper shadow falloff, agency-grade finish.
FORBIDDEN (genuine broken renders only): Plastic/waxy SKIN on a person or animal, melted edges, merged fingers, garbled text or logos, texture tiling, inconsistent shadows, CGI/3D-render look, digital-art aesthetic.`,
  editorial: `PHOTOREALISM — EDITORIAL (Medium Format) (CRITICAL): This must read as a LOUD, polished advertising photograph — bold, glossy, campaign-grade, a deliberate dopamine finish welcome — still a real photograph, NOT an illustration or 3D render.
REQUIRED OPTICAL/SENSOR ARTIFACTS FOR THIS CAMERA SYSTEM:
- Medium-format tonal roll-off — smooth, gradual highlight-to-shadow transitions unlike 35mm
- Film-like grain structure from large sensor, visible at 100% crop
- Slight color shift in deep shadows (toward cool blue-green)
- Visible lens breathing between focus distances

UNIVERSAL REQUIREMENTS: Authentic material textures (visible fabric weave, leather pores, glass caustics), physically correct lighting with proper shadow falloff, agency-grade finish.
FORBIDDEN (genuine broken renders only): Plastic/waxy SKIN on a person or animal, melted edges, merged fingers, garbled text or logos, texture tiling, inconsistent shadows, CGI/3D-render look, digital-art aesthetic.`,
  moody: `PHOTOREALISM — MOODY (Anamorphic Cinema) (CRITICAL): This must read as a LOUD, polished advertising photograph — bold, glossy, campaign-grade, a deliberate dopamine finish welcome — still a real photograph, NOT an illustration or 3D render.
REQUIRED OPTICAL/SENSOR ARTIFACTS FOR THIS CAMERA SYSTEM:
- Crushed blacks with visible shadow noise and grain in dark areas
- Anamorphic oval/stretched specular highlights on point lights — NOT round circles
- Subtle horizontal lens flares from anamorphic elements
- Film grain visible in shadows and mid-tones, characteristic of cinema stock

UNIVERSAL REQUIREMENTS: Authentic material textures (visible fabric weave, leather pores, glass caustics), physically correct lighting with proper shadow falloff, agency-grade finish.
FORBIDDEN (genuine broken renders only): Plastic/waxy SKIN on a person or animal, melted edges, merged fingers, garbled text or logos, texture tiling, inconsistent shadows, CGI/3D-render look, digital-art aesthetic.`,
  bright: `PHOTOREALISM — BRIGHT & AIRY (CRITICAL): This must read as a LOUD, polished advertising photograph — bold, glossy, campaign-grade, a deliberate dopamine finish welcome — still a real photograph, NOT an illustration or 3D render.
REQUIRED OPTICAL/SENSOR ARTIFACTS FOR THIS CAMERA SYSTEM:
- Slight highlight bloom/halation from shooting wide open into bright light
- Lifted blacks with gentle luminance noise visible in shadow areas
- Lens flare on bright sources (window, sun) — natural multi-element flare pattern
- Luminous highlight bloom — bright sources blooming into a glowing wash of light, lifted airy exposure

UNIVERSAL REQUIREMENTS: Authentic material textures (visible fabric weave, leather pores, glass caustics), physically correct lighting with proper shadow falloff, agency-grade finish.
FORBIDDEN (genuine broken renders only): Plastic/waxy SKIN on a person or animal, melted edges, merged fingers, garbled text or logos, texture tiling, inconsistent shadows, CGI/3D-render look, digital-art aesthetic.`,
};

/* ---------- Appendix: ugc (phone) - replaces the camera-style directive ---------- */

const UGC_DIRECTIVE = `═══════════════════════════════════════════════════════════════
📱 UGC STYLE REALISM (MANDATORY — IMAGE MUST LOOK CUSTOMER-SHOT)
═══════════════════════════════════════════════════════════════

This image must look like a REAL CUSTOMER took it with their phone — NOT a professional photographer.

PHONE CAMERA CHARACTERISTICS (REQUIRED):
- Shot on iPhone 15 or Samsung Galaxy — smartphone wide-angle lens distortion (24-26mm equivalent)
- Computational photography look: slight HDR processing, phone-native sharpening
- Natural phone bokeh simulation (software depth effect, not optical)
- Slight sensor noise and grain consistent with phone camera in indoor/mixed lighting
- Auto-exposure behavior: some areas slightly over or under-exposed
- Soft corners and slight barrel distortion from wide smartphone lens

IMPERFECT COMPOSITION (REQUIRED — this is NOT a professional shoot):
- Off-center framing — subject NOT perfectly centered or composed
- Slightly tilted angle (1-3 degrees) from casual handheld grip
- Casual arm-length distance or mirror selfie perspective
- Thumb or finger shadow slightly visible at frame edge
- Phone reflection visible if shooting in a mirror
- Awkward crop — head slightly cut off, or too much space on one side

UNCONTROLLED LIGHTING (REQUIRED — NO professional lighting):
- Whatever light is available: harsh bathroom fluorescent, dim bedroom lamp, overexposed window
- Mixed color temperatures (warm lamp + cool daylight) causing uneven white balance
- Shadow from the phone or hand visible on subject
- Possible blown highlights from window or harsh overhead
- Backlit situations with crushed shadows
- ⛔ NEVER: softbox, beauty dish, ring light, studio strobe, professional fill, controlled rim light

REAL MESSY ENVIRONMENT (REQUIRED — NOT art-directed):
- Everyday clutter visible: unmade bed, bathroom toiletries, desk papers, kitchen items
- Other products or packages nearby (not curated)
- Real lived-in surfaces with wear, stains, fingerprints
- Background elements that a real person wouldn't move for a quick photo
- Charger cables, remote controls, water bottles — real domestic objects

CASUAL STYLING (REQUIRED):
- No professional wardrobe styling — everyday clothes, loungewear, gym wear
- No professional hair or makeup — natural, effortless, undone
- No deliberate posing — candid, spontaneous, caught-in-the-moment
- Product handling looks natural and unstaged

FORBIDDEN (these reveal professional photography):
- Studio lighting of any kind (softbox, beauty dish, strobe, continuous panel)
- Perfect composition or centering
- Color grading or professional post-processing
- Seamless backdrop or controlled background
- Commercially sharp focus everywhere
- Professional model posing or styling
- Retouched skin or beauty filtering
- Art-directed prop placement

NEGATIVE DIRECTIVES:
studio lighting, professional photography, perfect composition, softbox, beauty dish, perfectly centered, seamless backdrop, color graded, retouched skin, commercial look, advertising photography, perfectly sharp everywhere, ring light, beauty lighting, art directed, fashion shoot, editorial look, professional posing.`;

/* ---------- Appendix: anti-AI model directive (shots with visible people) ---------- */

const HUMAN_MODEL_DIRECTIVE = `═══════════════════════════════════════════════════════════════
🧑 HUMAN MODEL REALISM (MANDATORY — SCENE CONTAINS A PERSON)
═══════════════════════════════════════════════════════════════

You are simulating a camera capturing a real human — NOT a renderer producing a beauty shot.

SKIN REALISM (include 3+ texture details AND 2+ subtle-variation cues):
Texture: visible skin pores (nose, cheeks, forehead), natural oils on T-zone catching light unevenly, fine lines and micro-wrinkles, subsurface scattering on ear edges and fingertips, peach fuzz / vellus hair on jawline and forearms.
Subtle variations: uneven skin tone, asymmetric moles or freckles, subtle redness around nose/cheeks/ears, minor facial asymmetry (eyebrow height, eye openness), faint under-eye texture, visible blood vessels in whites of eyes.
Finish: matte complexion (NOT dewy/glowing), natural oils catching light unevenly. No airbrushing. No beauty retouching. No porcelain smoothing.
⛔ SKIN MUST NEVER look smooth, porcelain, or plastic. Real skin has visible pores at ALL zoom levels — the realism cue is TEXTURE (pores, peach fuzz, fine lines, uneven oil sheen), not BLEMISHES.
⛔ THIS IS ECOMMERCE MARKETING — skin must read as clear and healthy, just not retouched. DO NOT render visible acne, pimples, pustules, whiteheads, blackheads, active breakouts, clustered spots, inflamed skin, scabs, rashes, rosacea flares, acne scarring, or any dermatological condition. A single small freckle or mole is fine; a visible pimple or cluster of spots is a FAILURE.

HEAD FRAMING (HARD RULE — applies whenever a face/head is visible):
- If a person appears, render the FULL HEAD with natural headroom — top of head 5–10% below the upper frame edge
- BOTH eyes must be inside the frame (eye-line crops are an AI failure)
- Chin, jawline, hairline, and forehead ALL fully visible — never sliced by any frame edge
- If the composition cannot give the head full breathing room, FRAME OUT THE PERSON ENTIRELY (use hands-only, partial body, or product-only) — never compromise with a half-cropped face
- Profile / 3/4 / over-the-shoulder shots still need the entire head inside the frame with headroom
- ⛔ Half-face crops, eye-line cuts, forehead cuts, chin cuts, head-bowed-to-hide-face, and "presenter pose with face half out of frame" are HARD FAILURES — reshoot the composition

UNOBSTRUCTED FACE (HARD RULE — the face is in frame AND uncovered):
- The face must be FULLY VISIBLE and UNOBSTRUCTED — eyes, nose, mouth, cheeks, and jawline all clearly in view. NOTHING covers the face: no collar, turtleneck, hood, scarf, mask, or garment pulled up over it; no hand, hair curtain, hat brim, or prop held over or in front of it.
- ⛔ Gestures that hide the face are HARD FAILURES — pulling a sweater / turtleneck collar up over the face, tugging a hood across it, hands cupped over the eyes or mouth, hands covering the face, or burying the face in clothing. If the action uses the hands, keep them at or below the CHIN and to the sides so the whole face stays clear; if the only natural action would cover the face, FRAME OUT THE PERSON ENTIRELY (hands-only or product-only) instead.

FACIAL ASYMMETRY (CRITICAL — AI models default to symmetrical faces):
- One eyebrow MUST sit slightly higher than the other
- Nostrils should be slightly different sizes
- Eyes should differ subtly in openness or shape
- Jawline and cheekbones should NOT mirror perfectly left-to-right
- Lip shape should have natural asymmetry (one side slightly fuller)
- Ears should sit at slightly different heights
- ⛔ A perfectly symmetrical face is the #1 tell of AI generation. The face MUST have visible asymmetry.

HAIR REALISM:
- Natural strand separation — individual strands visible, NOT a uniform block
- Flyaway hairs catching backlight or wind
- Uneven density at temples, hairline, and parting
- Hair reacting to environment (wind, humidity, movement)
- NEVER: perfectly styled immovable hair, solid mass with no strand detail, uniform color

HANDS & ANATOMY (if visible):
- Exactly 5 fingers per hand with correct proportions
- Exactly TWO arms and two hands per person — never an extra, duplicated, or disembodied limb; every visible hand traces to an arm on the same body
- Knuckle wrinkles, visible nail beds, tendons on back of hand
- Natural skin texture on fingers (creases at joints, slight roughness)
- Anatomically correct joint angles — no impossible bends
- HANDS DOING SOMETHING (not idle): hands read as real when they are wrapped around a real object with weight — a mug, a tool, a strap, fabric, the product — caught mid-task, not arranged for the camera. Occupied hands with correct physics are the hardest thing to fake, so when they read right they sell the whole frame.
- ⛔ NEVER the idle "hand drifting up into the hair / grazing the face / resting on the neck or jaw" gesture: it needs no object, so the model defaults to it, and it is a signature AI-portrait tell. Give empty hands a real object to hold or frame them out — and keep occupied hands at or below the chin so the face stays unobstructed per the rule above.

FABRIC ON BODY:
- Visible weave or knit texture (wool, linen, cotton, denim twill)
- Natural creasing at joints (elbows, behind knees, collar)
- Fabric weight and drape consistent with material and gravity
- Matte finish unless genuinely shiny material
- NEVER: satin sheen on matte fabrics, pristine unworn appearance, fabric defying gravity

BACKGROUND PEOPLE (if any figures appear in the background):
- Background people MUST have anatomically correct proportions — proper arm lengths, leg joints, head sizes
- Blurred background figures should still have recognizable human silhouettes — NOT melted or distorted forms
- Background people should have natural poses (walking, sitting, talking) — NOT frozen or puppet-like
- Clothing on background figures must read as real garments even when out of focus
- ⛔ If background people look like melted wax figures or have distorted limbs, the image has FAILED.

CAMERA SPECIFICATION:
Shot on a real camera with a fast prime — name the focal length, aperture, and ISO (e.g. 50mm f/2.0 ISO 640, or 85mm f/1.4 ISO 400). Focal length sets the framing: 35mm environmental, 50mm natural, 85mm portrait compression. Use the lens-and-light language, never a camera-brand name.
FILM RENDERING (REQUIRED — this is the single biggest lever against the "AI photo" look):
- Render as a 35mm FILM photograph on a real emulsion — warm, fleshy, forgiving colour rendering, NOT a digital beauty render. Describe the film LOOK (gentle warmth, soft saturation, fine organic grain), never a brand or film-stock name.
- Visible, organic film grain at the chosen ISO — present across the WHOLE frame including shadows and skin, not a sharpened digital surface.
- Shallow but IMPERFECT depth of field — the focal plane sits where a hand-held shooter would land it, with a touch of focus miss, NOT a flawless computed blur.
- Gentle highlight roll-off and slightly crushed-but-coloured shadows the way film responds — never clipped HDR whites or lifted digital blacks.

CANDID, NOT POSED (HARD RULE — the #1 stock-photo / AI tell after plastic skin):
- The subject's gaze is OFF the camera — looking at what their hands are doing, out a window, toward another person, into middle distance. NEVER eye-contact with the lens unless the brief explicitly demands a direct portrait.
- Caught MID-MOTION / mid-action — pouring, stirring, reaching, walking, mid-sentence — with a GENUINE, specific, focused expression tied to the action (see EMOTIONAL REGISTER below for how much expression is allowed). A real moment intercepted, not a held pose.
- ⛔ NEVER: posing for the camera, smiling straight at the lens, a held "presenter" stance, a vacant blank stare, the frozen catalog-model look, arms-crossed confidence pose, or a face arranged for the photographer. Posing straight at the camera is an automatic FAIL.

EMOTIONAL REGISTER (HARD RULE — over-happy casting is the #1 tell in "realistic but somehow fake" people photos):
- The DEFAULT expression is neutral-warm, focused, mid-thought, or lightly amused — a small closed-mouth half-smile AT MOST. A real moment intercepted, not a reaction performed for the camera.
- ⛔ NO peak laughter, NO wide open-mouth grins, NO "everyone delighted at nothing." If two or more people share the frame, AT MOST ONE carries a genuine small smile; the other(s) are neutral, focused, talking, or looking away.
- ⛔ NO synchronised group joy — people do not all light up at the same instant. Catch them on DIFFERENT emotional beats: one mid-sentence, one half-listening, one glancing off.
- Broad joy has to be EARNED by a specific trigger in the scene — it is never the baseline mood.

ANTI-CLICHÉ SCENE (a flawlessly-rendered cliché still reads as stock/AI):
- Do NOT stage the single most obvious version of the scene (the "friends laughing over coffee", the "maker beaming while holding the product up to the light"). Pick a more specific, slightly ordinary real moment adjacent to it.
- ⛔ No one PRESENTS or displays the product toward the lens. If the product is in frame it is being used, carried, set down, or ignored — never offered up to the camera like a hand model.

BACKGROUND TEXT (legible invented signage always warps — a loud AI tell):
- Any signage, menu, shopfront, or brand lettering behind the subject MUST be thrown OUT OF FOCUS and illegible, or framed out entirely.
- ⛔ NEVER render legible invented shop / café / brand names in the background — they come out warped, doubled, or misspelled and instantly read as fake.

PROP RESTRAINT (a real surface is not art-directed for a magazine):
- The setting is lived-in, not styled. Allow honest clutter that fits the scene — a used or empty cup, crumbs, a stray tool, a phone face-down, slightly uneven spacing.
- ⛔ NO single hero prop centred and perfectly styled for the shot, NO flawless art-directed arrangement where every object is placed just so.

EDITORIAL COMPOSITION (frame it like a magazine page, not a catalog tile):
- ONE clear focal point — a single subject the eye lands on; everything else supports or recedes.
- Deliberate NEGATIVE SPACE around the subject — let the frame breathe; do NOT fill every corner with props.
- Off-centre / rule-of-thirds placement and a real environmental context, not a centred subject on a sweep.

LENS IMPERFECTIONS (include 2+):
- Chromatic aberration at high-contrast edges
- Hexagonal or cat-eye bokeh highlights (NOT smooth circles)
- Natural grain consistent with ISO
- Edge softness / vignetting at frame corners
- Slight barrel distortion on wider lenses

ANTI-GLOW LIGHTING (CRITICAL — this is the #1 AI tell after skin):
- Light MUST come from a describable physical source (window, sun, practical lamp, street light)
- Shadows have sharp falloff and clear direction — NOT soft ambient glow wrapping around the subject
- Highlight and shadow sides of face MUST be clearly UNEVEN — one side brighter, one side darker
- The EYES MUST carry a real CATCHLIGHT — a small, hard specular reflection of the actual light source (window pane, lamp), shaped like that source and sitting on the side the named light comes from. Dead, evenly-lit, catchlight-free eyes are the loudest AI tell after plastic skin.
- Bounce light from a specific surface (wall, pavement, reflective object) — NOT invisible fill
- Hair should NOT have a luminous halo or rim light unless a strong physical backlight source is visible
- Skin should NOT have an even, polished, cinematic sheen — real skin reflects light unevenly and in patches
- ⛔ NEVER: soft wrap-around glow from no source, perfectly balanced fill on both sides, beauty glow, luminous hair halo, even skin radiance. These are the hallmarks of AI-generated imagery.

RULE OF THREE IMPERFECTIONS:
Every image MUST have at least 3 deliberate imperfections:
1. One SKIN TEXTURE cue (visible pores, peach fuzz, uneven oil sheen, fine lines, uneven tone, subtle redness) — NOT acne, pimples, or breakouts
2. One LIGHTING imperfection (uneven shadow falloff, mixed color temperature, harsh highlight clip)
3. One OTHER (hair flyaways, fabric creases, lens grain, environmental grit)

BANNED TERMS — NEVER USE:
4K, 8K, ultra HD, hyper-realistic, masterpiece, cinematic lighting, beauty lighting, flawless skin, porcelain skin, glowing skin, radiant, luminous, airbrushed, doll-like, angelic, perfectly composed, symmetrical face, stunning, gorgeous lighting, dreamy.

NEGATIVE DIRECTIVES:
CGI, render, 3D, airbrushed, plastic skin, waxy skin, doll-like, symmetrical face, smooth glowing skin, perfect hair, glamour lighting, glamour retouching, hyper-clean, porcelain skin, dewy skin, radiant glow, perfect complexion, beauty retouching, fashion render, digitally enhanced, soft focus glow, cinematic glow, smooth bokeh, luminous skin, even wrap lighting, beauty dish glow, heavy makeup, vacant stare, vacant gaze, dead-eyed, empty stare, posing for the camera, smiling at the camera, looking straight at the lens, stock photo, stock-photo pose, oversaturated, HDR, HDR look, spa cliché, towel turban, peak laughter, everyone laughing, laughing hysterically, big open-mouth grin, synchronised group smile, delighted at nothing, all smiling at once, presenting product to camera, offering product to the lens, product held up for display, hand-model presentation, legible background signage, invented shop name, warped shopfront lettering, doubled sign text, melted background text, misspelled background sign, styled tablescape, art-directed props, perfect latte art in every cup, centred hero pastry, magazine-perfect arrangement, acne, pimples, cystic acne, active breakout, whiteheads, blackheads, pustules, inflamed spots, clustered blemishes, acne scarring, rosacea, rash, scabs, dermatological condition, unhealthy skin, face obscured by clothing, collar pulled over face, turtleneck pulled over face, hood over face, scarf over face, garment covering face, cloth pulled over face, hands covering face, hand over mouth, face buried in clothing, hidden face, obscured face.`;

/* ---------- Appendix: partial-body directive (detail shots) ---------- */

const PARTIAL_BODY_DIRECTIVE = `═══════════════════════════════════════════════════════════════
✋ PARTIAL-BODY REALISM (MANDATORY — SCENE SHOWS HANDS / FOREARMS / TORSO FRAGMENT, NO FACE)
═══════════════════════════════════════════════════════════════

You are simulating a camera capturing real human skin — NOT a renderer producing a beauty shot. Only the body parts described in the scene appear; do NOT invent a face, head, or full figure.

SKIN REALISM (mandatory — include 3+ texture details on visible skin):
- Visible skin pores on the back of the hand, knuckles, and forearm
- Natural oils catching light unevenly across knuckles and finger pads
- Fine lines and micro-wrinkles at joints (knuckles, wrist crease, inner elbow)
- Subsurface scattering at fingertips and translucent skin near nail beds
- Peach fuzz / vellus hair on forearm, slight arm hair visible
- Uneven skin tone — subtle redness over knuckles, faint freckles or moles (asymmetric)
- Matte complexion, NOT dewy or glowing. No airbrushing. No porcelain smoothing.
⛔ Skin must NEVER look smooth, plastic, or porcelain. The realism cue is TEXTURE (pores, peach fuzz, fine lines, uneven oil sheen), not BLEMISHES.
⛔ ECOMMERCE MARKETING context — clear and healthy, just not retouched. DO NOT render acne, pimples, pustules, whiteheads, blackheads, scabs, rashes, or any dermatological condition.

HAND & FINGER ANATOMY (CRITICAL — this is the #1 partial-model AI tell):
- Exactly 5 fingers per hand, correct proportions, no merged or fused digits, no extra or duplicated hands in frame
- Knuckle wrinkles, visible nail beds, tendons on back of hand
- Natural creases at finger joints, slight roughness on fingertips
- Anatomically correct joint angles — no impossible bends, no extra knuckles
- Thumb position natural relative to grip — NOT detached or floating
- Nails: short to medium length, slight imperfection, NOT glossy plastic French-manicure

NO-FACE GUARANTEE:
- Do NOT render a face, eyes, mouth, hair, or head in this image
- Do NOT invent a person reaching in from the frame edge as the subject
- If a body fragment appears, it should be naturally engaged with the scene (holding, pouring, seasoning, opening, dispensing) — never disembodied close-up

FABRIC ON VISIBLE BODY (if sleeves / cuffs appear):
- Visible weave or knit texture (linen, cotton, denim, wool)
- Natural creasing at wrist, elbow, cuff
- Matte finish unless genuinely shiny material

CAMERA SPECIFICATION:
Shot on a real camera with a fast prime — name the focal length, aperture, and ISO (e.g. 50mm f/2.0 ISO 640, or 85mm f/1.4 ISO 400). Focal length sets the framing: 35mm environmental, 50mm natural, 85mm portrait compression. Use the lens-and-light language, never a camera-brand name.

LENS IMPERFECTIONS (include 2+):
- Chromatic aberration at high-contrast edges
- Natural grain consistent with ISO
- Slight edge softness / vignetting

ANTI-GLOW LIGHTING (CRITICAL):
- Light MUST come from a describable physical source (window, sun, practical lamp)
- Shadows have sharp falloff and clear direction — NOT soft ambient glow
- Skin on hands and forearm should NOT have an even cinematic sheen — real skin reflects unevenly
- ⛔ NEVER: soft wrap-around glow, beauty glow, luminous skin, even radiance.

RULE OF THREE IMPERFECTIONS:
Every image MUST have at least 3 deliberate imperfections:
1. One SKIN TEXTURE cue on visible skin (pores, peach fuzz, knuckle wrinkles, uneven oil sheen)
2. One LIGHTING imperfection (uneven shadow falloff, mixed color temperature, harsh highlight clip)
3. One OTHER (fabric creases, lens grain, environmental grit, natural prop wear)

BANNED TERMS — NEVER USE:
4K, 8K, ultra HD, hyper-realistic, masterpiece, cinematic lighting, beauty lighting, flawless skin, porcelain skin, glowing skin, radiant, luminous, airbrushed, perfectly composed, stunning, gorgeous lighting, dreamy, doll-like.

NEGATIVE DIRECTIVES:
CGI, render, 3D, airbrushed, plastic skin, doll hands, merged fingers, fused fingers, extra fingers, six fingers, four fingers, missing thumb, distorted hand, melted hand, smooth glowing skin, porcelain skin, dewy skin, radiant glow, beauty retouching, digitally enhanced, soft focus glow, cinematic glow, luminous skin, even wrap lighting, beauty dish glow, glossy plastic nails, French manicure, perfectly groomed hands, acne, pimples, pustules, whiteheads, blackheads, scabs, rash, dermatological condition, face in frame, head in frame, hair in frame, eyes in frame.`;

/* ---------- Appendix: no-invented-text directive ---------- */

const NO_INVENTED_TEXT = `TEXT, LOGOS & PRODUCT MARKS — REPRODUCE, DO NOT INVENT:
Render ONLY the text, logos, and printed marks that already exist on the source
product reference image. Do NOT add stickers, seals, badges, hangtags, swing
tags, price tags, certifications, captions, headlines, watermarks, signage, or
any other words that are not present on the reference. The shoot type
(fashion / packaged goods / fresh produce / beauty / etc.) is implied by the
store context above — let it guide whether the subject is meant to carry text
at all. If the source product is unlabelled (e.g. fresh produce, a raw
material), the rendered product MUST stay unlabelled.`;

/* ---------- Appendix: environmental wear directive ---------- */

const ENVIRONMENTAL_WEAR = `═══════════════════════════════════════════════════════════════
🧹 ENVIRONMENTAL WEAR PLACEMENT (CRITICAL — REAL WEAR IS RANDOM)
═══════════════════════════════════════════════════════════════

Worn surfaces and environmental imperfections only read as real when they are placed the way real wear happens — at random, unrelated to the photo's subject. AI images give themselves away by spending their "realism cues" right next to the subject or along the eye path.

- Wear, rust, scuffs, stains, and chips appear AWAY from the model and AWAY from the product — at frame edges, in the soft-focus background, on surfaces the composition ignores. NEVER on the exact spot the model touches, leans on, or looks at.
- MAXIMUM ONE deliberate imperfection per surface. One faint smudged water ring, not a constellation of perfect circles. One worn patch, not weathering on every rail.
- Marks are IRREGULAR and PARTIAL: a smeared half-ring, a scuff broken by cleaning, rust concentrated at one joint — never geometrically perfect, never evenly spaced, never repeated identical marks.
- Most surfaces in a maintained location (apartment, hotel, shop, café) are simply CLEAN. Restraint reads more real than distress — an over-weathered set is as fake as a pristine one.`;

/* ---------- Appendix: negative keywords (FORBIDDEN section) ---------- */

const FORBIDDEN_KEYWORDS = `AI-generated look, plastic skin, waxy skin, AI smoothing, uncanny facial symmetry, morphing edges, AI color banding, posterization, impossible anatomy, merged fingers, texture tiling, floating objects with no support or intent, inconsistent shadows, digital art, CGI, 3D render, illustration, painting, drawing, cartoon, vector art, chalkboard, blackboard, handwritten signs, text written on boards, writing on surfaces, text on signs, handwritten text, scrawled text, menu board, whiteboard with writing, handwritten notes, handwritten lists, handwritten paper, torn paper with text, paper note with handwriting, written list visible in scene, scrawled list on paper, tasting notes paper with writing, recipe card with handwriting, post-it notes with text, sticky notes with writing, notebook with visible writing, journal with handwriting, calligraphy on paper, fake handwriting, AI handwriting, perfect handwritten font, machine-typeset handwriting, brown kraft paper with text, parchment with calligraphy, ledger book with text, place card with names, menu card with handwriting, invented stickers or seals or tags on the product, text composited onto the photo that was not on the source reference, acne, pimples, cystic acne, active breakout, whiteheads, blackheads, pustules, inflamed spots, clustered blemishes, acne scarring, rosacea, rash, scabs, unhealthy skin, missing head, decapitated subject, cropped face, headless torso, head out of frame, eyes cut by frame edge, forehead cut by frame edge, chin cut by frame edge, hairline cut by frame edge, head bowed unnaturally to hide face, face turned fully away, face obscured by clothing, collar pulled over face, turtleneck pulled over face, hood over face, scarf over face, garment covering face, hands covering face, hand over mouth, face buried in clothing, badly composited cutout with lighting that mismatches the scene, cutout halo fringing and unblended hard edges, scale mismatch between products and scene, model unnaturally carrying multiple bulky items, person hugging too many products at once, products visibly comped behind a person, accidental collage look in a scene meant to read as one photograph, perfectly round airborne droplets floating beside a clear see-through liquid stream, ring of ingredients suspended in mid-air around the product, leaves or botanicals orbiting the product, floating ingredient halo encircling the bottle, garnish hovering in an arc around the product, fruit or peel levitating beside the product in a photographed real-world scene, horizon line passing through a person's body, background visible through a translucent body or garment, person half-dissolving into the background, body merging with the backdrop, extra arms, third arm, extra hands, duplicated limbs, disembodied hand, spray bottle pouring a stream, perfume bottle pouring liquid, liquid pouring from a spray nozzle or pump head, liquid flowing through a closed cap, scoop of ice cream directly on a bare table, served food melting on a bare surface with no bowl or plate, legible invented background signage, warped shopfront lettering, doubled sign text, melted background text, misspelled background sign, cluster of identical stains, constellation of perfect circular water rings, repeated identical wear marks, rust or wear exactly where the subject touches, weathering on every surface`;

/* ---------- Assembly (spec section 4 - order is binding) ---------- */

// The route hands us a client-supplied body, so every field may be missing or
// the wrong type - unknown keys fall back to defaults, non-strings drop out.
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

export function buildPrompt(o: PromptOptions): string {
  const shot = SHOTS[o.shot] ?? SHOTS.crowd;
  const isDetail = shot.people === "partial";

  const custom = str(o.customEvent)?.trim().slice(0, 200);
  const event: { description: string; alcohol: boolean | null } = custom
    ? { description: `${custom} (a letsclick.app social event in Sydney)`, alcohol: null }
    : (EVENTS[o.event] ?? EVENTS.bondi);

  const group = GROUPS[o.group] ?? GROUPS.small_group;
  const vibe = str(o.vibe)?.trim().slice(0, 300);
  const extra = str(o.extra)?.trim().slice(0, 600);

  const moment = MOMENTS[Math.floor(Math.random() * MOMENTS.length)];
  const cameraDirective =
    o.camera === "ugc"
      ? UGC_DIRECTIVE
      : (CAMERA_STYLES[o.camera as Exclude<CameraKey, "ugc">] ?? COMPACT_REALISM);

  const blocks = [
    `SCENE\n${shot.scene}`,
    isDetail ? "" : `THE MOMENT\n${moment}`,
    `SETTING\nLocation: ${event.description}. ${group}.`,
    PLACE_BLOCK,
    messBlock(event.alcohol),
    ENVIRONMENTAL_WEAR,
    vibe ? `VIBE\n${vibe}` : "",
    LIGHTS[o.light] ?? LIGHTS.golden_hour,
    GRADES[o.grade ?? "warm_film"] ?? FILM_GRADE,
    isDetail ? "" : CASTING,
    PHOTOGRAPHY_MODE,
    cameraDirective,
    isDetail ? PARTIAL_BODY_DIRECTIVE : HUMAN_MODEL_DIRECTIVE,
    NO_INVENTED_TEXT,
    extra ? `EXTRA DIRECTION\n${extra}` : "",
    `FORBIDDEN - none of the following may appear:\n${FORBIDDEN_KEYWORDS}`,
  ];

  return blocks.filter(Boolean).join("\n\n");
}
