"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { openLoginModal } from "./login-modal-host";
import { EventCheckoutModal } from "./event-checkout-modal";

type PaymentState = "idle" | "submitting" | "redirecting" | "paying" | "error";

export function EventPaymentButton({
  eventId,
  priceLabel,
}: {
  eventId: string;
  priceLabel: string;
}) {
  const [state, setState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
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

    const payload = (await response.json()) as {
      url?: string;
      clientSecret?: string;
      error?: string;
    };

    if (!response.ok || (!payload.url && !payload.clientSecret)) {
      setState("error");
      setMessage(payload.error ?? "Could not start checkout.");
      return;
    }

    // Embedded checkout: open the Stripe payment form in a modal on this page.
    if (payload.clientSecret) {
      setClientSecret(payload.clientSecret);
      setState("paying");
      return;
    }

    // Hosted fallback (no publishable key configured): full-page redirect.
    setState("redirecting");
    window.location.href = payload.url!;
  }

  function closeModal() {
    // The held seat expires on its own; reset so they can retry if they backed
    // out without paying.
    setClientSecret(null);
    setState("idle");
  }

  const disabled =
    state === "submitting" || state === "redirecting" || state === "paying";

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
            : state === "paying"
              ? "Opening checkout…"
              : `Reserve & pay ${priceLabel}`}
      </button>
      {message ? (
        <p className="text-xs font-bold text-[color:var(--rose)]">{message}</p>
      ) : null}
      {clientSecret ? (
        <EventCheckoutModal clientSecret={clientSecret} onClose={closeModal} />
      ) : null}
    </div>
  );
}
