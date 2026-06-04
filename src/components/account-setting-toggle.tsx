"use client";

import { useState, useTransition } from "react";
import { Pill } from "./click-ui";
import { setAccountSetting } from "@/app/account-settings/actions";
import type { AccountSettingKey } from "@/lib/event-repository";

// A persisted on/off switch for the Notifications + Privacy tabs. Optimistic:
// flips immediately, writes through the server action, and reverts if the write
// fails so the UI never lies about what's stored.
export function AccountSettingToggle({
  settingKey,
  label,
  initialOn,
}: {
  settingKey: AccountSettingKey;
  label: string;
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
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={pending}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-left hard-shadow-sm transition disabled:opacity-70"
    >
      <span className="text-sm font-bold text-[color:var(--ink)]">
        {label}
        {error ? (
          <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-wide text-[color:var(--rose)]">
            couldn’t save — try again
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-2">
        <Pill tone={on ? "peach" : "cream"}>{on ? "On" : "Off"}</Pill>
        <span
          aria-hidden
          className={`relative h-5 w-9 shrink-0 rounded-full border-2 border-[color:var(--line)] transition-colors ${
            on ? "bg-[color:var(--rose)]" : "bg-[color:var(--champagne-deep)]"
          }`}
        >
          <span
            className={`absolute top-[1px] size-[14px] rounded-full bg-[color:var(--champagne)] transition-all ${
              on ? "left-[16px]" : "left-[1px]"
            }`}
          />
        </span>
      </span>
    </button>
  );
}
