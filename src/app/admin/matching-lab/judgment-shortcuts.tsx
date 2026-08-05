"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Keyboard shortcuts for the three judgment buttons: 1 = strong fit, 2 = maybe,
 * 3 = not a fit.
 *
 * These exist ONLY because "Undo last label" now exists. A curated label is a
 * permanent row in the ML training set, and until the undo landed a single
 * stray keystroke could write one with no way back - a speed win paid for with
 * an unrecoverable mistake, on the one surface whose whole job is preventing
 * mistakes. Do not keep these if the undo control is ever removed.
 *
 * Enhancement only: the buttons are real submits inside a real server-action
 * form, so the page works identically with scripting off. This component just
 * routes a keystroke into the same submitter a tap would use.
 */

// The three judgments, keyed by the digit that fires them. Values must match
// the buttons' data-judgment attributes in page.tsx (which in turn match the
// judgment strings saveCuratedMatchLabel accepts).
const KEY_TO_JUDGMENT: Record<string, string> = {
  "1": "strong_fit",
  "2": "maybe",
  "3": "not_a_fit",
};

// Referentially-stable no-op subscribe for the hydration flag below - same
// idiom as ClickWalkthrough.
const noopSubscribe = () => () => {};

export function JudgmentShortcuts() {
  // False on the server and in the first client render, true once hydrated, so
  // the legend never promises a shortcut to a reader whose JS never ran and the
  // two renders still agree. useSyncExternalStore gives us that with no
  // setState-in-effect, which the repo's react-hooks lint forbids.
  const live = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    // One judgment per mounted pair. The submit navigates, but only after a
    // server round-trip - without this latch a second digit pressed inside that
    // window would write a SECOND label, for the pair still on screen. The page
    // remounts this component per pair (React key), so the latch resets exactly
    // when a new pair arrives.
    let fired = false;

    function onKeyDown(event: KeyboardEvent) {
      // Held keys and browser/OS chords are never a judgment.
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

      const judgment = KEY_TO_JUDGMENT[event.key];
      if (!judgment) return;

      // Never steal a keystroke from a field. The "Why?" box sits one Tab from
      // the judgment buttons, and typing "1" in it has to type a 1.
      const focused = document.activeElement;
      if (
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement ||
        focused instanceof HTMLSelectElement ||
        (focused instanceof HTMLElement && focused.isContentEditable)
      ) {
        return;
      }

      const button = document.querySelector<HTMLButtonElement>(
        `button[data-judgment="${judgment}"]`,
      );
      if (!button || fired) return;
      fired = true;

      event.preventDefault();
      // .click() rather than form.requestSubmit(): the judgment travels as the
      // submitter button's name/value, so the action receives byte-identical
      // FormData whether the operator tapped or typed.
      button.click();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!live) return null;

  return (
    <p className="mt-3 text-[11px] font-medium text-[color:var(--slate)]">
      Keyboard: <Key>1</Key> strong fit · <Key>2</Key> maybe · <Key>3</Key> not a fit. Ignored while
      the cursor is in a field. Got one wrong? Undo below.
    </p>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded-md border border-[color:var(--mist)] bg-[color:var(--champagne)] px-1.5 py-0.5 font-display text-[10px] font-semibold text-[color:var(--ink)]">
      {children}
    </kbd>
  );
}
