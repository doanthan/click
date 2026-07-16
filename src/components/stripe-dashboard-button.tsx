"use client";

import { useState } from "react";

// One-shot Stripe Express dashboard login. POSTs to
// /api/merchant/stripe/dashboard which mints a fresh URL via
// stripe.accounts.createLoginLink - the URL expires in ~5 minutes and is
// never cached client-side. Sibling to <ConnectPayoutsButton /> in
// merchant-onboarding-wizard.tsx (initial onboarding) - this one is for the
// post-connection "view my payouts" path surfaced from the Finances tab.

const dashboardBtn =
  "ck-btn ck-btn--sm ck-btn--secondary disabled:cursor-not-allowed";

export function StripeDashboardButton({
  label = "Open Stripe dashboard →",
}: {
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/merchant/stripe/dashboard", {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        redirect?: string;
      };
      if (response.status === 401) {
        window.location.href = "/merchant/login?callbackUrl=/merchant?tab=finances";
        return;
      }
      // Server can tell us to send the merchant somewhere else (e.g. finish
      // onboarding first) - follow that link instead of surfacing as an
      // error.
      if (!response.ok) {
        if (body.redirect) {
          window.location.href = body.redirect;
          return;
        }
        setError(body.error ?? "Couldn't open Stripe dashboard. Try again.");
        setBusy(false);
        return;
      }
      if (!body.url) {
        setError("Stripe didn't return a login URL.");
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error - please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={open} disabled={busy} className={dashboardBtn}>
        {busy ? "Opening Stripe…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
