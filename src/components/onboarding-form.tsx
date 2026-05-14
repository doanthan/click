"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { interestTagCategories } from "@/lib/click-data";

type Intent = "dating" | "friendship" | "networking" | "exploring";

const intentOptions: Array<{ value: Intent; label: string; body: string }> = [
  { value: "friendship", label: "Friendship", body: "Low-pressure plans to make new friends." },
  { value: "dating", label: "Dating", body: "Slow dating tables and relationship-minded events." },
  { value: "networking", label: "Networking", body: "Career switchers, founders, and peer support." },
  { value: "exploring", label: "Exploring", body: "Just curious — show me a bit of everything." },
];

type SubmitState = "idle" | "submitting" | "error";

type OnboardingFormProps = {
  initialName: string;
  initialSuburb: string;
  initialBio: string;
  initialIntents: Intent[];
};

export function OnboardingForm({
  initialName,
  initialSuburb,
  initialBio,
  initialIntents,
}: OnboardingFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName);
  const [suburb, setSuburb] = useState(initialSuburb || "Sydney");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState(initialBio);
  const [intents, setIntents] = useState<Set<Intent>>(
    new Set(initialIntents.length ? initialIntents : ["friendship"]),
  );
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  function toggleIntent(intent: Intent) {
    setIntents((current) => {
      const next = new Set(current);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      if (next.size === 0) next.add("friendship");
      return next;
    });
  }

  function toggleTag(tag: string) {
    setTags((current) => {
      const next = new Set(current);
      const key = tag.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        suburb,
        age,
        bio,
        intents: Array.from(intents),
        tags: Array.from(tags),
      }),
    });

    if (response.status === 401) {
      window.location.href = "/login?callbackUrl=/onboarding";
      return;
    }

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not save your profile.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm">
      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 1 · About you
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-tight">
          What should we call you?
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          Display name
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
            placeholder="Jordan Lee"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Suburb in Sydney
          <input
            required
            value={suburb}
            onChange={(event) => setSuburb(event.target.value)}
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
            placeholder="Marrickville"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Age (optional)
          <input
            type="number"
            min={18}
            max={120}
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
            placeholder="28"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold md:col-span-2">
          Tell us about what you want
          <textarea
            required
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="min-h-24 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
            placeholder="I want low-pressure ways to make friends after work."
          />
        </label>
      </div>

      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 2 · Why are you here
        </p>
        <h3 className="font-display mt-2 text-2xl font-light leading-tight">
          Pick one or more.
        </h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {intentOptions.map((intent) => {
            const checked = intents.has(intent.value);
            return (
              <button
                key={intent.value}
                type="button"
                onClick={() => toggleIntent(intent.value)}
                className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                  checked
                    ? "border-[color:var(--rose)] bg-[color:var(--peach)]"
                    : "border-[color:var(--line)] bg-[color:var(--cream)] hover:bg-[color:var(--champagne)]"
                }`}
              >
                <span className="block text-sm font-bold">{intent.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-[color:var(--mauve)]">
                  {intent.body}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 3 · Pick interest tags
        </p>
        <h3 className="font-display mt-2 text-2xl font-light leading-tight">
          Pick anything that fits. Skip what doesn&apos;t.
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {interestTagCategories.map(([category, ...tagList]) => (
            <div
              key={category}
              className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4"
            >
              <p className="text-sm font-bold">{category}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tagList.map((tag) => {
                  const selected = tags.has(tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border-2 px-3 py-1 text-xs font-bold ${
                        selected
                          ? "border-[color:var(--rose)] bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                          : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-fit rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "submitting" ? "Saving..." : "Save and continue to dashboard"}
      </button>
    </form>
  );
}
