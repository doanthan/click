"use client";

/**
 * Client-only Design System primitives.
 *
 * Why a second file: ds.tsx is hook-free on purpose so Server Components can
 * import it directly (23 pages under src/app do). Adding "use client" there
 * would drag every one of those consumers across the client boundary, so
 * anything that needs a hook lives HERE instead. Same DS, same components -
 * only the boundary differs. Import Button/Tag/Badge/Icon from "@/components/ds";
 * import SubmitButton from "@/components/ds-client".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./ds";

/**
 * A submit whose busy state comes from the form it sits in.
 *
 * For the bare `<form action={serverAction}>` submits that live inside Server
 * Components: useFormStatus reports the parent form's pending state, which we
 * hand straight to Button's existing `loading` prop (it already sets aria-busy
 * and swaps in the .ck-btn__spinner - this is a wiring wrapper, not a second
 * button).
 *
 * MUST be rendered inside the <form> whose status it reads; useFormStatus only
 * sees an ancestor form, never a sibling.
 *
 * With JS disabled useFormStatus never reports pending and this renders as a
 * plain, fully working submit - these are real server-action forms, so the post
 * still happens.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  full,
  ...rest
}: {
  children: ReactNode;
  /** Shown in place of `children` while the form is in flight. */
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
} & Omit<ComponentProps<"button">, "children" | "type">) {
  const { pending } = useFormStatus();

  return (
    <Button {...rest} type="submit" variant={variant} size={size} full={full} loading={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/**
 * The "Saved ✓" flash - one implementation for the whole app.
 *
 * The idiom (set a status, start a timer, wipe it a few seconds later) had been
 * hand-rolled three times: avatar-uploader.tsx, profile-gallery-uploader.tsx and
 * account-setting-toggle.tsx. Two of the three leaked their timer on unmount,
 * which is a setState-after-teardown warning waiting for a user who navigates
 * away inside the window.
 *
 * The two invariants it exists to hold:
 *  - ONE timer, always cancelled before a new one starts, so a second save
 *    inside the window RESTARTS the flash rather than stacking a second
 *    callback that would clear it early.
 *  - the timer is cancelled on unmount, so nothing ever setStates after the
 *    component is gone.
 *
 * Generic over the status string so a call site with more than one outcome can
 * keep a single state variable:
 *
 *   const { flashed, flash, hold, reset } = useSavedFlash<"saved" | "failed">();
 *   flash("saved");    // shows, then clears itself after `ms`
 *   hold("failed");    // shows and STAYS - a failure is not a flash, the user
 *                      // has to be able to read it and act on it
 *   reset();           // clear now, e.g. when the next attempt starts
 *
 * The plain boolean case is just the default parameter: `useSavedFlash()` gives
 * `flash("saved")` and `flashed === "saved"`.
 *
 * A validation failure must never be indistinguishable from success, which is
 * why `hold` is here and why a failure must never be passed to `flash`.
 */
export function useSavedFlash<T extends string = "saved">(ms = 3000): {
  /** The current status, or null when nothing is showing. */
  flashed: T | null;
  /** Show `value`, then clear it after `ms`. Safe to call repeatedly. */
  flash: (value: T) => void;
  /** Show `value` with no timer - for outcomes the user must be able to read. */
  hold: (value: T) => void;
  /** Clear immediately and cancel any pending timer. */
  reset: () => void;
} {
  const [flashed, setFlashed] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Cleanup only - `stop` is stable, so this runs on unmount and never between.
  useEffect(() => stop, [stop]);

  const flash = useCallback(
    (value: T) => {
      stop();
      setFlashed(value);
      timer.current = setTimeout(() => {
        timer.current = null;
        setFlashed(null);
      }, ms);
    },
    [ms, stop],
  );

  const hold = useCallback(
    (value: T) => {
      stop();
      setFlashed(value);
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    setFlashed(null);
  }, [stop]);

  return { flashed, flash, hold, reset };
}
