#!/usr/bin/env node
// The six C4 static greps from TECH/implementation/CLICK_PROCESS_RUNBOOK.md, wired
// so the C6 ship-gate line "All C4 greps return clean" is something a machine can
// answer. They existed only as a shell block in a markdown file, which meant nobody
// ran them and two of them could not run at all.
//
// Written in node rather than as a shell one-liner for three reasons, all of which
// the raw greps ran into:
//
//  1. TWO OF THE SIX POINT AT DIRECTORIES THAT DO NOT EXIST. The runbook scopes the
//     score-leak grep to src/components/discovery/ and the no-chat grep to
//     src/components/coordination/; this repo has a flat src/components/, so both
//     errored with "No such file or directory" and passed by checking nothing. They
//     are re-pointed at this repo's real discovery and coordination surfaces, named
//     file by file below so the scope is reviewable instead of implied by a path.
//  2. COMMENTS ARE NOT COPY. This codebase comments the WHY at length and quotes the
//     banned strings while doing it ("no `N clicks left`"), so a grep that reads its
//     own rationale as the violation reports nothing but noise. Copy checks run on
//     the source with comments stripped.
//  3. SOME HITS ARE LEGITIMATE AND MUST STAY. An internal `status = 'expired'` is a
//     column value, not something a person reads; `.matchAll(` is the standard
//     library. Those are EXEMPTIONS with a stated reason, not a softened pattern -
//     the point is that the next person can see exactly what was forgiven and why.
//
// Run: npm run greps        (also enforced by tests/click-greps.test.mjs)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// src/app/md is a generated audit-coverage dump - prose ABOUT the code, shipped as
// a dev-only surface that 404s in production. It quotes old spec text verbatim,
// banned strings and all, and re-exporting it would silently rewrite the audit.
const SKIP_DIRS = [path.join("src", "app", "md")];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.some((skip) => rel === skip || rel.startsWith(skip + path.sep))) continue;
      walk(full, out);
    } else if (/\.(tsx?|mjs|css)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const ALL = walk(path.join(root, "src")).map((p) => p.split(path.sep).join("/"));

// The two surfaces that may send a click (Part A invariant 1) plus the pages that
// mount them. This IS the runbook's src/components/discovery/, spelled the way this
// repo actually lays it out.
const DISCOVERY = [
  "src/components/click-with-someone-user-card.tsx",
  "src/components/click-radar.tsx",
  "src/app/people/page.tsx",
  "src/app/people/actions.ts",
];

// ...and its src/components/coordination/. The drawer is the whole coordination
// flow, S1 to S18; the list is the shelf it opens from.
const COORDINATION = [
  "src/components/coordination-drawer.tsx",
  "src/components/clicks-list.tsx",
  "src/app/proposals/page.tsx",
  "src/app/proposals/actions.ts",
];

// The click mechanic end to end - what greps 4 and 6 are actually about. Scoped
// rather than repo-wide: see the note on grep 6.
const CLICK_FLOW = [
  ...DISCOVERY,
  ...COORDINATION,
  "src/components/post-event-click-card.tsx",
  "src/components/mutual-toast.tsx",
  "src/lib/clicks/constants.ts",
  "src/lib/clicks/teardown.ts",
  "src/lib/click-data.ts",
  "src/app/api/clicks/route.ts",
  "src/app/api/events/suggestions/route.ts",
  "src/app/api/cron/post-event-clicks/route.ts",
  "src/app/dashboard/actions.ts",
].filter((f) => existsSync(path.join(root, f)));

// Comments carry the reasoning, including quotations of the very strings being
// hunted. Only the code and the copy are the subject.
const stripComments = (src) =>
  src.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * Each check: the runbook's grep, this repo's scope for it, and an `allow` list of
 * exemptions. An exemption is `{ re, why }` - a line matching `re` is forgiven, and
 * `why` is the part that matters: an allowlist nobody can read is a disabled grep
 * with extra steps.
 */
const CHECKS = [
  {
    id: 1,
    what: "the click button lives only on the two click surfaces - never a profile or an attendee list",
    scope: ALL,
    strip: false,
    re: /ClickBtn|click with/gi,
    only: /profile|attendee/i,
    allow: [
      {
        re: /You don&apos;t click with a profile|to click with\.|Sign in to click with people|See your click with/,
        why: "Marketing and profile PROSE. The rule is about a control that can post a send; /profile is read-only and the two-surface test in tests/click-coordination.test.mjs is what proves it.",
      },
      {
        re: /A few people you might click with are going/,
        why: "The attendee-preview teaser on an event page. A sentence about who is going, with no control attached.",
      },
      {
        re: /Add your date of birth in your profile before you can click with anyone\./,
        why: "A server-side refusal telling the SENDER about their own profile. Names no receiver and renders no button.",
      },
      {
        re: /profile card \/ in the "click with someone" pool/,
        why: "Upload-route comment naming the pool an avatar feeds.",
      },
      {
        re: /post-event "did you click with anyone\?" notification/,
        why: "Cron docblock naming the push it sends.",
      },
      {
        re: /label: "Add a photo to Click with others"/,
        why: "An onboarding-checklist row, caught only because its href is /profile/edit. It links somebody to their own edit page; it sends nothing.",
      },
    ],
  },
  {
    id: 2,
    what: "no window countdown leaked to the client",
    scope: ALL.filter((f) => f.startsWith("src/components/")),
    strip: true,
    re: /closes_at|days left|window closes|clicks left/gi,
    allow: [
      {
        re: /admin-money-attention\.tsx/,
        file: true,
        why: "A merchant PAYOUT ageing badge in the admin console ('N days left' until a payout is overdue). A different clock, on a staff-only surface, with nothing to do with the click window - which is a backend concept the attendee UI may only know as open or not open.",
      },
    ],
  },
  {
    id: 3,
    what: "no suggestion score or rank leaked on the discovery surfaces",
    scope: DISCOVERY,
    strip: true,
    re: /score|rank|match ?%|why you.re seeing/gi,
    allow: [],
  },
  {
    id: 4,
    what: "banned language on the click surfaces",
    scope: CLICK_FLOW,
    strip: true,
    re: /\bmatch(ed|es)?\b|expired|you missed|didn't line up|clicks left|refreshes about/gi,
    allow: [
      {
        re: /\.match(All)?\(|matchMedia|\bmatchParams\b|surfaceMatch|const match =|return match \?\?/,
        why: "The standard library and local identifiers. `match` is banned as a WORD FOR A MUTUAL CLICK, not as an identifier - CLICK_LANGUAGE bans the noun the user reads.",
      },
      {
        re: /No events match &quot;\{q\}&quot; - try another search\./,
        why: "The picker's empty-search line. `match` here is a verb about EVENTS against a search box, never a word for a pair of people - the ban is on calling a mutual click a match. Flagged to the copy owner all the same: 'Nothing here for ...' would sidestep the argument entirely.",
      },
      {
        re: /'expired'|"expired"|expires_at|expiresAt|expired_at|isExpired|\bexpiry\b/,
        why: "The mutual_status enum value and the column behind it. B7.6 bans TELLING someone their click expired; the database is entitled to say so to itself. Nothing here renders.",
      },
    ],
  },
  {
    id: 5,
    what: "no chat on the coordination surfaces",
    scope: COORDINATION,
    strip: true,
    re: /\b(message|chat|inbox|reply|thread|composer)\b/gi,
    allow: [
      {
        re: /\bmessage\b\s*(in error|\?:|:|\)|;|=|&&)|\.message\b|"message"|errorMessage|state\.message/,
        why: "A server action's `{ ok, message }` result shape and the error-unwrapping around it - the red line under a form, not a message TO the other person. Renaming the field would be churn; what the invariant forbids is a way to send somebody words, and there is none.",
      },
      {
        re: /isn't told, and no message is sent/,
        why: "Copy that exists to say there is NO message. Removing the word would remove the reassurance.",
      },
    ],
  },
  // The runbook scopes this to all of src/ and CLAUDE.md binds it "in copy,
  // comments, docs, everywhere". 6a/6b used to be split because src/ carried
  // several hundred em-dashes and 6b named the click-surface files that still
  // owed the sweep; that debt is now cleared, so the two are folded back into
  // one check with strip:false - COPY AND COMMENTS alike, no exemptions.
  // Still narrower than the rule: scope is CLICK_FLOW, not all of src/. The
  // generated src/app/md dump is the remaining holdout for a repo-wide widen.
  // tests/host-journey.test.mjs already holds the whole line over the 17
  // merchant/host files.
  {
    id: "6",
    what: "no em- or en-dashes in click-surface copy or comments (CLAUDE.md rule)",
    scope: CLICK_FLOW,
    strip: false,
    re: /[\u2014\u2013]/g,
    allow: [],
  },
];

let failed = 0;
for (const check of CHECKS) {
  const hits = [];
  for (const file of check.scope) {
    const abs = path.join(root, file);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, "utf8");
    const src = check.strip ? stripComments(raw) : raw;
    src.split("\n").forEach((line, i) => {
      check.re.lastIndex = 0;
      if (!check.re.test(line)) return;
      if (check.only && !check.only.test(line)) return;
      const exempt = check.allow.find((a) => (a.file ? a.re.test(file) : a.re.test(line)));
      if (exempt) return;
      hits.push(`  ${file}:${i + 1}  ${line.trim().slice(0, 140)}`);
    });
  }
  if (hits.length) {
    failed += 1;
    console.error(`\nC4 grep ${check.id} FAILED - ${check.what}`);
    for (const hit of hits.slice(0, 25)) console.error(hit);
    if (hits.length > 25) console.error(`  ... and ${hits.length - 25} more`);
  } else {
    console.log(`C4 grep ${check.id} clean - ${check.what}`);
  }
}

if (failed) {
  console.error(
    `\n${failed} of ${CHECKS.length} C4 greps returned hits. Either the copy is wrong, or the hit is ` +
      `legitimate and belongs in that check's \`allow\` list WITH a reason.\n`,
  );
  process.exit(1);
}
console.log(`\nAll ${CHECKS.length} C4 greps clean.`);
