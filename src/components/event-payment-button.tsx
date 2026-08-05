"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { openLoginModal } from "./login-modal-host";
import { Badge, Button } from "./ds";

// Stand-in for the checkout modal while its chunk is still in flight. The gap
// between the pay tap and Stripe painting stacks three uninstrumented waits
// (the /checkout round trip, this chunk, then Stripe booting its iframe), and
// an unchanged page through all three is exactly where doubt turns into a
// second tap. Same chrome, same footprint, so nothing jumps when it swaps.
function CheckoutModalSkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color:var(--surface-deep)]/70 px-4 py-8 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-full max-w-xl rounded-[var(--radius-xl)] bg-[color:var(--paper)] p-4 shadow-[var(--shadow-lg)] sm:p-6">
        {/* Real text, not just an aria-label: a live region announces its
            CONTENT changing, so a label on an empty box says nothing. */}
        <span className="sr-only">Opening secure checkout…</span>
        <div className="skeleton mb-4 h-8 w-40 rounded-lg" />
        <div className="skeleton h-[420px] w-full rounded-2xl" />
      </div>
    </div>
  );
}

// Split out of the browse bundle: the Stripe SDKs are ~50KB of JS that only a
// shopper who has actually started checkout ever needs. Every event card pulls
// this component in via EventDetailModal, so a static import taxed discovery.
const EventCheckoutModal = dynamic(
  () => import("./event-checkout-modal").then((m) => m.EventCheckoutModal),
  { ssr: false, loading: () => <CheckoutModalSkeleton /> },
);

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

// Whole years between dob and the event date - mirrors the server's 18+ gate.
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
// (or entirely blank - a blank row is an unnamed +1, which is allowed).
function rowError(row: GuestRow, eventDateISO: string | undefined): string | null {
  const started = row.firstName || row.email || row.dob;
  if (!started) return null;
  const name = row.firstName.trim();
  if (name.length < 2 || name.length > 50) return "First name must be 2-50 characters.";
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
  const checkoutAttemptRef = useRef<string | null>(null);
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
  // Which rows the buyer has finished with (blurred) plus whether they have
  // tried to pay yet. rowError is the SUBMIT gate and stays exactly as it was -
  // this only decides when its verdict is worth showing. Without it, typing the
  // "J" of "Jess" instantly scores the row as failing, and you are being told
  // off for entering a friend's details one character at a time.
  const [touchedRows, setTouchedRows] = useState<ReadonlySet<number>>(new Set());
  const [attempted, setAttempted] = useState(false);

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

  function touchRow(i: number) {
    setTouchedRows((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  }

  async function startCheckout() {
    // A failed pay tap must never look like a successful one: reveal every
    // row's verdict from here on, not just the rows already blurred.
    setAttempted(true);
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

    let response: Response;
    try {
      response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/checkout`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": (checkoutAttemptRef.current ??= crypto.randomUUID()),
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body } : {}),
        },
      );
    } catch {
      // A dropped connection used to leave this button disabled on "Reserving…"
      // forever, on the one screen that has just promised to hold a seat. This
      // resets the UI and says what happened - it NEVER re-sends. The
      // Idempotency-Key memoised in the ref above is what makes the buyer's own
      // second tap safe; an automatic retry is a different, unwanted promise.
      setState("error");
      setMessage("We couldn't reach Click. Check your connection and try again.");
      return;
    }

    if (response.status === 401) {
      setState("idle");
      openLoginModal({ callbackUrl: pathname || `/events/${eventId}` });
      return;
    }

    // A gateway can answer with HTML, which makes .json() throw. Falling back to
    // an empty payload lands on the "Could not start checkout." branch below
    // rather than stranding the button mid-flight.
    const payload = (await response.json().catch(() => ({}))) as {
      url?: string;
      clientSecret?: string;
      error?: string;
      redirectTo?: string;
    };

    // Onboarding isn't finished (403 + /onboarding), so there's a form to send
    // them to rather than an error to read.
    if (!response.ok && payload.redirectTo) {
      window.location.href = payload.redirectTo;
      return;
    }

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

  const busy =
    state === "submitting" || state === "redirecting" || state === "paying";

  // The DS button hides its label while loading (spinner in, width held), so the
  // pending wording lives in the live region below instead - where a screen
  // reader actually hears it, which a swapped label on a disabled button never
  // was.
  const busyMessage =
    state === "submitting"
      ? "Reserving your seat…"
      : state === "redirecting"
        ? "Taking you to Stripe…"
        : state === "paying"
          ? "Opening secure checkout…"
          : null;

  const payLabel = useMemo(() => {
    if (guestsEnabled && tickets > 1) return `Reserve ${tickets} seats · ${formatAud(totalCents)}`;
    return `Reserve & pay ${priceLabel}`;
  }, [guestsEnabled, tickets, totalCents, priceLabel]);

  return (
    <div className="grid gap-2">
      {guestsEnabled ? (
        <div className="grid gap-2 rounded-[var(--radius-md)] bg-[color:var(--lav-bg)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
              Tickets
            </span>
            <div className="flex gap-1.5">
              {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTicketCount(n)}
                  aria-pressed={tickets === n}
                  className={`size-11 rounded-xl text-sm font-semibold transition-colors ${
                    tickets === n
                      ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
                      : "border border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {tickets > 1 ? (
            <label className="flex items-start gap-2 text-xs font-medium text-[color:var(--ink-soft)]">
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
              <p className="text-[11px] font-medium text-[color:var(--slate)]">
                You can name up to {tickets - 1} friend{tickets - 1 === 1 ? "" : "s"}. Leave a
                slot blank to bring an unnamed +1.
              </p>
              {rows.map((row, i) => {
                const started = Boolean(row.firstName || row.email || row.dob);
                // Held back until the row is blurred or pay is tapped - see the
                // touchedRows note above.
                const showError = Boolean(rowErrors[i]) && (attempted || touchedRows.has(i));
                const rowReady = started && !rowErrors[i];
                return (
                  <div
                    key={i}
                    className="grid gap-1.5 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-2"
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        value={row.firstName}
                        onChange={(e) => updateRow(i, { firstName: e.target.value })}
                        onBlur={() => touchRow(i)}
                        placeholder="First name"
                        aria-label={`Guest ${i + 1} first name`}
                        aria-invalid={showError || undefined}
                        className={`ck-input w-full ${showError ? "ck-input--invalid" : ""}`}
                      />
                      <input
                        type="date"
                        value={row.dob}
                        onChange={(e) => updateRow(i, { dob: e.target.value })}
                        onBlur={() => touchRow(i)}
                        aria-label={`Guest ${i + 1} date of birth`}
                        aria-invalid={showError || undefined}
                        className={`ck-input w-full ${showError ? "ck-input--invalid" : ""}`}
                      />
                    </div>
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateRow(i, { email: e.target.value })}
                      onBlur={() => touchRow(i)}
                      placeholder="Email"
                      aria-label={`Guest ${i + 1} email`}
                      aria-invalid={showError || undefined}
                      className={`ck-input w-full ${showError ? "ck-input--invalid" : ""}`}
                    />
                    {showError ? (
                      <p role="alert" className="text-[11px] font-medium text-[color:var(--danger)]">
                        {rowErrors[i]}
                      </p>
                    ) : rowReady ? (
                      // Filling a friend in should read as progress, not as a
                      // stream of complaints. Status colour on a Badge is the
                      // one place the DS allows it.
                      <span className="justify-self-start">
                        <Badge tone="sage">Their spot is ready</Badge>
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {namedRows.length > 0 ? (
                <label className="flex items-start gap-2 text-[11px] font-medium text-[color:var(--ink-soft)]">
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
              <p className="text-[11px] text-[color:var(--slate)]">
                Refunds always go to your payment method and follow the standard cancellation
                policy. Your friend can hand their spot back anytime. Spots aren&apos;t
                transferable without cancelling first.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="button" onClick={() => void startCheckout()} full loading={busy}>
        {payLabel}
      </Button>
      {busyMessage ? (
        <p role="status" aria-live="polite" className="text-xs font-medium text-[color:var(--slate)]">
          {busyMessage}
        </p>
      ) : null}
      {message ? (
        <p role="alert" aria-live="assertive" className="text-xs font-medium text-[color:var(--danger)]">
          {message}
        </p>
      ) : null}
      {clientSecret ? (
        <EventCheckoutModal clientSecret={clientSecret} onClose={closeModal} />
      ) : null}
    </div>
  );
}
