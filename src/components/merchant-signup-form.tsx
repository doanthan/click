"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type SubmitState = "idle" | "submitting" | "error";

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const ACN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 1];

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function validateAbnAcn(value: string): { ok: boolean; type: "ABN" | "ACN" | null; reason?: string } {
  const digits = digitsOnly(value);
  if (digits.length === 0) {
    return { ok: false, type: null, reason: "Enter an ABN (11 digits) or ACN (9 digits)." };
  }
  if (digits.length === 11) {
    const adjusted = [Number(digits[0]) - 1, ...digits.slice(1).split("").map(Number)];
    const sum = adjusted.reduce((acc, digit, idx) => acc + digit * ABN_WEIGHTS[idx], 0);
    return sum % 89 === 0
      ? { ok: true, type: "ABN" }
      : { ok: false, type: "ABN", reason: "ABN failed the checksum — double-check the digits." };
  }
  if (digits.length === 9) {
    const numbers = digits.split("").map(Number);
    const sum = numbers
      .slice(0, 8)
      .reduce((acc, digit, idx) => acc + digit * ACN_WEIGHTS[idx], 0);
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === numbers[8]
      ? { ok: true, type: "ACN" }
      : { ok: false, type: "ACN", reason: "ACN failed the checksum — double-check the digits." };
  }
  return {
    ok: false,
    type: null,
    reason: "ABN must be 11 digits or ACN must be 9 digits.",
  };
}

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
      return { error: "Enter a valid website domain, like https://yourbusiness.com.au." };
    }

    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return { url: `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}` };
  } catch {
    return { error: "Enter a valid website URL, like https://yourbusiness.com.au." };
  }
}

const steps = ["Business", "Web presence", "ABN / ACN", "Review"] as const;

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
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  const abnValidation = useMemo(() => validateAbnAcn(abn), [abn]);

  function goNext(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setMessage("");

    if (stepIndex === 0) {
      if (!businessName.trim() || !contactEmail.trim()) {
        setMessage("Business name and contact email are required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
        setMessage("Enter a valid contact email.");
        return;
      }
    }
    if (stepIndex === 1) {
      const normalized = normalizeHttpsWebsiteUrl(websiteUrl);
      if (websiteUrl.trim() && normalized.error) {
        setMessage(normalized.error);
        return;
      }
      if (normalized.url) setWebsiteUrl(normalized.url);
    }
    if (stepIndex === 2) {
      if (!abnValidation.ok) {
        setMessage(abnValidation.reason ?? "Enter a valid ABN or ACN.");
        return;
      }
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setMessage("");
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!abnValidation.ok) {
      setMessage(abnValidation.reason ?? "Enter a valid ABN or ACN.");
      setStepIndex(2);
      return;
    }

    setState("submitting");

    const response = await fetch("/api/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName,
        contactEmail,
        websiteUrl,
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
      toast.error(payload.error ?? "Could not save your merchant profile.");
      return;
    }

    toast.success("Merchant profile created. Verification is pending.");
    router.push("/merchant");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
    >
      <ol className="mb-6 grid grid-cols-4 gap-2 text-[0.65rem] font-bold uppercase tracking-[0.18em]">
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
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-bold">
            Website (optional)
            <input
              type="text"
              inputMode="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              onBlur={() => {
                if (!websiteUrl.trim()) return;
                const normalized = normalizeHttpsWebsiteUrl(websiteUrl);
                if (normalized.url) setWebsiteUrl(normalized.url);
              }}
              className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
              placeholder="https://yourbusiness.com.au"
            />
          </label>
          <p className="text-sm font-semibold text-[color:var(--mauve)]">
            Optional — but a public site helps verification go faster. Leave blank if you don&apos;t have one yet.
          </p>
        </div>
      ) : null}

      {stepIndex === 2 ? (
        <div className="grid gap-5">
          <label className="grid gap-2 text-sm font-bold">
            ABN or ACN
            <input
              required
              value={abn}
              onChange={(event) => setAbn(event.target.value)}
              className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 font-semibold outline-none focus:border-[color:var(--rose)]"
              placeholder="11 222 333 444"
              inputMode="numeric"
            />
          </label>
          <p
            className={
              abn.length === 0
                ? "text-sm font-semibold text-[color:var(--mauve)]"
                : abnValidation.ok
                  ? "text-sm font-semibold text-[color:var(--ink)]"
                  : "text-sm font-semibold text-[color:var(--rose)]"
            }
          >
            {abn.length === 0
              ? "We validate the checksum locally — no third-party lookup until you submit."
              : abnValidation.ok
                ? `Valid ${abnValidation.type} ✓`
                : abnValidation.reason}
          </p>
        </div>
      ) : null}

      {stepIndex === 3 ? (
        <div className="grid gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5">
          <ReviewRow label="Business" value={businessName} />
          <ReviewRow label="Contact" value={contactEmail} />
          <ReviewRow label="Website" value={websiteUrl || "Not provided"} />
          <ReviewRow label={abnValidation.type ?? "ABN/ACN"} value={abn} />
          <p className="mt-2 text-xs font-semibold text-[color:var(--mauve)]">
            Submitting puts your profile into <em>pending</em>. An admin reviews
            ABN/ACN within 1-2 business days; you can create draft events in the
            meantime.
          </p>
        </div>
      ) : null}

      {message ? (
        <p className="mt-5 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "submitting" ? "Saving…" : "Create merchant profile"}
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-[color:var(--line)] pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </span>
      <span className="text-sm font-bold text-[color:var(--ink)]">{value}</span>
    </div>
  );
}
