"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { categories } from "@/lib/click-data";
import { MapboxAutocomplete, type MapboxPlace } from "./mapbox-autocomplete";

type WizardValues = {
  title: string;
  groupName: string;
  category: string;
  startsAt: string;
  capacity: string;
  locationName: string;
  suburb: string;
  // Captured from the Mapbox address autocomplete in step 3 and serialized
  // alongside the rest of the form on submit.
  latitude: number | null;
  longitude: number | null;
  price: string;
  tags: string;
  relationshipGoal: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
};

const STEPS = [
  { key: "basics", label: "Basics" },
  { key: "schedule", label: "Schedule" },
  { key: "location", label: "Location" },
  { key: "media", label: "Media" },
  { key: "review", label: "Review" },
] as const;

const initial: WizardValues = {
  title: "",
  groupName: "",
  category: "Food",
  startsAt: "",
  capacity: "12",
  locationName: "",
  suburb: "",
  latitude: null,
  longitude: null,
  price: "Free",
  tags: "",
  relationshipGoal: "",
  description: "",
  imageUrl: "",
  imageAlt: "",
};

function validateStep(step: number, v: WizardValues): string | null {
  if (step === 0) {
    if (!v.title.trim()) return "Event title is required.";
    if (!v.groupName.trim()) return "Group / host name is required.";
    if (!v.description.trim()) return "Description is required.";
    if (!v.relationshipGoal.trim())
      return "Tell people why they should come (relationship goal).";
  }
  if (step === 1) {
    if (!v.startsAt) return "Pick a start date and time.";
    const start = new Date(v.startsAt);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return "Start time must be in the future.";
    }
    const capacity = Number.parseInt(v.capacity, 10);
    if (!Number.isFinite(capacity) || capacity < 1) {
      return "Capacity must be a positive number.";
    }
  }
  if (step === 2) {
    if (!v.locationName.trim()) return "Venue name is required.";
    if (!v.suburb.trim()) return "Suburb is required.";
  }
  if (step === 3) {
    if (v.imageUrl && !/^https?:\/\//i.test(v.imageUrl)) {
      return "Image URL must start with http:// or https://.";
    }
  }
  return null;
}

function formatDateTime(value: string) {
  if (!value) return "Pick a date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function EventCreateWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(initial);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tagsPreview = useMemo(
    () =>
      values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6),
    [values.tags],
  );

  function set<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function next() {
    const err = validateStep(step, values);
    if (err) {
      setStepError(err);
      toast.error(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function prev() {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setSubmitting(true);
    setStepError(null);
    try {
      const form = new FormData();
      form.set("title", values.title);
      form.set("groupName", values.groupName);
      form.set("category", values.category);
      form.set("startsAt", values.startsAt);
      form.set("capacity", values.capacity);
      form.set("locationName", values.locationName);
      form.set("suburb", values.suburb);
      if (values.latitude !== null && values.longitude !== null) {
        form.set("latitude", String(values.latitude));
        form.set("longitude", String(values.longitude));
      }
      form.set("price", values.price);
      form.set("tags", values.tags);
      form.set("relationshipGoal", values.relationshipGoal);
      form.set("description", values.description);
      if (values.imageUrl) form.set("imageUrl", values.imageUrl);
      if (values.imageAlt) form.set("imageAlt", values.imageAlt);

      const response = await fetch("/api/events", { method: "POST", body: form });

      if (response.status === 401) {
        window.location.href = "/login?callbackUrl=/merchant/events/create";
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        event?: { title?: string };
        error?: string;
      };
      if (!response.ok) {
        const msg = payload.error ?? "Submission failed.";
        setStepError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`${payload.event?.title ?? "Event"} submitted for admin review.`);
      router.push("/merchant?tab=events");
      router.refresh();
    } catch {
      const msg = "Submission failed. Check your connection.";
      setStepError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
      <ol className="flex flex-wrap items-center gap-2 border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4">
        {STEPS.map((s, idx) => {
          const active = idx === step;
          const done = idx < step;
          return (
            <li
              key={s.key}
              className={`flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide hard-shadow-sm ${
                active
                  ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                  : done
                    ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--cream)] text-[color:var(--mauve)]"
              }`}
            >
              <span className="font-mono">{idx + 1}</span>
              {s.label}
              {done ? <span aria-hidden>✓</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="space-y-6 p-6">
        {step === 0 ? (
          <Step1Basics values={values} set={set} />
        ) : step === 1 ? (
          <Step2Schedule values={values} set={set} />
        ) : step === 2 ? (
          <Step3Location values={values} set={set} />
        ) : step === 3 ? (
          <Step4Media values={values} set={set} />
        ) : (
          <Step5Review values={values} formatDateTime={formatDateTime} tagsPreview={tagsPreview} />
        )}

        {stepError ? (
          <p className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]">
            {stepError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-[color:var(--mauve)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function inputClass() {
  return "rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]";
}

function Step1Basics({
  values,
  set,
}: {
  values: WizardValues;
  set: <K extends keyof WizardValues>(k: K, v: WizardValues[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 1 · Basics
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-tight">
          What is this event?
        </h2>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Event title">
          <input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Restaurant Meetup: Table for Eight"
            className={inputClass()}
            required
          />
        </Field>
        <Field label="Group / host name">
          <input
            value={values.groupName}
            onChange={(e) => set("groupName", e.target.value)}
            placeholder="Sydney Table Friends"
            className={inputClass()}
            required
          />
        </Field>
        <Field label="Category">
          <select
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            className={inputClass()}
          >
            {categories
              .filter((c) => c !== "All")
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </select>
        </Field>
        <Field label="Tags" hint="Comma-separated. Top 5 used for matching.">
          <input
            value={values.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="restaurant, dinner, food, low-pressure"
            className={inputClass()}
          />
        </Field>
      </div>
      <Field label="Why should people come? (relationship goal)">
        <input
          value={values.relationshipGoal}
          onChange={(e) => set("relationshipGoal", e.target.value)}
          placeholder="Make dinner feel like the easiest first plan with new people."
          className={inputClass()}
        />
      </Field>
      <Field label="Short description">
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          placeholder="A hosted restaurant table for people who want dinner plans without the awkward group-chat setup…"
          className={inputClass()}
        />
      </Field>
    </div>
  );
}

function Step2Schedule({
  values,
  set,
}: {
  values: WizardValues;
  set: <K extends keyof WizardValues>(k: K, v: WizardValues[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 2 · Schedule
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-tight">
          When + how many?
        </h2>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Start time">
          <input
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
            className={inputClass()}
            required
          />
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            min={1}
            value={values.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            className={inputClass()}
            required
          />
        </Field>
        <Field label="Price" hint="‘Free’ or like $38.">
          <input
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="Free"
            className={inputClass()}
          />
        </Field>
      </div>
    </div>
  );
}

function Step3Location({
  values,
  set,
}: {
  values: WizardValues;
  set: <K extends keyof WizardValues>(k: K, v: WizardValues[K]) => void;
}) {
  function handlePick(place: MapboxPlace) {
    set("locationName", place.name || place.address || values.locationName);
    if (place.suburb) set("suburb", place.suburb);
    set("latitude", place.lat);
    set("longitude", place.lng);
  }

  const pinned = values.latitude !== null && values.longitude !== null;

  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 3 · Location
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-tight">
          Where in Sydney?
        </h2>
        <p className="mt-1 text-sm font-bold text-[color:var(--mauve)]">
          Search a venue or street address — we&apos;ll fill the fields below
          and pin it on the map.
        </p>
      </header>

      <Field
        label="Find venue or address"
        hint="Powered by Mapbox. Bias is Australia; pick a suggestion to capture exact coordinates."
      >
        <MapboxAutocomplete
          value={values.locationName}
          onValueChange={(v) => set("locationName", v)}
          onSelect={handlePick}
          placeholder="e.g. Bar Lucia, Potts Point"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Venue name">
          <input
            value={values.locationName}
            onChange={(e) => set("locationName", e.target.value)}
            placeholder="Bar Lucia"
            className={inputClass()}
            required
          />
        </Field>
        <Field label="Suburb">
          <input
            value={values.suburb}
            onChange={(e) => set("suburb", e.target.value)}
            placeholder="Potts Point"
            className={inputClass()}
            required
          />
        </Field>
      </div>

      <p
        className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${
          pinned ? "text-[color:var(--rose)]" : "text-[color:var(--mauve)]/70"
        }`}
      >
        {pinned
          ? `Pinned at ${values.latitude!.toFixed(5)}, ${values.longitude!.toFixed(5)}`
          : "No coordinates yet — picking a suggestion will pin this on the map."}
      </p>
    </div>
  );
}

function Step4Media({
  values,
  set,
}: {
  values: WizardValues;
  set: <K extends keyof WizardValues>(k: K, v: WizardValues[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 4 · Media
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-tight">
          One real photo helps a lot.
        </h2>
      </header>
      <Field label="Image URL (optional)" hint="Use a real photo of the room or food. A placeholder is used if you skip.">
        <input
          type="url"
          value={values.imageUrl}
          onChange={(e) => set("imageUrl", e.target.value)}
          placeholder="https://images.example.com/your-event.jpg"
          className={inputClass()}
        />
      </Field>
      <Field label="Image alt text" hint="One sentence for screen readers.">
        <input
          value={values.imageAlt}
          onChange={(e) => set("imageAlt", e.target.value)}
          placeholder="A long table set for dinner with candles."
          className={inputClass()}
        />
      </Field>
      {values.imageUrl ? (
        <div className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
          <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Preview
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={values.imageUrl}
            alt={values.imageAlt || "Event"}
            className="mt-3 max-h-64 w-full rounded-xl border-2 border-[color:var(--line)] object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}

function Step5Review({
  values,
  formatDateTime,
  tagsPreview,
}: {
  values: WizardValues;
  formatDateTime: (s: string) => string;
  tagsPreview: string[];
}) {
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Step 5 · Review
        </p>
        <h2 className="font-display mt-2 text-3xl font-light leading-tight">
          Looks good?
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Submissions go to admin for approval before going live.
        </p>
      </header>
      <article className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
        <h3 className="font-display text-3xl font-light leading-tight">
          {values.title || "Untitled event"}
        </h3>
        <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          {values.groupName || "—"} · {values.category}
        </p>
        <p className="mt-3 text-sm font-bold text-[color:var(--ink)]">
          {formatDateTime(values.startsAt)} · {values.locationName || "—"},{" "}
          {values.suburb || "—"}
        </p>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          {values.description || "Add a description on the basics step."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)]">
            {values.capacity || "?"} seats
          </span>
          <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)]">
            {values.price || "Free"}
          </span>
          {tagsPreview.map((t) => (
            <span
              key={t}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)]"
            >
              {t}
            </span>
          ))}
        </div>
      </article>
    </div>
  );
}
