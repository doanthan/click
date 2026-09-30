import test from "node:test";
import assert from "node:assert/strict";
import {
  CLICK_QUIZ_LIFE_TAGS,
  CLICK_QUIZ_QUESTIONS,
  CLICK_QUIZ_STEPS,
  answersFromExisting,
  lifeTagsFor,
  personaFor,
  sanitizeAnswers,
  toggleAnswer,
} from "../src/lib/click-quiz.ts";

const question = (id) => CLICK_QUIZ_QUESTIONS.find((q) => q.id === id);
const slugs = (answers) => lifeTagsFor(answers).map((tag) => tag.slug);

test("the Click quiz is the spec's five steps, intent-neutral, hyphens only", () => {
  // click-tech Click_Design_Prompt_Quiz.md rev 5 Jul 2026: onboarding owns intent
  // and dating, so the quiz never asks who you want to meet.
  assert.deepEqual(
    CLICK_QUIZ_STEPS.map((step) => step.title),
    ["Set the scene", "Your social style", "Right about now", "Timing and distance", "Anything you'd like us to know?"],
  );
  const copy = JSON.stringify(CLICK_QUIZ_STEPS);
  assert.doesNotMatch(copy, /dating|intent|"Men"|"Women"/i);
  assert.doesNotMatch(copy, /\u2014/, "hyphens, never em-dashes");
  assert.doesNotMatch(copy, /\bmatch/i, "'match' is banned copy");
  // Sensitive goes last, and the LGBTQ+ line never promises a community signal.
  const lgbtq = question("lgbtq");
  assert.equal(CLICK_QUIZ_STEPS.at(-1).questions.includes(lgbtq), true);
  assert.equal(lgbtq.note, "Optional and private to you - it helps us keep events welcoming.");
});

test("an untrusted payload is cut down to known questions and values", () => {
  assert.deepEqual(
    sanitizeAnswers({
      size: ["large-social", "intimate", "intimate", "huge"],
      recharge: ["introvert"],
      pace: "fast",
      stage: ["none", "student"],
      intent: ["dating"],
      __proto__: { polluted: true },
    }),
    // option order, de-duplicated; a multi given to a single drops; an unknown
    // question drops; the exclusive "none" loses to a real answer
    { size: ["intimate", "large-social"], pace: "fast", stage: ["student"] },
  );
  assert.deepEqual(sanitizeAnswers(null), {});
  assert.deepEqual(sanitizeAnswers(["size"]), {});
});

test("a tap toggles, and 'None of these' stands alone", () => {
  const stage = question("stage");
  assert.deepEqual(toggleAnswer(stage, ["student"], "new-parent"), ["student", "new-parent"]);
  assert.deepEqual(toggleAnswer(stage, ["student", "new-parent"], "none"), ["none"]);
  assert.deepEqual(toggleAnswer(stage, ["none"], "student"), ["student"]);
  assert.equal(toggleAnswer(stage, ["student"], "student"), undefined);
  const pet = question("pet");
  assert.equal(toggleAnswer(pet, undefined, "yes"), "yes");
  assert.equal(toggleAnswer(pet, "yes", "no"), "no");
  assert.equal(toggleAnswer(pet, "no", "no"), undefined, "every question is optional");
});

test("only the spec's life-tag answers write life tags", () => {
  // LGBTQ+ is written ONLY for an explicit yes - "Prefer not to say" and "No"
  // leave nothing behind.
  assert.deepEqual(slugs({ lgbtq: "yes" }), ["lgbtq-plus"]);
  assert.deepEqual(slugs({ lgbtq: "prefer-not" }), []);
  assert.deepEqual(slugs({ lgbtq: "no" }), []);
  assert.deepEqual(
    slugs({ stage: ["new-in-town", "recently-retired", "changing-careers"], pet: "yes" }),
    ["new-to-town", "retired", "career-pivot", "pet-owner"],
  );
  assert.deepEqual(slugs({ stage: ["none"], pet: "no" }), []);
  // Only alcohol-free is a standing preference; the other comfort needs are
  // 30-day mood signals the schema cannot expire, so they stay answers.
  assert.deepEqual(slugs({ comfort: ["activity", "small-group", "alcohol-free"] }), ["sober-curious"]);
  // Room, vibe, timing and people answers write no tags.
  assert.deepEqual(
    slugs({ size: ["intimate"], vibe: ["creative"], free: ["saturday"], clickwith: ["deep"], distance: "suburb" }),
    [],
  );
});

test("the persona takes what was answered and nothing it wasn't", () => {
  assert.deepEqual(personaFor({}), { socialEnergy: null, pace: null, openness: null });
  assert.deepEqual(personaFor({ recharge: "introvert", strangers: "jump-in", pace: "fast" }), {
    socialEnergy: "introvert", // recharge decides; strangers only reinforces
    pace: "fast_moving",
    openness: "ready",
  });
  assert.deepEqual(personaFor({ strangers: "observe" }), {
    socialEnergy: "introvert",
    pace: null,
    openness: "cautious",
  });
});

test("existing quiz data opens as answers, so Finish never clears what was not shown", () => {
  // The old Life quiz's pills that still have a home...
  assert.deepEqual(
    answersFromExisting(["retiree", "weekends", "small-table", "pet-owner", "recently-single"], {
      socialEnergy: "extrovert",
      pace: "fast_moving",
      openness: "cautious",
    }),
    {
      size: ["intimate"],
      recharge: "extrovert",
      strangers: "observe",
      pace: "fast",
      free: ["saturday", "sunday"],
      stage: ["recently-retired"],
      pet: "yes",
    },
  );
  // ...and everything the quiz writes reads back to the same tags and persona.
  const full = {
    stage: ["new-in-town", "single-parent", "kids-left-home"],
    pet: "yes",
    lgbtq: "yes",
    comfort: ["alcohol-free"],
    recharge: "ambivert",
    strangers: "depends",
    pace: "balanced",
  };
  const reopened = answersFromExisting(slugs(full), personaFor(full));
  assert.deepEqual(slugs(reopened), slugs(full));
  assert.deepEqual(personaFor(reopened), personaFor(full));
  assert.deepEqual(answersFromExisting([], null), {});
});

test("every life tag the quiz writes has a distinct slug and a label", () => {
  const all = CLICK_QUIZ_LIFE_TAGS.map((tag) => tag.slug);
  assert.equal(new Set(all).size, all.length);
  for (const tag of CLICK_QUIZ_LIFE_TAGS) assert.ok(tag.label.trim().length > 0, tag.slug);
});
