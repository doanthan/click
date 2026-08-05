"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ANON_SCOPE, scopedKey, useAccountScope } from "@/lib/account-scope";

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
 *
 * Every key is namespaced to the signed-in account (see lib/account-scope), so
 * switching accounts in one browser can never hand the next person the last
 * one's answers. The one crossing that IS wanted - a draft started while logged
 * out, then carried through sign-in - is handled by the adoption step in the
 * read effect below.
 */

type Stored<T> = { v: number; values: T };

export function useFormDraft<T>({
  key: rawKey,
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

  const scope = useAccountScope();
  const key = scopedKey(scope, rawKey);

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

  /* The form's values as it FIRST rendered, serialised. Nothing is written to
     storage while the values still match this, which fixes a draft the user
     never made: on mount the read effect finds nothing, flips `hydrated`, and
     the write effect below used to persist the untouched defaults immediately.
     The next mount then read those defaults straight back and announced
     "picked up where you left off - the answers you had already typed are
     still here" to someone who had typed nothing. Reproducible on every form
     using this hook: open it, reload, read the note.

     Empty string is the "cannot compare" sentinel - a real serialised payload
     is never "", so the guard simply never fires and we fall back to the old
     always-write behaviour rather than losing drafting altogether. */
  const [pristine] = useState(() => {
    try {
      return JSON.stringify({ v: version, values } satisfies Stored<T>);
    } catch {
      return "";
    }
  });

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
      const read = (from: string): T | null => {
        const raw = store.getItem(from);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<Stored<T>>;
        if (parsed && parsed.v === version && parsed.values !== undefined) {
          return parsed.values as T;
        }
        // A draft written against an older shape. Dropping it beats applying
        // half of it into a form whose fields have since moved.
        store.removeItem(from);
        return null;
      };

      saved = read(key);

      // Adoption. A draft started while logged OUT belongs to whoever signs in
      // next: the homepage quiz teaser collects four answers and then sends the
      // visitor to log in, and dropping them at that door is the exact inverse
      // of the endowed progress the teaser just sold. Moving it under the
      // account's own key also means it is adopted once, not shared onward with
      // the next person to use the browser.
      if (saved === null && scope !== ANON_SCOPE) {
        const anonKey = scopedKey(ANON_SCOPE, rawKey);
        saved = read(anonKey);
        if (saved !== null) {
          store.setItem(key, JSON.stringify({ v: version, values: saved } satisfies Stored<T>));
          store.removeItem(anonKey);
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
  }, [key, rawKey, scope, version, pick]);

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

    // Still pristine - the user has not touched anything, so there is no draft
    // to save. `restored` exempts a draft we just applied: those values came
    // from storage, not from the defaults, and must keep being written through.
    if (!restored && pristine === serialised) return;

    try {
      pick().setItem(key, serialised);
    } catch {
      // Quota or private mode - non-fatal. The in-memory form still works, the
      // user just loses the reload safety net.
    }
  }, [hydrated, restored, pristine, key, version, values, pick]);

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
