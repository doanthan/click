"use client";

import { useId, useRef, useState, useTransition } from "react";
import { setAccountSetting } from "@/app/account-settings/actions";
import { Icon } from "@/components/ds";
import { useSavedFlash } from "@/components/ds-client";
import type { AccountSettingKey } from "@/lib/event-repository";

/**
 * Switch - the DS on/off control. Deep Purple when on; the fill IS the signal,
 * so there's no "On/Off" label pill beside it. Purely visual: the caller owns
 * the button semantics (role="switch" + aria-checked) and the state.
 */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block h-[26px] w-[46px] shrink-0 rounded-full transition-colors ${
        on ? "bg-[color:var(--purple)]" : "bg-[color:var(--mist)]"
      }`}
    >
      <span
        className={`absolute top-[3px] size-5 rounded-full bg-[color:var(--paper)] shadow-[var(--shadow-xs)] transition-all ${
          on ? "left-[23px]" : "left-[3px]"
        }`}
      />
    </span>
  );
}

/**
 * SettingRow - title + helper line on the left, the Switch on the right. Rows
 * are grouped by whitespace on the page ground, never boxed into their own
 * cards (no cards-inside-cards).
 *
 * Two accessibility details worth keeping:
 *
 * - aria-labelledby points at the TITLE only. Without it the row's accessible
 *   name is title + the whole helper paragraph, so every switch announced as an
 *   essay; the helper is now a description instead.
 * - `note` renders in a polite live region OUTSIDE the control. Folded inside
 *   the button it was part of the accessible name, which means a screen-reader
 *   user only ever heard "didn't save" by re-focusing the switch - exactly the
 *   moment they are least likely to.
 */
export function SettingRow({
  label,
  description,
  on,
  onToggle,
  busy,
  note,
}: {
  label: string;
  description?: string;
  on: boolean;
  onToggle: () => void;
  /**
   * In-flight marker. Deliberately NOT `disabled`: browsers blur an element the
   * moment it goes disabled, so disabling a focused row mid-write dumps a
   * keyboard user back to the top of the document part-way down a list of
   * switches - and it blocks the natural "oops, flip it back" correction for
   * the length of the round-trip. aria-busy says the same thing to assistive
   * tech without stealing focus or interaction.
   */
  busy?: boolean;
  note?: React.ReactNode;
}) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-busy={busy || undefined}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-[12px] px-3 py-3 text-left transition-colors hover:bg-[color:var(--lavender-100)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]"
      >
        <span className="min-w-0 flex-1">
          <span id={labelId} className="block text-[14.5px] font-semibold text-[color:var(--ink)]">
            {label}
          </span>
          {description ? (
            <span
              id={descId}
              className="mt-0.5 block max-w-[460px] text-[12.5px] leading-[1.5] text-[color:var(--slate)]"
            >
              {description}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5">
          <Switch on={on} />
        </span>
      </button>
      {/* Rendered unconditionally: an empty <p> generates no line box, so it
          costs no height, and a live region has to already be in the DOM when
          its content changes or the announcement is usually dropped. */}
      <p aria-live="polite" className="px-3 text-[12px] font-medium">
        {note}
      </p>
    </div>
  );
}

/**
 * A persisted on/off switch for the Notifications + Privacy sections.
 *
 * Optimistic on purpose: setAccountSetting deliberately skips revalidatePath,
 * so a toggle costs one fetch and no re-render. The flip is INTENT feedback
 * though, not save feedback - a dead server and a healthy one looked identical
 * until the write came back - so the settled response also flashes "Saved" for
 * 3s and, on failure, reverts and says so.
 */
export function AccountSettingToggle({
  settingKey,
  label,
  description,
  initialOn,
}: {
  settingKey: AccountSettingKey;
  label: string;
  description?: string;
  initialOn: boolean;
}) {
  const [on, setOn] = useState(initialOn);
  // The shared flash, not a local timer: it owns the one-timer-cancelled-on-
  // unmount invariant, and `hold` is the reason a failure is not on a timer -
  // "didn't save" has to stay on screen long enough to read and act on.
  const { flashed, flash, hold, reset } = useSavedFlash<"saved" | "failed">();
  const [pending, startTransition] = useTransition();
  // Every tap takes a ticket and only the newest one is allowed to write the
  // UI. Without this, two quick taps whose responses land out of order leave
  // the knob showing a value the server has already overwritten.
  const ticketRef = useRef(0);

  function toggle() {
    const next = !on;
    const ticket = ++ticketRef.current;
    setOn(next);
    reset();
    startTransition(async () => {
      try {
        const stored = await setAccountSetting(settingKey, next);
        if (ticket !== ticketRef.current) return;
        // Settle on what the server actually stored, not on what we guessed.
        setOn(stored.value);
        flash("saved");
      } catch {
        if (ticket !== ticketRef.current) return;
        setOn(!next);
        hold("failed");
      }
    });
  }

  return (
    <SettingRow
      label={label}
      description={description}
      on={on}
      onToggle={toggle}
      busy={pending}
      note={
        flashed === "failed" ? (
          <span className="text-[color:var(--danger)]">
            Didn&apos;t save - give it another go
          </span>
        ) : flashed === "saved" ? (
          <span className="inline-flex items-center gap-1 text-[color:var(--sage)]">
            <Icon name="check" size={13} stroke={2.6} />
            Saved
          </span>
        ) : null
      }
    />
  );
}
