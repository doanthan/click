"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { harnessAction, type HarnessResult } from "./actions";

const IDLE: HarnessResult = { ok: true, message: "" };

/**
 * One button, one form, one result line under it.
 *
 * Each control owns its own `useActionState` rather than sharing a single result
 * banner, and that is the point of a driver: when a step refuses, the refusal has
 * to be attached to the step that caused it. A shared banner puts "That event is
 * wrapped up now" underneath whichever button was pressed last, which is exactly
 * the ambiguity this page exists to remove.
 */
export function HarnessButton({
  label,
  fields,
  tone = "default",
  hint,
  disabled,
  disabledReason,
}: {
  label: string;
  fields: Record<string, string>;
  tone?: "default" | "primary" | "danger";
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState(harnessAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton
        label={label}
        tone={tone}
        disabled={disabled}
        disabledReason={disabledReason}
      />
      {hint ? (
        <span className="text-[0.68rem] leading-snug text-[color:var(--slate)]">{hint}</span>
      ) : null}
      {state.message ? (
        <span
          className={`text-[0.68rem] font-semibold leading-snug ${
            state.ok ? "text-[color:var(--sage-ink)]" : "text-[color:var(--danger)]"
          }`}
        >
          {state.ok ? "✓ " : "✕ "}
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function SubmitButton({
  label,
  tone,
  disabled,
  disabledReason,
}: {
  label: string;
  tone: "default" | "primary" | "danger";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { pending } = useFormStatus();
  const base =
    "w-full rounded-[12px] border px-3 py-2 text-left text-[0.78rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45";
  const tones = {
    // Deep Purple is the only primary-action colour, flat - never a gradient.
    primary:
      "border-transparent bg-[color:var(--purple)] text-white hover:bg-[color:var(--purple-hover)]",
    default:
      "border-[color:var(--mist-strong)] bg-white text-[color:var(--ink)] hover:border-[color:var(--purple)]",
    danger:
      "border-[color:var(--danger)] bg-white text-[color:var(--danger)] hover:bg-[color:var(--danger)] hover:text-white",
  } as const;
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={disabled ? disabledReason : undefined}
      className={`${base} ${tones[tone]}`}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
