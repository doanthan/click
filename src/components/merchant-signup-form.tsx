"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAbn, validateOptionalAbn } from "@/lib/abn";

type SubmitState = "idle" | "submitting" | "error";

const defaultWebsiteUrl = "https://www.google.com";

function normalizeHttpsWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { url: "" };

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (parsed.protocol !== "https:") {
      return { error: "Website must start with https://." };
    }

    if (!parsed.hostname.includes(".")) {
      return { error: "Enter a valid website domain, like https://www.google.com." };
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return { url: `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}` };
  } catch {
    return { error: "Enter a valid website URL, like https://www.google.com." };
  }
}

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
  const [websiteUrl, setWebsiteUrl] = useState(defaultWebsiteUrl);
  const [abn, setAbn] = useState("");
  const [abnError, setAbnError] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedWebsite = normalizeHttpsWebsiteUrl(websiteUrl);
    if (normalizedWebsite.error) {
      setState("error");
      setMessage(normalizedWebsite.error);
      return;
    }

    const abnValidationError = validateOptionalAbn(abn);
    if (abnValidationError) {
      setState("error");
      setMessage(abnValidationError);
      return;
    }

    const normalizedWebsiteUrl = normalizedWebsite.url ?? "";
    setWebsiteUrl(normalizedWebsiteUrl);
    setState("submitting");

    const response = await fetch("/api/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        contactEmail,
        websiteUrl: normalizedWebsiteUrl,
        abn,
      }),
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
          type="text"
          inputMode="url"
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          onBlur={() => {
            const normalizedWebsite = normalizeHttpsWebsiteUrl(websiteUrl);
            if (normalizedWebsite.url) setWebsiteUrl(normalizedWebsite.url);
          }}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          placeholder="https://www.google.com"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold">
        ABN (optional)
        <input
          value={abn}
          inputMode="numeric"
          onChange={(event) => {
            setAbn(event.target.value);
            if (abnError) setAbnError("");
          }}
          onBlur={() => {
            setAbnError(validateOptionalAbn(abn) ?? "");
            setAbn((current) => formatAbn(current));
          }}
          aria-invalid={abnError ? true : undefined}
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
          placeholder="11 222 333 444"
        />
        {abnError ? (
          <span className="text-xs font-semibold text-[color:var(--surface-deep)]">{abnError}</span>
        ) : null}
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
