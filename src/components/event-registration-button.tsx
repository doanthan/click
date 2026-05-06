"use client";

import { useState } from "react";

type RegistrationState = "idle" | "submitting" | "registered" | "waitlisted" | "error";

export function EventRegistrationButton({ eventId }: { eventId: string }) {
  const [state, setState] = useState<RegistrationState>("idle");
  const [message, setMessage] = useState("");

  async function register() {
    setState("submitting");
    setMessage("");

    const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/register`, {
      method: "POST",
    });

    if (response.status === 401) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent("/events")}`;
      return;
    }

    const payload = (await response.json()) as {
      registration?: { status?: string; eventTitle?: string };
      error?: string;
    };

    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Registration failed.");
      return;
    }

    const status = payload.registration?.status;
    setState(status === "waitlisted" ? "waitlisted" : "registered");
    setMessage(
      status === "waitlisted"
        ? "You are on the waitlist."
        : "You are registered.",
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={register}
        disabled={state === "submitting" || state === "registered" || state === "waitlisted"}
        className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--rose)] px-4 py-3 text-center text-sm font-bold text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state === "submitting"
          ? "Registering..."
          : state === "registered"
            ? "Registered"
            : state === "waitlisted"
              ? "Waitlisted"
              : "Register"}
      </button>
      {message ? (
        <p
          className={`text-xs font-bold ${
            state === "error" ? "text-[color:var(--rose)]" : "text-[color:var(--mauve)]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
