// Bug board rows from 2026-09-29 about browsing: the Discover sort and the
// landing page. Source assertions - both are components that cannot be
// imported into node:test.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

test("Discover can sort by price, free first", () => {
  // Bug board #307: "sort by price?".
  const explorer = read("src/components/event-explorer.tsx");
  assert.match(explorer, /type SortMode = "soonest" \| "nearest" \| "popular" \| "price";/);
  assert.match(explorer, /\["price", "Lowest price"\],/);
  assert.match(explorer, /if \(sortMode === "price"\) \{\s*const priceDelta = priceCentsOf\(left\) - priceCentsOf\(right\);/);

  // priceCentsOf reads the card's label back into cents, and the label is
  // formatPriceLabel's - pin both ends so a new label format can't silently
  // sort everything as free.
  assert.match(explorer, /if \(isFreeEvent\(event\)\) return 0;\s*const amount = Number\(event\.price\.replace\(\/\[\^0-9\.\]\/g, ""\)\);/);
  const amounts = read("src/lib/amounts.ts");
  assert.match(amounts, /if \(cents <= 0\) return "Free";\s*return formatMoney\(cents, currency\);/);
});

test("the landing page carries no Click persona", () => {
  // Bug board #308: "Remove click persona from the landing page". The quiz
  // block is gone, and so is the no-events state's pitch for the same quiz.
  const home = read("src/app/page.tsx");
  assert.doesNotMatch(home, /HomeQuiz|home-quiz|getLatestPersonaForSession/);
  assert.doesNotMatch(home, /\/quiz\/personality|vibe quiz|Pick your vibe/);
  assert.equal(existsSync(path.join(root, "src/components/home-quiz.tsx")), false);
  // The full quiz still lives at /quiz/personality.
  assert.ok(existsSync(path.join(root, "src/app/quiz/personality/page.tsx")));
});
