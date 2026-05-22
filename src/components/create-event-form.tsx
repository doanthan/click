"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { categories } from "@/lib/click-data";

type SubmitState = "idle" | "submitting" | "success" | "error";

type FormValues = {
  title: string;
  groupName: string;
  category: string;
  startsAt: string;
  capacity: string;
  locationName: string;
  suburb: string;
  price: string;
  tags: string;
  relationshipGoal: string;
  description: string;
};

function defaultTemplateStartsAt(daysFromNow: number, hour: number, minute: number) {
  // Templates default to upcoming dates so the wizard preview makes sense.
  // Falls back to a static near-future timestamp if Date.now() looks suspicious
  // (e.g. during SSR test environments).
  const now = Date.now();
  const date = new Date(now + daysFromNow * 86_400_000);
  date.setHours(hour, minute, 0, 0);
  // datetime-local needs "YYYY-MM-DDTHH:mm" in local time (no Z).
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const restaurantMeetup: FormValues = {
  title: "Restaurant Meetup: Table for Eight",
  groupName: "Sydney Table Friends",
  category: "Food",
  startsAt: defaultTemplateStartsAt(21, 19, 0),
  capacity: "8",
  locationName: "Bar Lucia, Potts Point",
  suburb: "Potts Point",
  price: "$38",
  tags: "restaurant, dinner, food, low pressure",
  relationshipGoal: "Make dinner feel like the easiest first plan with new people.",
  description:
    "A hosted restaurant table for people who want dinner plans without the awkward group-chat setup. Arrive solo, sit with eight, and let the host open the first conversation.",
};

const templates: Array<{ label: string; hint: string; values: FormValues }> = [
  {
    label: "Restaurant meetup",
    hint: "Small dinner table, clear price, solo-friendly.",
    values: restaurantMeetup,
  },
  {
    label: "Coffee walk",
    hint: "Free, casual, easy for first-time hosts.",
    values: {
      title: "Coffee Walk for New Locals",
      groupName: "Saturday Morning Circle",
      category: "Social",
      startsAt: defaultTemplateStartsAt(22, 9, 30),
      capacity: "16",
      locationName: "Single O Surry Hills",
      suburb: "Surry Hills",
      price: "Free",
      tags: "coffee, walk, friends, low pressure",
      relationshipGoal: "Help people meet through a short walk and an easy coffee stop.",
      description:
        "Meet at the cafe, grab coffee, and walk a simple loop with a hosted introduction at the start. Good for people who want a plan that does not feel intense.",
    },
  },
  {
    label: "Workshop table",
    hint: "Activity-led plan with built-in conversation.",
    values: {
      title: "Shared Plates and Sketchbooks",
      groupName: "Ordinary People Making Things",
      category: "Creative",
      startsAt: defaultTemplateStartsAt(27, 18, 30),
      capacity: "20",
      locationName: "Paramount House Hotel",
      suburb: "Surry Hills",
      price: "$24",
      tags: "creative, food, sketching, new friends",
      relationshipGoal: "Give creative people a reason to sit together and make something small.",
      description:
        "A casual hosted table with shared snacks, simple sketch prompts, and no pressure to be good at drawing. The point is a reason to talk.",
    },
  },
];

const steps = ["Basics", "Schedule", "Location", "Story", "Review"] as const;

function formatDateTime(value: string) {
  if (!value) return "Pick a date";

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function validateStep(stepIndex: number, values: FormValues): string | null {
  if (stepIndex === 0) {
    if (!values.title.trim()) return "Give your event a title.";
    if (!values.groupName.trim()) return "Add your group or host name.";
    if (!values.category.trim()) return "Pick a category.";
  }
  if (stepIndex === 1) {
    if (!values.startsAt) return "Set a date and time.";
    const seats = Number(values.capacity);
    if (!Number.isFinite(seats) || seats < 1) return "Capacity must be at least 1.";
  }
  if (stepIndex === 2) {
    if (!values.locationName.trim()) return "Venue is required.";
    if (!values.suburb.trim()) return "Suburb is required.";
  }
  if (stepIndex === 3) {
    if (!values.description.trim() || values.description.trim().length < 30) {
      return "Description should be at least a couple of sentences (30+ chars).";
    }
  }
  return null;
}

export function CreateEventForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<FormValues>(restaurantMeetup);

  const selectedTags = useMemo(
    () =>
      values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 5),
    [values.tags],
  );

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function goNext() {
    const error = validateStep(stepIndex, values);
    if (error) {
      setMessage(error);
      setState("error");
      return;
    }
    setMessage("");
    setState("idle");
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setMessage("");
    setState("idle");
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function submitEvent() {
    for (let i = 0; i < steps.length - 1; i++) {
      const error = validateStep(i, values);
      if (error) {
        setMessage(error);
        setState("error");
        setStepIndex(i);
        return;
      }
    }

    setState("submitting");
    setMessage("");

    const formData = new FormData();
    (Object.keys(values) as Array<keyof FormValues>).forEach((key) => {
      formData.append(key, values[key]);
    });

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        body: formData,
      });

      if (response.status === 401) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent("/merchant")}`;
        return;
      }

      const payload = (await response.json()) as {
        event?: { title?: string };
        error?: string;
      };

      if (!response.ok) {
        setState("error");
        setMessage(payload.error ?? "Event submission failed.");
        toast.error(payload.error ?? "Event submission failed.");
        return;
      }

      setState("success");
      setMessage(`${payload.event?.title ?? "Event"} was submitted for admin review.`);
      toast.success("Event submitted for review.");
    } catch {
      setState("error");
      setMessage("Event submission failed. Check your connection and try again.");
    }
  }

  return (
    <form
      action={submitEvent}
      className="grid gap-6 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] p-5 shadow-sm"
    >
      <ol className="grid grid-cols-5 gap-2 text-[0.65rem] font-bold uppercase tracking-[0.18em]">
        {steps.map((label, index) => {
          const active = index === stepIndex;
          const done = index < stepIndex;
          return (
            <li
              key={label}
              className={
                active
                  ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-3 py-1 text-center text-[color:var(--champagne)]"
                  : done
                    ? "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3 py-1 text-center text-[color:var(--surface-deep)]"
                    : "rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 text-center text-[color:var(--mauve)]"
              }
            >
              {index + 1}. {label}
            </li>
          );
        })}
      </ol>

      {stepIndex === 0 ? (
        <div className="grid gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--rose)]">
              Start from a template
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {templates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => {
                    setValues(template.values);
                    setState("idle");
                    setMessage("");
                  }}
                  className={`rounded-lg border border-[color:var(--line)] p-4 text-left ${
                    values.title === template.values.title
                      ? "bg-[color:var(--peach)]"
                      : "bg-white hover:bg-[color:var(--cream)]"
                  }`}
                >
                  <span className="block text-sm font-black">{template.label}</span>
                  <span className="mt-1 block text-xs font-bold leading-5 text-[color:var(--mauve)]">
                    {template.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-black">
              Event title
              <input
                required
                value={values.title}
                onChange={(event) => updateField("title", event.target.value)}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              Group or host name
              <input
                required
                value={values.groupName}
                onChange={(event) => updateField("groupName", event.target.value)}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              />
            </label>
            <label className="grid gap-2 text-sm font-black">
              Category
              <select
                value={values.category}
                onChange={(event) => updateField("category", event.target.value)}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              >
                {categories
                  .filter((category) => category !== "All")
                  .map((category) => (
                    <option key={category}>{category}</option>
                  ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black">
              Tags (comma-separated)
              <input
                value={values.tags}
                onChange={(event) => updateField("tags", event.target.value)}
                className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              />
            </label>
          </div>
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-black">
            Date and time
            <input
              required
              type="datetime-local"
              value={values.startsAt}
              onChange={(event) => updateField("startsAt", event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            />
          </label>
          <label className="grid gap-2 text-sm font-black">
            Seats / capacity
            <input
              required
              inputMode="numeric"
              value={values.capacity}
              onChange={(event) => updateField("capacity", event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            />
          </label>
          <label className="grid gap-2 text-sm font-black">
            Price (e.g. $24 or Free)
            <input
              value={values.price}
              onChange={(event) => updateField("price", event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            />
          </label>
        </div>
      ) : null}

      {stepIndex === 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-black md:col-span-2">
            Venue
            <input
              required
              value={values.locationName}
              onChange={(event) => updateField("locationName", event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            />
          </label>
          <label className="grid gap-2 text-sm font-black">
            Suburb
            <input
              required
              value={values.suburb}
              onChange={(event) => updateField("suburb", event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            />
          </label>
          <p className="rounded-lg border border-[color:var(--line)] bg-[color:var(--cream)] p-3 text-xs font-semibold leading-5 text-[color:var(--mauve)] md:col-span-2">
            Exact street address stays hidden from non-attendees until the event
            unlocks. Only the venue name + suburb is public.
          </p>
        </div>
      ) : null}

      {stepIndex === 3 ? (
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-black">
            Why should people come?
            <input
              value={values.relationshipGoal}
              onChange={(event) => updateField("relationshipGoal", event.target.value)}
              className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
              placeholder="What's the reason to talk?"
            />
          </label>
          <label className="grid gap-2 text-sm font-black">
            Short description
            <textarea
              required
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="min-h-32 rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 font-bold outline-none focus:border-[color:var(--rose)]"
            />
          </label>
          <p className="rounded-lg border border-[color:var(--line)] bg-[color:var(--cream)] p-3 text-xs font-semibold leading-5 text-[color:var(--mauve)]">
            Banner image upload is coming soon — we&apos;ll auto-generate a tasteful
            cover from your category + suburb for now.
          </p>
        </div>
      ) : null}

      {stepIndex === 4 ? (
        <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            Listing preview
          </p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="text-3xl font-black leading-none">{values.title}</h4>
              <p className="mt-2 text-sm font-bold text-[color:var(--mauve)]">
                {formatDateTime(values.startsAt)} at {values.locationName}, {values.suburb}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--mauve)]">
                {values.description}
              </p>
              {values.relationshipGoal ? (
                <p className="font-script mt-3 text-xl text-[color:var(--rose)]">
                  {values.relationshipGoal}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:max-w-48 md:justify-end">
              <span className="rounded-full bg-[color:var(--peach)] px-3 py-1 text-xs font-black">
                {values.category}
              </span>
              <span className="rounded-full bg-[color:var(--cream)] px-3 py-1 text-xs font-black">
                {values.capacity} seats
              </span>
              <span className="rounded-full bg-[color:var(--rose)] px-3 py-1 text-xs font-black text-[color:var(--on-deep)]">
                {values.price || "Free"}
              </span>
            </div>
          </div>
          {selectedTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-xs font-black"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p
          className={`rounded-lg border border-[color:var(--line)] p-3 text-sm font-black ${
            state === "error" ? "bg-[color:var(--rose)] text-[color:var(--on-deep)]" : "bg-[color:var(--peach)]"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2 text-sm font-bold text-[color:var(--ink)] disabled:opacity-40"
        >
          ← Back
        </button>
        {stepIndex < steps.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--champagne)] hard-shadow-sm"
          >
            Continue →
          </button>
        ) : (
          <button
            type="submit"
            disabled={state === "submitting"}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {state === "submitting" ? "Submitting…" : "Submit for review"}
          </button>
        )}
      </div>
    </form>
  );
}
