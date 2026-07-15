"use client";

import { useState, useTransition } from "react";
import { setAccountSetting } from "@/app/account-settings/actions";
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
 */
export function SettingRow({
  label,
  description,
  on,
  onToggle,
  disabled,
  note,
}: {
  label: string;
  description?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  note?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      disabled={disabled}
      className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-[12px] px-3 py-3 text-left transition-colors hover:bg-[color:var(--lavender-100)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)] disabled:opacity-70"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-[color:var(--ink)]">
          {label}
          {note}
        </span>
        {description ? (
          <span className="mt-0.5 block max-w-[460px] text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="mt-0.5">
        <Switch on={on} />
      </span>
    </button>
  );
}

// A persisted on/off switch for the Notifications + Privacy sections. Optimistic:
// flips immediately, writes through the server action, and reverts if the write
// fails so the UI never lies about what's stored.
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
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(false);
    startTransition(async () => {
      try {
        await setAccountSetting(settingKey, next);
      } catch {
        setOn(!next);
        setError(true);
      }
    });
  }

  return (
    <SettingRow
      label={label}
      description={description}
      on={on}
      onToggle={toggle}
      disabled={pending}
      note={
        error ? (
          <span className="ml-2 text-[12px] font-medium text-[color:var(--danger)]">
            Didn&apos;t save - give it another go
          </span>
        ) : null
      }
    />
  );
}
