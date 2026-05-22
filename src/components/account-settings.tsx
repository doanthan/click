"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Intent = "dating" | "friendship" | "networking" | "exploring";

const intentOptions: Array<{ value: Intent; label: string }> = [
  { value: "friendship", label: "Friendship" },
  { value: "dating", label: "Dating" },
  { value: "networking", label: "Networking" },
  { value: "exploring", label: "Exploring" },
];

type Props = {
  initialName: string;
  initialSuburb: string;
  initialBio: string;
  initialAge: string;
  initialIntents: Intent[];
};

export function AccountForm({
  initialName,
  initialSuburb,
  initialBio,
  initialAge,
  initialIntents,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [suburb, setSuburb] = useState(initialSuburb);
  const [age, setAge] = useState(initialAge);
  const [bio, setBio] = useState(initialBio);
  const [intents, setIntents] = useState<Set<Intent>>(new Set(initialIntents));
  const [pending, setPending] = useState(false);

  function toggleIntent(intent: Intent) {
    setIntents((current) => {
      const next = new Set(current);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      if (next.size === 0) next.add("friendship");
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          suburb,
          age,
          bio,
          intents: Array.from(intents),
          tags: [],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Couldn't save your account.");
        return;
      }

      toast.success("Account updated.");
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Display name">
        <input
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Suburb">
        <input
          required
          value={suburb}
          onChange={(event) => setSuburb(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Age (optional)">
        <input
          type="number"
          min={18}
          max={120}
          value={age}
          onChange={(event) => setAge(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Bio">
        <textarea
          required
          rows={4}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className={`${inputClass} resize-none`}
        />
      </Field>
      <Field label="Intents">
        <div className="flex flex-wrap gap-2">
          {intentOptions.map((option) => {
            const active = intents.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleIntent(option.value)}
                className={
                  active
                    ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--champagne)]"
                    : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)] hard-shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--rose)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

type PrefBlock = {
  storageKey: string;
  options: Array<{ key: string; label: string; body: string; defaultValue?: boolean }>;
};

export function PreferenceToggles({ storageKey, options }: PrefBlock) {
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    options.forEach((option) => {
      next[option.key] = option.defaultValue ?? true;
    });
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) Object.assign(next, JSON.parse(raw));
      } catch {}
    }
    return next;
  });

  function toggle(key: string) {
    setValues((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      toast.success("Preference saved.");
      return next;
    });
  }

  return (
    <ul className="space-y-3">
      {options.map((option) => {
        const active = values[option.key];
        return (
          <li
            key={option.key}
            className="flex items-start justify-between gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
          >
            <div>
              <p className="font-bold text-[color:var(--ink)]">{option.label}</p>
              <p className="mt-1 text-sm font-medium text-[color:var(--mauve)]">
                {option.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(option.key)}
              aria-pressed={active}
              className={
                active
                  ? "relative h-7 w-12 shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)]"
                  : "relative h-7 w-12 shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)]"
              }
            >
              <span
                className={
                  active
                    ? "absolute left-[1.4rem] top-[0.15rem] block h-4 w-4 rounded-full bg-[color:var(--peach)]"
                    : "absolute left-[0.15rem] top-[0.15rem] block h-4 w-4 rounded-full bg-[color:var(--mauve)]"
                }
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
