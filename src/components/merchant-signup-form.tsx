"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SubmitState = "idle" | "submitting" | "error";

export function MerchantSignupForm({
  defaultContactEmail,
  defaultBusinessName,
}: {
  defaultContactEmail: string;
  defaultBusinessName: string;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [contactEmail, setContactEmail] = useState(defaultContactEmail);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [abn, setAbn] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const response = await fetch("/api/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, contactEmail, websiteUrl, abn }),
    });

    if (response.status === 401) {
      window.location.href = "/login?callbackUrl=/merchant/signup";
      return;
    }

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(payload.error ?? "Could not save your merchant profile.");
      return;
    }

    router.push("/merchant");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
    >
      <label className="grid gap-2 text-sm font-bold">
        Business or host name
        <input
          required
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          placeholder="Sydney Table Friends"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold">
        Contact email
        <input
          required
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          placeholder="bookings@example.com"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold">
        Website (optional)
        <input
          type="url"
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          placeholder="https://your-venue.com"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold">
        ABN (optional)
        <input
          value={abn}
          onChange={(event) => setAbn(event.target.value)}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          placeholder="11 222 333 444"
        />
      </label>

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
        {state === "submitting" ? "Saving..." : "Create merchant profile"}
      </button>
    </form>
  );
}
