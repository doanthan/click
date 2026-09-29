import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// The real helper, not a copy - Node strips the types on import.
import { regionFromPostcode } from "../src/lib/geo.ts";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

const form = read("src/components/onboarding-form.tsx");
const onboardingPage = read("src/app/onboarding/page.tsx");
const repo = read("src/lib/event-repository.ts");
const editForm = read("src/components/profile-edit-form.tsx");

test("onboarding is four steps - the event preview screen is gone", () => {
  // Bug board #249 / #265: the preview asked nothing and sat between a new
  // member and the app. The DS onboarding is "4-step + done".
  const keys = [...form.matchAll(/^\s{4}key: "(\w+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ["basics", "intent", "interests", "photo"]);
  assert.doesNotMatch(form, /previewEvents|previewPicks|PreviewCard/);
  assert.doesNotMatch(onboardingPage, /getEventsForExplore|previewEvents/);
});

test("a draft saved in the five-step flow resumes on the right screen", () => {
  // A v4 draft's step index counted the preview. Read as-is, a draft saved on
  // interests (4 steps in: index 3) reopened on the photo screen.
  assert.match(form, /const DRAFT_VERSION = 5;/);
  const map = JSON.parse(form.match(/const V4_STEPS = (\[[\d, ]+\]);/)[1]);
  const oldKeys = ["basics", "intent", "preview", "interests", "photo"];
  const newKeys = ["basics", "intent", "interests", "photo"];
  assert.equal(newKeys[map[oldKeys.indexOf("interests")]], "interests");
  assert.equal(newKeys[map[oldKeys.indexOf("photo")]], "photo");
  assert.equal(newKeys[map[oldKeys.indexOf("preview")]], "interests", "the dropped screen lands on the next one");
  assert.match(form, /if \(draft\.v === 4 && typeof draft\.step === "number"\) draft\.step = V4_STEPS\[draft\.step\];/);
  assert.match(form, /if \(draft\.v === DRAFT_VERSION \|\| draft\.v === 4\) \{/);
});

test("a Google signup's photo reaches the onboarding photo step", () => {
  // Bug board #240: /post-login rehosts the OAuth photo AFTER its response, so
  // /onboarding rendered without it and the photo step asked for one the
  // profile was about to have. The first save reads it back.
  const save = repo.slice(repo.indexOf("export async function saveOnboarding"));
  assert.match(save.slice(0, save.indexOf("\nconst AU_STATES")), /returning photo_url/);
  assert.match(save, /return \{ ok: true, profileId: profile\.id, photoUrl: saved\.rows\[0\]\?\.photo_url \?\? null \};/);
  assert.match(read("src/app/api/onboarding/route.ts"), /photoUrl: result\.photoUrl/);
  assert.match(form, /if \(payload\.photoUrl\) setPhotoUrl\(\(current\) => current \?\? payload\.photoUrl \?\? null\);/);
  assert.match(form, /<AvatarUploader\s+initialUrl=\{photoUrl\}/);
});

test("every new account is routed through onboarding, OAuth included", () => {
  // The routing half of #240 (fixed 2026-08-04): every sign-in is wrapped in
  // /post-login, which sends an un-onboarded attendee to /onboarding before any
  // deep link.
  const actions = read("src/app/login/actions.ts");
  assert.match(actions, /signIn\("google", \{\s*redirectTo: safeCallbackUrl\(/);
  assert.match(actions, /return `\/post-login\?next=\$\{encodeURIComponent\(value\)\}`;/);
  const postLogin = read("src/app/post-login/page.tsx");
  assert.match(postLogin, /if \(explicitNext && \(!needsOnboarding \|\| status\.merchantProfile \|\| isHostRoute\)\)/);
});

test("the quiz outranks the bio on the setup checklist, and the bio opens focused", () => {
  const body = repo.slice(
    repo.indexOf("export async function getProfileCompletion"),
    repo.indexOf("export async function getApprovedMerchantForSession"),
  );
  // Both lists - the fallback and the live one - in the same order (#283).
  const lists = body.split("const items: ProfileCompletionItem[] = [").slice(1);
  assert.equal(lists.length, 2);
  for (const list of lists) {
    const order = [...list.matchAll(/key: "(\w+)"/g)].map((m) => m[1]).slice(0, 5);
    assert.deepEqual(order, ["photo", "suburb", "tags", "quiz", "bio"]);
  }
  // #241: "Write a short bio" lands ON the field, with a save beside it.
  assert.match(repo, /const PROFILE_EDIT_BIO_HREF = "\/profile\/edit\?focus=bio";/);
  assert.equal((body.match(/href: PROFILE_EDIT_BIO_HREF/g) ?? []).length, 2);
  assert.match(read("src/app/profile/edit/page.tsx"), /focusBio=\{params\?\.focus === "bio"\}/);
  assert.match(editForm, /<div id="bio"/);
  assert.match(editForm, /field\.focus\(\{ preventScroll: true \}\);/);
  assert.match(editForm, /\{focusBio \? \(\s*<div className="mt-3">\s*<SubmitButton pendingLabel="Saving…">Save bio<\/SubmitButton>/);
  // Unwrapped when focused, so it is not held at opacity 0 by Reveal.
  assert.match(editForm, /\{focusBio \? bioGroup : <Reveal>\{bioGroup\}<\/Reveal>\}/);
});

test("an out-of-pilot postcode reads as out of area, never as an error", () => {
  // The rule the note keys on - the same one onboarding uses.
  assert.equal(regionFromPostcode("2204"), "Sydney");
  assert.equal(regionFromPostcode("2750"), "Sydney");
  assert.equal(regionFromPostcode("3000"), "Melbourne");
  assert.equal(regionFromPostcode("2500"), "Other");
  assert.equal(regionFromPostcode("4000"), "Other");

  // #250: a real postcode outside the pilot gets the onboarding promise.
  assert.match(editForm, /setOutOfArea\(regionFromPostcode\(code\) !== "Sydney"\);/);
  assert.match(editForm, /\{outOfArea \? \(/);
  assert.match(editForm, /tell you the moment Click reaches your area/);
  // #251: an unknown code is a neutral hint, not the red field error it was.
  const notFoundStart = editForm.indexOf("if (res.status === 404) {");
  const notFound = editForm.slice(notFoundStart, editForm.indexOf("return;", notFoundStart));
  assert.match(notFound, /setPcStatus\("idle"\);/);
  assert.doesNotMatch(notFound, /setPcStatus\("error"\)/);
  assert.doesNotMatch(editForm, /We don't recognise that postcode/);

  // And the server stores any suburb: nothing rejects an out-of-pilot one.
  const update = repo.slice(repo.indexOf("export async function updateOwnProfile"));
  assert.doesNotMatch(update.slice(0, update.indexOf("\nexport ")), /isWithinSydneyPilot|regionFromPostcode/);
});

test("a select wears the same box as the text field beside it", () => {
  // #252: Safari painted its native control over .ck-input on a <select>, so
  // the suburb picker never matched the postcode field next to it.
  const css = read("src/app/globals.css");
  const start = css.indexOf("@layer components {");
  let depth = 0;
  let end = start;
  for (; end < css.length; end += 1) {
    if (css[end] === "{") depth += 1;
    else if (css[end] === "}" && --depth === 0) break;
  }
  const layer = css.slice(start, end);
  const rule = layer.slice(layer.indexOf("select.ck-input {"));
  assert.ok(layer.includes("select.ck-input {"), "the rule must sit in the components layer");
  assert.match(rule, /appearance: none;/);
  assert.match(rule, /var\(--slate\)/);
  assert.doesNotMatch(rule.slice(0, rule.indexOf("}")), /#[0-9a-fA-F]{3,6}\b/, "tokens, never hex");
});

test("the Click quiz opens as a modal over the page it was opened from", () => {
  // #253 / #287: a modal on /dashboard and /profile/edit, so an edit in
  // progress is still on screen when it closes.
  const modal = read("src/components/life-quiz-modal.tsx");
  assert.match(modal, /data-opens-overlay=""/);
  assert.match(modal, /event\.preventDefault\(\);\s*setOpen\(true\);/);
  // The steps only mount once the profile's answers have loaded - a retake is
  // authoritative, and a blank board would clear what the member never saw.
  assert.match(modal, /\) : initial === null \? \(/);
  assert.match(modal, /<LifeQuizStep\s+key=\{step\}\s+step=\{step\}\s+onStep=\{setStep\}/);

  // The edit page's leave-without-saving guard lets that link through.
  assert.match(read("src/lib/use-unsaved-guard.ts"), /if \(anchor\.hasAttribute\("data-opens-overlay"\)\) return;/);
  assert.match(editForm, /<LifeQuizModalLink\s+className=/);
  assert.doesNotMatch(editForm, /href="\/quiz\/life"/);
  assert.match(read("src/app/dashboard/page.tsx"), /const Row = item\.key === "quiz" \? LifeQuizModalLink : Link;/);

  // The modal's save is the route's save without the hub redirect.
  const actions = read("src/app/quiz/life/actions.ts");
  const inPlace = actions.slice(actions.indexOf("export async function saveLifeQuizInPlaceAction"));
  assert.doesNotMatch(inPlace.slice(0, inPlace.indexOf("\n}")), /redirect\(/);
  assert.match(actions, /revalidatePath\("\/dashboard"\);/);
  assert.match(actions, /revalidatePath\("\/profile\/edit"\);/);
  const wizard = read("src/components/life-quiz-wizard.tsx");
  assert.match(wizard, /if \(onStep\) onStep\(step \+ 1\);/);
  assert.match(wizard, /await saveLifeQuizInPlaceAction\(fd\);\s*clearDraft\(\);\s*onSaved\(\);/);
});

test("the Security tab says plainly there is no password to change", () => {
  // #254: Click signs in by one-time email link or OAuth.
  const settings = read("src/app/account-settings/page.tsx");
  assert.match(settings, /Click doesn&apos;t use passwords, so there&apos;s none to change\./);
});

test("each onboarding step says what can be changed later, and only that", () => {
  // Bug board #303: "add you can edit this later". Intent and photo already
  // said so; basics and interests did not. The basics line names the name and
  // postcode only - the birth date is the age check and has no edit path.
  assert.match(form, /sub: "Just enough to show you what's on near you\. You can change your name and postcode later\.",/);
  assert.match(form, /Three or more and your suggestions get sharp, and you can change them any time\./);
  assert.match(form, /you can change it whenever/);
  assert.match(form, /leave both for later/);
  // What the copy promises is what profile edit actually offers.
  assert.match(editForm, /displayName: string;/);
  assert.match(editForm, /postcode: string;/);
  assert.match(editForm, /interests: string\[\];/);
  assert.doesNotMatch(editForm, /birthDate|birth_date/);
});
