"use client";

import { useState } from "react";
import { categories } from "@/lib/click-data";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function CreateEventForm() {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function submitEvent(formData: FormData) {
    setState("submitting");
    setMessage("");

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
  }

  return (
    <form action={submitEvent} className="grid gap-4 rounded-lg border border-black/10 bg-[#fffdf7] p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-black">
          Event title
          <input
            name="title"
            required
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="Pottery and Shared Plates"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Group name
          <input
            name="groupName"
            required
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="Sydney Table Friends"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-black">
          Category
          <select
            name="category"
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="Creative"
          >
            {categories.filter((category) => category !== "All").map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-black">
          Start date and time
          <input
            name="startsAt"
            required
            type="datetime-local"
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="2026-05-24T18:30"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Capacity
          <input
            name="capacity"
            required
            inputMode="numeric"
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="32"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-black md:col-span-2">
          Location
          <input
            name="locationName"
            required
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="Redfern Community Centre"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Suburb
          <input
            name="suburb"
            required
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="Redfern"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-black">
          Price
          <input
            name="price"
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="$24"
          />
        </label>
        <label className="grid gap-2 text-sm font-black">
          Tags
          <input
            name="tags"
            className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
            defaultValue="Creative, Food, Low Pressure"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-black">
        Relationship goal
        <input
          name="relationshipGoal"
          className="rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          defaultValue="Help people meet through a relaxed shared activity."
        />
      </label>

      <label className="grid gap-2 text-sm font-black">
        Description
        <textarea
          name="description"
          required
          className="min-h-28 rounded-lg border border-black/10 bg-white px-4 py-3 font-bold outline-none focus:border-[#008294]"
          defaultValue="For people who want a relaxed table and something to do with their hands."
        />
      </label>

      {message ? (
        <p
          className={`rounded-lg border border-black/10 p-3 text-sm font-black ${
            state === "error" ? "bg-[#f65858]" : "bg-[#d8f3ef]"
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
        {state === "submitting" ? "Submitting..." : "Submit for admin review"}
      </button>
    </form>
  );
}
