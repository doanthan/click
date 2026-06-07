// Matching v2 §1.3 — sub-tag derivation.
//
// Declared interest tags are too coarse: `yoga` lumps hot/vinyasa/yin together,
// which predict different lifestyles. Sub-tags refine a parent interest tag by
// matching the event's title+description against patterns. They're ADDITIVE —
// they don't replace interest tags, they sharpen the behavioural signal (two
// "yoga" users with yoga_hot:6 vs yoga_yin:5 have low sub-tag overlap).
//
// Taxonomy lives in code (per spec) keyed by parent interest-tag slug. Extend
// freely; unmatched parents simply contribute no sub-tags.

export type SubTagPattern = { subTag: string; patterns: RegExp[] };

// Keyed by the PARENT interest-tag slug as it appears in the `tags` taxonomy
// (hyphenated, e.g. 'pc-gaming', 'korean-bbq'). Calibrated to the live Sydney
// catalogue's actual vocabulary — adding a new interest category means adding
// its sub-tags here. An event only gets a sub-tag if it carries the parent tag
// AND its title/description matches a pattern.
export const SUB_TAG_PATTERNS: Record<string, SubTagPattern[]> = {
  food: [
    { subTag: "food_korean_bbq", patterns: [/korean.?bbq/i, /\bkbbq\b/i] },
    { subTag: "food_hotpot", patterns: [/hot ?pot/i, /shabu/i] },
    { subTag: "food_ramen", patterns: [/ramen/i] },
    { subTag: "food_yumcha", patterns: [/yum ?cha/i, /dim ?sum/i, /dumpling/i] },
    { subTag: "food_pizza", patterns: [/pizza/i] },
  ],
  fitness: [
    { subTag: "fitness_boxing", patterns: [/box(ing)?/i, /muay thai/i, /sparring/i] },
    { subTag: "fitness_run", patterns: [/\brun\b/i, /\b5k\b/i, /\b10k\b/i, /parkrun/i] },
    { subTag: "fitness_yoga", patterns: [/yoga/i, /vinyasa/i, /pilates/i] },
    { subTag: "fitness_strength", patterns: [/crossfit/i, /strength/i, /lifting/i, /hiit/i, /bootcamp/i] },
    { subTag: "fitness_spin", patterns: [/spin/i, /cycle/i, /\bride\b/i] },
  ],
  wine: [
    { subTag: "wine_tasting", patterns: [/tasting/i, /\bflight\b/i, /cellar door/i] },
    { subTag: "wine_natural", patterns: [/natural wine/i, /low-?intervention/i, /orange wine/i] },
    { subTag: "wine_paint_sip", patterns: [/paint.{0,6}sip/i, /sip.{0,6}paint/i] },
    { subTag: "wine_bar", patterns: [/wine bar/i] },
  ],
  car: [
    { subTag: "car_meet", patterns: [/meet/i, /cars and coffee/i] },
    { subTag: "car_jdm", patterns: [/\bjdm\b/i, /drift/i, /import/i] },
    { subTag: "car_classic", patterns: [/classic/i, /vintage/i, /retro/i] },
    { subTag: "car_track", patterns: [/track day/i, /circuit/i, /motorsport/i] },
  ],
  "pc-gaming": [
    { subTag: "pcgaming_lan", patterns: [/lan party/i, /\blan\b/i] },
    { subTag: "pcgaming_moba", patterns: [/dota/i, /league of legends/i, /\bmoba\b/i] },
    { subTag: "pcgaming_fps", patterns: [/valorant/i, /counter-?strike/i, /\bcs2\b/i, /\bfps\b/i] },
  ],
  "live-music": [
    { subTag: "livemusic_band", patterns: [/\bband\b/i, /\bgig\b/i, /live set/i] },
    { subTag: "livemusic_acoustic", patterns: [/acoustic/i, /singer-?songwriter/i] },
    { subTag: "livemusic_dj", patterns: [/\bdj\b/i, /techno/i, /house music/i] },
  ],
  "live-jazz": [
    { subTag: "jazz_trad", patterns: [/jazz/i, /swing/i, /bebop/i] },
    { subTag: "jazz_lounge", patterns: [/lounge/i, /late night/i, /speakeasy/i] },
  ],
  hiking: [
    { subTag: "hiking_trail", patterns: [/trail/i, /track/i, /bushwalk/i] },
    { subTag: "hiking_coastal", patterns: [/coastal/i, /cliff/i, /\bbay\b/i, /\bbeach\b/i] },
    { subTag: "hiking_summit", patterns: [/summit/i, /\bpeak\b/i, /lookout/i] },
  ],
  outdoors: [
    { subTag: "outdoors_water", patterns: [/kayak/i, /paddle/i, /surf/i, /swim/i] },
    { subTag: "outdoors_picnic", patterns: [/picnic/i, /park/i, /sunset/i] },
  ],
  pickleball: [
    { subTag: "pickleball_social", patterns: [/social/i, /beginner/i, /\bmixer\b/i] },
    { subTag: "pickleball_comp", patterns: [/tournament/i, /ladder/i, /\bcomp\b/i] },
  ],
  dating: [
    { subTag: "dating_speed", patterns: [/speed dating/i] },
    { subTag: "dating_singles", patterns: [/singles/i, /mixer/i, /matchmak/i] },
  ],
  painting: [
    { subTag: "painting_life_drawing", patterns: [/life drawing/i, /figure/i] },
    { subTag: "painting_workshop", patterns: [/workshop/i, /\bclass\b/i, /paint.{0,6}sip/i] },
  ],
};

// Derive sub-tags for an event from its text, scoped to the parent interest
// tags the event already carries. Runs at publish (writes events.sub_tags).
export function deriveSubTags(
  title: string,
  description: string,
  parentTagSlugs: string[],
): string[] {
  const haystack = `${title} ${description}`;
  const out = new Set<string>();
  for (const parent of parentTagSlugs) {
    const patterns = SUB_TAG_PATTERNS[parent.toLowerCase()];
    if (!patterns) continue;
    for (const { subTag, patterns: regexes } of patterns) {
      if (regexes.some((re) => re.test(haystack))) out.add(subTag);
    }
  }
  return [...out];
}
