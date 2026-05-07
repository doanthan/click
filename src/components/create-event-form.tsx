"use client";

import { useMemo, useState } from "react";
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

const restaurantMeetup: FormValues = {
  title: "Restaurant Meetup: Table for Eight",
  groupName: "Sydney Table Friends",
  category: "Food",
  startsAt: "2026-05-15T19:00",
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
      startsAt: "2026-05-16T09:30",
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
      startsAt: "2026-05-21T18:30",
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

export function CreateEventForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
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

  async function submitEvent(formData: FormData) {
    setState("submitting");
    setMessage("");

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
        return;
      }

      setState("success");
      setMessage(`${payload.event?.title ?? "Event"} was submitted for admin review.`);
    } catch {
      setState("error");
      setMessage("Event submission failed. Check your connection and try again.");
    }
  }

  return (
    <form
      action={submitEvent}
      className="grid gap-6 rounded-lg border border-black/10 bg-[#fffdf7] p-5 shadow-sm"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f65858]">
          Start with an example
        </p>
        <h3 className="mt-2 text-4xl font-black leading-none">
          Most hosts only need the basics.
        </h3>
        <p className="mt-3 text-sm font-bold leading-6 text-[#1f1f1f]/65">
          Choose a template, adjust the venue and time, then submit. The
          restaurant meetup is ready as the default example.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => {
                setValues(template.values);
                setState("idle");
                setMessage("");
              }}
              className={`rounded-lg border border-black/10 p-4 text-left ${
                values.title === template.values.title
                  ? "bg-[#d8f3ef]"
                  : "bg-white hover:bg-[#f7f3ea]"
              }`}
            >
              <span className="block text-sm font-black">{template.label}</span>
              <span className="mt-1 block text-xs font-bold leading-5 text-[#1f1f1f]/58">
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
            name="title"
            required
            value={values.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Group or host name
          <input
            name="groupName"
            required
            value={values.groupName}
            onChange={(event) => updateField("groupName", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2 text-sm font-black md:col-span-2">
          Venue
          <input
            name="locationName"
            required
            value={values.locationName}
            onChange={(event) => updateField("locationName", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Suburb
          <input
            name="suburb"
            required
            value={values.suburb}
            onChange={(event) => updateField("suburb", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Seats
          <input
            name="capacity"
            required
            inputMode="numeric"
            value={values.capacity}
            onChange={(event) => updateField("capacity", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2 text-sm font-black">
          Category
          <select
            name="category"
            value={values.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          >
            {categories
              .filter((category) => category !== "All")
              .map((category) => (
                <option key={category}>{category}</option>
              ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-black">
          Date and time
          <input
            name="startsAt"
            required
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => updateField("startsAt", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Price
          <input
            name="price"
            value={values.price}
            onChange={(event) => updateField("price", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Tags
          <input
            name="tags"
            value={values.tags}
            onChange={(event) => updateField("tags", event.target.value)}
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-black">
        Why should people come?
        <input
          name="relationshipGoal"
          value={values.relationshipGoal}
          onChange={(event) => updateField("relationshipGoal", event.target.value)}
          className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
        />
      </label>

      <label className="grid gap-2 text-sm font-black">
        Short description
        <textarea
          name="description"
          required
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          className="min-h-28 rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
        />
      </label>

      <div className="rounded-lg border border-black/10 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#008294]">
          Listing preview
        </p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h4 className="text-3xl font-black leading-none">{values.title}</h4>
            <p className="mt-2 text-sm font-bold text-[#1f1f1f]/62">
              {formatDateTime(values.startsAt)} at {values.locationName}
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#1f1f1f]/65">
              {values.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 md:max-w-48 md:justify-end">
            <span className="rounded-full bg-[#d8f3ef] px-3 py-1 text-xs font-black">
              {values.category}
            </span>
            <span className="rounded-full bg-[#f7f3ea] px-3 py-1 text-xs font-black">
              {values.capacity} seats
            </span>
            <span className="rounded-full bg-[#f65858] px-3 py-1 text-xs font-black text-white">
              {values.price || "Free"}
            </span>
          </div>
        </div>
        {selectedTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 bg-[#fffdf7] px-3 py-1 text-xs font-black"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {message ? (
        <p
          className={`rounded-lg border border-black/10 p-3 text-sm font-black ${
            state === "error" ? "bg-[#f65858] text-white" : "bg-[#d8f3ef]"
          }`}
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-fit rounded-full bg-[#1f1f1f] px-6 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state === "submitting" ? "Submitting..." : "Submit restaurant meetup"}
      </button>
    </form>
  );
}
