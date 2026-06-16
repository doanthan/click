"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { openLoginModal } from "./login-modal-host";
import { EventCheckoutModal } from "./event-checkout-modal";

type PaymentState = "idle" | "submitting" | "redirecting" | "paying" | "error";

const GUEST_MAX = 3; // purchaser + 3 = 4-seat ceiling (spec 19)

type GuestRow = { firstName: string; email: string; dob: string };

function emptyRow(): GuestRow {
  return { firstName: "", email: "", dob: "" };
}

function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
}

// Whole years between dob and the event date — mirrors the server's 18+ gate.
function ageAt(dobIso: string, eventIso: string): number | null {
  const dob = new Date(`${dobIso}T00:00:00Z`);
  const on = new Date(eventIso);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(on.getTime())) return null;
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns an error string for a STARTED guest row, or null if the row is valid
// (or entirely blank — a blank row is an unnamed +1, which is allowed).
function rowError(row: GuestRow, eventDateISO: string | undefined): string | null {
  const started = row.firstName || row.email || row.dob;
  if (!started) return null;
  const name = row.firstName.trim();
  if (name.length < 2 || name.length > 50) return "First name must be 2–50 characters.";
  if (!EMAIL_RE.test(row.email.trim())) return "Enter a valid email.";
  if (!row.dob) return "Date of birth is required.";
  if (eventDateISO) {
    const age = ageAt(row.dob, eventDateISO);
    if (age !== null && age < 18) return "Guests must be 18 or older.";
  }
  return null;
}

export function EventPaymentButton({
  eventId,
  priceLabel,
  // Multi-seat / guest naming (spec 19). Only enabled when allowGuests is set
  // and there's room for more than one seat; otherwise this stays a solo button.
  allowGuests = false,
  availableSeats,
  perSeatCents,
  eventDateISO,
}: {
  eventId: string;
  priceLabel: string;
  allowGuests?: boolean;
  availableSeats?: number;
  perSeatCents?: number;
  eventDateISO?: string;
}) {
  const [state, setState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const pathname = usePathname();

  // Cap tickets at 4 and at the seats actually available.
  const maxTickets = Math.max(
    1,
    Math.min(1 + GUEST_MAX, availableSeats ?? 1),
  );
  const guestsEnabled = allowGuests && maxTickets > 1;

  const [tickets, setTickets] = useState(1);
  const [namingOn, setNamingOn] = useState(false);
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [consent, setConsent] = useState(false);

  // Named rows = rows the user actually started filling in.
  const namedRows = rows.filter((r) => r.firstName || r.email || r.dob);
  const rowErrors = rows.map((r) => rowError(r, eventDateISO));
  const hasRowError = rowErrors.some(Boolean);
  const needsConsent = namedRows.length > 0 && !consent;
  const totalCents = (perSeatCents ?? 0) * tickets;

  function setTicketCount(n: number) {
    const next = Math.max(1, Math.min(maxTickets, n));
    setTickets(next);
    // Resize the guest rows to next-1 (the extra seats), preserving entries.
    setRows((prev) => {
      const want = next - 1;
      const copy = prev.slice(0, want);
      while (copy.length < want) copy.push(emptyRow());
      return copy;
    });
    if (next === 1) setNamingOn(false);
  }

  function updateRow(i: number, patch: Partial<GuestRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function startCheckout() {
    if (guestsEnabled && (hasRowError || needsConsent)) {
      setState("error");
      setMessage(
        needsConsent
          ? "Please confirm you have your friends' OK to save their spot."
          : "Check the guest details above.",
      );
      return;
    }
    setState("submitting");
    setMessage("");

    // Only send fully-complete named rows; blank/partial extras ride as unnamed +1s.
    const guests = namedRows
      .filter((r) => !rowError(r, eventDateISO))
      .map((r) => ({ firstName: r.firstName.trim(), email: r.email.trim(), dob: r.dob }));

    const body =
      guestsEnabled && tickets > 1
        ? JSON.stringify({ tickets, guests })
        : undefined;

    const response = await fetch(
      `/api/events/${encodeURIComponent(eventId)}/checkout`,
      {
        method: "POST",
        ...(body ? { headers: { "Content-Type": "application/json" }, body } : {}),
      },
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

    if (payload.clientSecret) {
      setClientSecret(payload.clientSecret);
      setState("paying");
      return;
    }

    setState("redirecting");
    window.location.href = payload.url!;
  }

  function closeModal() {
    setClientSecret(null);
    setState("idle");
  }

  const disabled =
    state === "submitting" || state === "redirecting" || state === "paying";

  const payLabel = useMemo(() => {
    if (state === "submitting") return "Reserving…";
    if (state === "redirecting") return "Redirecting to Stripe…";
    if (state === "paying") return "Opening checkout…";
    if (guestsEnabled && tickets > 1) return `Reserve ${tickets} seats · ${formatAud(totalCents)}`;
    return `Reserve & pay ${priceLabel}`;
  }, [state, guestsEnabled, tickets, totalCents, priceLabel]);

  return (
    <div className="grid gap-2">
      {guestsEnabled ? (
        <div className="grid gap-2 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)]/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)]">
              Tickets
            </span>
            <div className="flex gap-1">
              {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTicketCount(n)}
                  className={`h-8 w-8 rounded-full border-2 border-[color:var(--line)] text-sm font-bold ${
                    tickets === n
                      ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                      : "bg-[color:var(--surface)] text-[color:var(--surface-deep)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {tickets > 1 ? (
            <label className="flex items-start gap-2 text-xs font-semibold text-[color:var(--surface-deep)]">
              <input
                type="checkbox"
                checked={namingOn}
                onChange={(e) => setNamingOn(e.target.checked)}
                className="mt-0.5"
              />
              <span>Name your +1s so we can save their spot properly (optional)</span>
            </label>
          ) : null}

          {namingOn && tickets > 1 ? (
            <div className="grid gap-3">
              <p className="text-[11px] font-semibold text-[color:var(--surface-deep)]/70">
                You can name up to {tickets - 1} friend{tickets - 1 === 1 ? "" : "s"}. Leave a
                slot blank to bring an unnamed +1.
              </p>
              {rows.map((row, i) => (
                <div key={i} className="grid gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-2">
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      value={row.firstName}
                      onChange={(e) => updateRow(i, { firstName: e.target.value })}
                      placeholder="First name"
                      className="rounded-md border border-[color:var(--line)] px-2 py-1.5 text-sm"
                    />
                    <input
                      type="date"
                      value={row.dob}
                      onChange={(e) => updateRow(i, { dob: e.target.value })}
                      aria-label="Guest date of birth"
                      className="rounded-md border border-[color:var(--line)] px-2 py-1.5 text-sm"
                    />
                  </div>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateRow(i, { email: e.target.value })}
                    placeholder="Email"
                    className="rounded-md border border-[color:var(--line)] px-2 py-1.5 text-sm"
                  />
                  {rowErrors[i] ? (
                    <p className="text-[11px] font-bold text-[color:var(--rose)]">{rowErrors[i]}</p>
                  ) : null}
                </div>
              ))}
              {namedRows.length > 0 ? (
                <label className="flex items-start gap-2 text-[11px] font-semibold text-[color:var(--surface-deep)]">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I have their OK to share these details and save them a spot. They&apos;ll get
                    one invite email from Click with a link to remove their details instantly.
                  </span>
                </label>
              ) : null}
              <p className="text-[11px] text-[color:var(--surface-deep)]/70">
                Refunds always go to your payment method and follow the standard cancellation
                policy. Your friend can hand their spot back anytime. Spots aren&apos;t
                transferable without cancelling first.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled}
        className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-center text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {payLabel}
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
