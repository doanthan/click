"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { openLoginModal } from "./login-modal-host";

type PaymentState = "idle" | "submitting" | "redirecting" | "error";

export function EventPaymentButton({
  eventId,
  priceLabel,
}: {
  eventId: string;
  priceLabel: string;
}) {
  const [state, setState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState("");
  const pathname = usePathname();

  async function startCheckout() {
    setState("submitting");
    setMessage("");

    const response = await fetch(
      `/api/events/${encodeURIComponent(eventId)}/checkout`,
      { method: "POST" },
    );

    if (response.status === 401) {
      setState("idle");
      openLoginModal({ callbackUrl: pathname || `/events/${eventId}` });
      return;
    }

    const payload = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !payload.url) {
      setState("error");
      setMessage(payload.error ?? "Could not start checkout.");
      return;
    }

    setState("redirecting");
    window.location.href = payload.url;
  }

  const disabled = state === "submitting" || state === "redirecting";

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled}
        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-center text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {state === "submitting"
          ? "Reserving seat…"
          : state === "redirecting"
            ? "Redirecting to Stripe…"
            : `Reserve & pay ${priceLabel}`}
      </button>
      {message ? (
        <p className="text-xs font-bold text-[color:var(--rose)]">{message}</p>
      ) : null}
    </div>
  );
}
