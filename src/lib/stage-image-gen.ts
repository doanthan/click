import "server-only";

// Atmospheric email-stage prompt assembly for /test-stage. The controls stay
// small on purpose: the campaign concept supplies the meaning, while this file
// supplies the photographic and responsive-email discipline.

export type StagePlacement = "hero" | "closer";
export type StageWorldKey =
  | "electric_aperitivo"
  | "poolside_citrus"
  | "greenhouse_after_rain"
  | "midnight_supper"
  | "paper_theatre"
  | "custom";
export type StageAnchorKey =
  | "atmosphere"
  | "glassware"
  | "serving_ritual"
  | "product_cameo"
  | "product_hero";
export type StageCompositionKey =
  | "orbital_drift"
  | "ingredient_constellation"
  | "suspended_splash"
  | "weightless_tabletop"
  | "seasonal_shower"
  | "macro_passage";
export type StageCopyZone = "left" | "centre" | "right";
export type StageEnergy = "quiet" | "playful" | "electric" | "surreal";
export type StageField = "light" | "dark";

export interface StagePromptOptions {
  placement: StagePlacement;
  concept?: string;
  world?: StageWorldKey;
  anchor?: StageAnchorKey;
  composition?: StageCompositionKey;
  copyZone?: StageCopyZone;
  energy?: StageEnergy;
  field?: StageField;
  ingredients?: string;
  palette?: string;
  productDescription?: string;
  extra?: string;
  hasProductReference?: boolean;
  hasWorldReference?: boolean;
}

const WORLD_DIRECTIONS: Record<StageWorldKey, string> = {
  electric_aperitivo:
    "An electric aperitivo set built from cobalt lacquer, blood-orange glass, brushed stainless steel, grapefruit peel and hard white side light. Crisp, graphic and grown-up, with open shadows and a little after-dark tension.",
  poolside_citrus:
    "A high-key poolside citrus world using pale aqua, citron, coral fruit flesh, clear ice, silver highlights and sharp Australian daylight. Fresh, buoyant and bright without looking tropical-themed.",
  greenhouse_after_rain:
    "A greenhouse just after rain using mineral green, wet clear glass, chalky white stone, herbs, leaf shadows and cool window light. Clean and botanical with believable moisture and quiet depth.",
  midnight_supper:
    "A late supper world using smoked plum, cherry red, pewter, dark timber, candlelight and reflected glass. Intimate and richly coloured, but never crushed to black or covered in cinematic haze.",
  paper_theatre:
    "A playful set built from folded coloured paper, painted timber, clear glass and one oversized natural ingredient. Bold scale and crisp cut shadows make it feel staged by a real art department, not rendered in 3D.",
  custom:
    "Build a distinctive commercial set directly from the campaign concept, requested palette and material cues. Avoid falling back to generic luxury styling or an empty gradient background.",
};

const ANCHORS: Record<StageAnchorKey, string> = {
  atmosphere:
    "No bottle, pack or hero product appears. Let light, surface, colour and a few sensory materials carry the campaign. Glassware may appear only if the concept naturally calls for it.",
  glassware:
    "Use one or two physically convincing wine glasses, coupes or tumblers as the visual anchor. Show real glass thickness, refraction, caustics, liquid meniscus, fingerprints and an imperfect placement. No bottle or packaging appears.",
  serving_ritual:
    "Stage the trace of a serving ritual: a recently moved glass, a ring of condensation, a peel being expressed, ripples settling or a hand entering briefly to place something. Keep any hand anatomically correct and purposeful. No face and no bottle are required.",
  product_cameo:
    "The product is a supporting cameo rather than the centre of the frame. Keep it near an inner side rail, partly surrounded by the world, with correct scale, contact shadow and material response. The campaign atmosphere remains the hero.",
  product_hero:
    "The product is the primary physical anchor, but it still belongs to a staged world rather than a catalogue sweep. Preserve its real proportions and materials, give it a believable contact point, and leave room for later HTML copy.",
};

const COMPOSITIONS: Record<StageCompositionKey, string> = {
  orbital_drift:
    "Use orbital drift: two principal objects arc around the protected copy zone, with only a few small supporting elements at different depths.",
  ingredient_constellation:
    "Use an ingredient constellation: three to five distinct sensory objects occupy different depths without filling every corner.",
  suspended_splash:
    "Use a suspended splash: one coherent liquid gesture carries a few ingredients in a single motion direction. The splash must have a plausible source and physically consistent droplets.",
  weightless_tabletop:
    "Use a weightless tabletop: one real surface anchors the scene while selected objects lift for one frozen instant. Contact shadows and gravity cues remain believable everywhere else.",
  seasonal_shower:
    "Use a seasonal shower: peel, leaves, petals or small ingredients enter from one direction with irregular spacing and one coherent current.",
  macro_passage:
    "Use a macro passage: one oversized natural object crosses an outer edge while smaller, recognisable cues establish scale and depth near the inner rails.",
};

const COPY_ZONES: Record<StageCopyZone, string> = {
  left: "Protect the left third as one continuous, calm, low-detail area for later HTML copy.",
  centre:
    "Protect the central vertical band as one continuous, calm, low-detail area for later HTML copy.",
  right:
    "Protect the right third as one continuous, calm, low-detail area for later HTML copy.",
};

const ENERGIES: Record<StageEnergy, string> = {
  quiet:
    "The energy is quiet and tactile. Use fewer objects, stronger material detail and a composition that feels observed rather than performed.",
  playful:
    "The energy is playful. Use one surprising crop, an asymmetric orbit or one odd scale shift, while keeping the rest of the physics credible.",
  electric:
    "The energy is electric and graphic. Use firmer contrast, decisive colour blocks and a frozen peak gesture, while keeping midtones open and materials real.",
  surreal:
    "The energy is surreal but controlled. Break exactly one physical rule, then make every shadow, reflection, scale cue and material response obey reality.",
};

const PLACEMENTS: Record<StagePlacement, string> = {
  hero:
    "Create the opening hero image for a responsive ecommerce email in portrait 4:5. It should establish the world in one glance, survive a narrower mobile centre crop and leave a generous overlay-safe zone. Keep essential visual anchors partly inside the central 75 percent of the frame.",
  closer:
    "Create the closing image for the bottom of a responsive ecommerce email in landscape 3:2. It should feel like a final detail discovered in the same world: more intimate, tactile and resolved than the hero, with one clear focal point and enough breathing room for a short closing line if needed.",
};

const FIELD_DIRECTIONS: Record<StageField, string> = {
  light:
    "Keep the field light with open midtones, clean highlight detail and one real, motivated light source. Pale areas must retain texture instead of washing into a featureless void.",
  dark:
    "Keep the field deep but readable, using coloured near-dark surfaces and open midtones rather than pure black. Use one motivated practical or side light, with no glow, fog or crushed shadow detail.",
};

const str = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function buildStagePrompt(options: StagePromptOptions): string {
  const placement = PLACEMENTS[options.placement] ? options.placement : "hero";
  const world = WORLD_DIRECTIONS[options.world ?? "custom"]
    ? (options.world ?? "custom")
    : "custom";
  const anchor = ANCHORS[options.anchor ?? "glassware"]
    ? (options.anchor ?? "glassware")
    : "glassware";
  const composition = COMPOSITIONS[options.composition ?? "weightless_tabletop"]
    ? (options.composition ?? "weightless_tabletop")
    : "weightless_tabletop";
  const copyZone = COPY_ZONES[options.copyZone ?? "centre"]
    ? (options.copyZone ?? "centre")
    : "centre";
  const energy = ENERGIES[options.energy ?? "playful"]
    ? (options.energy ?? "playful")
    : "playful";
  const field = FIELD_DIRECTIONS[options.field ?? "light"]
    ? (options.field ?? "light")
    : "light";

  const concept = str(options.concept, 500) ||
    "a fresh email campaign with a distinct sensory world";
  const ingredients = str(options.ingredients, 300);
  const palette = str(options.palette, 240);
  const productDescription = str(options.productDescription, 300);
  const extra = str(options.extra, 600);

  const referenceDirection = options.hasWorldReference
    ? `A previous hero image from this same email world is supplied as a visual reference. Continue its exact palette balance, light direction, material family, ingredient identity and photographic treatment. Do not copy its composition. Create a distinct closing scene that unmistakably belongs to the same campaign.`
    : "";

  const productReferenceDirection = options.hasProductReference
    ? `A real product reference is supplied. Treat it as fixed source material. Preserve its silhouette, packaging proportions, closure, materials, colours and visible contents. Do not redesign it or invent replacement label text. If exact lettering cannot be preserved, keep it naturally small or turned away rather than generating fake copy.`
    : "";

  const productText = productDescription
    ? `Product or vessel direction: ${productDescription}`
    : "";
  const ingredientText = ingredients
    ? `Sensory ingredients and props: ${ingredients}. Use three to seven meaningful objects in total, with exact natural texture rather than a crowded ingredient catalogue.`
    : `Choose a restrained set of three to five sensory materials that express the concept. Avoid the default fruit collage unless fruit is genuinely relevant.`;
  const paletteText = palette
    ? `Requested palette: ${palette}. Express it through real surfaces, glass, ingredients and reflected light rather than a synthetic gradient.`
    : `Derive one controlled palette from the campaign concept and chosen world. Use one dominant field colour, one support colour and one sharper accent.`;

  return [
    `Create premium commercial background photography for an ecommerce email. This is background artwork only. Interface, typography, prices, cards and buttons will be added later in HTML.`,
    PLACEMENTS[placement],
    `CAMPAIGN CONCEPT\n${concept}`,
    `WORLD\n${WORLD_DIRECTIONS[world]}`,
    referenceDirection,
    `VISUAL ANCHOR\n${ANCHORS[anchor]}`,
    productText,
    productReferenceDirection,
    `COMPOSITION\n${COMPOSITIONS[composition]} ${COPY_ZONES[copyZone]} Do not draw, outline or visualise the later overlay. Allow edge objects to crop naturally, but keep the essential idea visible at both 600px and 375px email widths.`,
    `ENERGY\n${ENERGIES[energy]}`,
    `MATERIALS\n${ingredientText} Render glass with real thickness, refraction and contact shadows. Render fruit, botanicals, ice and liquid with irregular cut edges, peel, pulp, veins, moisture and coherent scale. One deliberate surreal action is allowed. Everything else follows believable mass, gravity and lighting.`,
    `LIGHT AND FIELD\n${FIELD_DIRECTIONS[field]}`,
    `PALETTE\n${paletteText}`,
    `CAMERA\nUse a believable 50mm to 85mm commercial-photo perspective with moderate optical depth. Hold the focal anchor in clear focus, keep mid-depth objects recognisable and soften only the furthest elements. Preserve the unblurred source quality so the email can apply its own restrained 12px to 18px soft-focus treatment later.`,
    extra ? `EXTRA DIRECTION\n${extra}` : "",
    `Do not render: words, prices, logos, invented labels, packaging not present in the supplied reference, people, faces, interface elements, fake glass cards, decorative bokeh discs, portals, multiple suns, CGI materials or a featureless gradient void.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
