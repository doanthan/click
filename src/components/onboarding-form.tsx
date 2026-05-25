"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { interestTagCategories } from "@/lib/click-data";
import { REGISTER_PREFILL_KEY, type RegisterPrefill } from "@/components/register-form";

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
  // Computed once per mount: max DOB that still satisfies the 18+ floor.
  const [maxBirthDate] = useState(() =>
    new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  );
  const [displayName, setDisplayName] = useState(initialName);
  const [suburb, setSuburb] = useState(initialSuburb || "Sydney");
  const [age, setAge] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [datingVisible, setDatingVisible] = useState(true);
  const [flexibleDiscovery, setFlexibleDiscovery] = useState(true);
  const [bio, setBio] = useState(initialBio);
  const [intents, setIntents] = useState<Set<Intent>>(
    new Set(initialIntents.length ? initialIntents : ["friendship"]),
  );
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(REGISTER_PREFILL_KEY);
      if (!raw) return;
      const prefill = JSON.parse(raw) as RegisterPrefill;
      if (prefill.displayName) setDisplayName(prefill.displayName);
      if (prefill.intent) setIntents(new Set([prefill.intent]));
      if (typeof prefill.latitude === "number" && typeof prefill.longitude === "number") {
        setCoords({ latitude: prefill.latitude, longitude: prefill.longitude });
      }
      window.sessionStorage.removeItem(REGISTER_PREFILL_KEY);
    } catch {
      // sessionStorage / parse can fail in private mode — ignore.
    }
  }, []);

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
        birthDate: birthDate || undefined,
        datingVisible,
        flexibleDiscovery,
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
          Birth date
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            max={maxBirthDate}
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          />
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            18+ only. We compute age from this and never show your full DOB.
          </span>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          Age (optional override)
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
        {coords ? (
          <div className="md:col-span-2 rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-sm font-semibold text-[color:var(--mauve)]">
            <span className="font-mono mr-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
              Location ✓
            </span>
            Using {coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)} to
            sort events near you.
          </div>
        ) : null}
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
          Step 2 · Discovery preferences
        </p>
        <h3 className="font-display mt-2 text-2xl font-light leading-tight">
          Who can see you, what we surface.
        </h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-sm font-bold text-[color:var(--ink)]">
            <span>
              Dating visibility
              <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--mauve)]">
                Allow dating-intent users to see you on profiles and Click Radar.
              </span>
            </span>
            <input
              type="checkbox"
              checked={datingVisible}
              onChange={(e) => setDatingVisible(e.target.checked)}
              className="size-5 accent-[color:var(--rose)]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-sm font-bold text-[color:var(--ink)]">
            <span>
              Flexible discovery
              <span className="mt-1 block text-xs font-medium leading-5 text-[color:var(--mauve)]">
                Show me cross-intent events (e.g. friendship-tagged events even if my main intent is dating).
              </span>
            </span>
            <input
              type="checkbox"
              checked={flexibleDiscovery}
              onChange={(e) => setFlexibleDiscovery(e.target.checked)}
              className="size-5 accent-[color:var(--rose)]"
            />
          </label>
        </div>
      </div>

      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 3 · Why are you here
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
          Step 4 · Pick interest tags
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
