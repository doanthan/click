"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Versioned client-side draft persistence for long forms.
 *
 * THE RULE THIS HOOK EXISTS TO ENFORCE: the saved draft is read inside an
 * effect, never in a useState initializer. Browser storage does not exist on
 * the server, so lazy-initialising state from it makes the server render and
 * the first client render disagree - React throws a hydration mismatch. The
 * one extra render an effect costs is the lesser evil. That reasoning is the
 * same one documented at event-create-wizard.tsx:345.
 *
 * The read is also rAF-gated, which is load-bearing rather than cosmetic: it
 * pushes the apply() past the commit of the server-matched first paint, so the
 * restored values land as a change to an already-hydrated tree instead of
 * racing it.
 *
 * Persistence is gated on `hydrated` for the mirror-image reason - writing
 * before the read lands would clobber the saved draft with the defaults.
 */

type Stored<T> = { v: number; values: T };

export function useFormDraft<T>({
  key,
  version,
  storage = "session",
  values,
  apply,
}: {
  /** Storage key. Namespace it per form, e.g. "click:event-create:v1". */
  key: string;
  /** Bump whenever the shape of `values` changes; older drafts are dropped. */
  version: number;
  /** "session" survives a reload, "local" survives closing the tab. */
  storage?: "session" | "local";
  /** The current form values, written through on every change. */
  values: T;
  /** Called once, with the saved values, if a draft of this version existed. */
  apply: (saved: T) => void;
}): { hydrated: boolean; restored: boolean; clear: () => void } {
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);

  // `apply` is almost always an inline closure, so it changes identity every
  // render. Keeping the latest in a ref lets the rehydrate effect stay
  // mount-scoped - if it re-ran it would re-apply the draft over live edits.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  /* What the form looked like at the moment clear() ran, serialised. null means
     "not in a just-cleared window".

     This used to be a plain boolean latch, and the latch never lifted: after the
     FIRST successful save the hook stopped writing for the rest of the page
     mount, so every later edit on a long-lived form - the merchant event editor,
     the profile form, a wizard the user keeps working in after saving once - was
     silently unprotected for the remainder of the session. A reload lost it all,
     which is the exact failure this hook exists to prevent.

     Holding the values instead of a boolean keeps the half of the invariant that
     mattered while dropping the half that didn't. Still guaranteed: the
     re-renders that FOLLOW a save - a step flipping to "done", a saved-signature
     landing, a flash timer firing - all leave `values` identical to this
     snapshot, so none of them can rewrite the draft clear() just removed.
     Now also true: the moment the user actually edits something, `values`
     diverges, the window closes and drafting resumes. */
  const clearedAtRef = useRef<string | null>(null);

  const pick = useCallback(
    () => (storage === "local" ? window.localStorage : window.sessionStorage),
    [storage],
  );

  /* Effect-driven setState is the point of this hook, not an accident - see the
     hydration note above. It sits inside the rAF callback rather than the effect
     body, which is also why the set-state-in-effect lint never fires here. */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let saved: T | null = null;
    try {
      const store = pick();
      const raw = store.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Stored<T>>;
        if (parsed && parsed.v === version && parsed.values !== undefined) {
          saved = parsed.values as T;
        } else {
          // A draft written against an older shape. Dropping it beats applying
          // half of it into a form whose fields have since moved.
          store.removeItem(key);
        }
      }
    } catch {
      // Malformed JSON, or storage blocked (private mode, quota, iframe) -
      // fall back to the defaults the form already rendered.
    }

    const frame = window.requestAnimationFrame(() => {
      if (saved !== null) {
        applyRef.current(saved);
        setRestored(true);
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key, version, pick]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    let serialised: string;
    try {
      const payload: Stored<T> = { v: version, values };
      serialised = JSON.stringify(payload);
    } catch {
      // A cyclic or non-serialisable value - there is no draft to write.
      return;
    }

    // Inside a just-cleared window we write nothing until the values genuinely
    // change. Comparing the serialised form, not the reference, is what makes
    // that work at all: `values` is an object literal rebuilt every render, so
    // reference equality would report "changed" on the very next render and
    // immediately resurrect the draft clear() had just removed.
    if (clearedAtRef.current !== null) {
      if (clearedAtRef.current === serialised) return;
      clearedAtRef.current = null;
    }

    try {
      pick().setItem(key, serialised);
    } catch {
      // Quota or private mode - non-fatal. The in-memory form still works, the
      // user just loses the reload safety net.
    }
  }, [hydrated, key, version, values, pick]);

  /* Kept in a ref so `clear` stays referentially stable: call sites hold it
     across renders and some list it in their own effect deps. A ref read is
     also what lets clear() snapshot the values as they are AT THE CALL, which
     is the state the guard above has to recognise. */
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  });

  /** Call this ONLY on the success branch - never before the write lands. */
  const clear = useCallback(() => {
    // Snapshot first: the guard needs to recognise the post-save re-renders that
    // are about to arrive with these same values. If serialising throws there is
    // nothing meaningful to compare against, so fall back to blocking nothing -
    // the removeItem below still happens, which is the part that matters.
    try {
      clearedAtRef.current = JSON.stringify({ v: version, values: valuesRef.current } satisfies Stored<T>);
    } catch {
      clearedAtRef.current = null;
    }
    if (typeof window === "undefined") return;
    try {
      pick().removeItem(key);
    } catch {
      // Nothing to do - a draft we cannot remove is still harmless.
    }
  }, [key, version, pick]);

  return { hydrated, restored, clear };
}
