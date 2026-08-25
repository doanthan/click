/**
 * Click Design System - the MERCHANT (host console) primitives.
 *
 * Ported from `context/Click Design System/components/merchant/` (StatCard,
 * CapacityMeter, StatusPill, WizardStepper) and the `click-app-v2/merchant.jsx`
 * reference screen. That bundle is the source of truth - when it is re-exported,
 * diff against it and update THIS file; never edit the bundle.
 *
 * Sibling to `ds.tsx` (the site-wide primitives). Buttons, badges, tags and
 * avatars come from THERE - this file never re-draws them, it only composes them
 * into the host-console vocabulary. The locked merchant colour roles:
 *
 *   Deep Purple = brand / current      Sage   = live + money-good (paid, connected)
 *   Amber       = waiting (pending)    Coral  = cancelled / nearly full
 *   Lavender    = confirmed bookings   neutral = ended / draft / refunded
 *
 * Status colour lives on BADGES ONLY - never on a CTA, never on a hero accent.
 */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Badge, Icon, type BadgeTone } from "./ds";

/* ============================ surfaces ============================ */
/* The two card grounds the whole portal is built from. White card on cream with
   ONE soft purple-tinted shadow (never shadow + border), radius 16. The tint is
   the lavender WASH used for banners and callouts - never a section-sized
   lavender-300 field. No cards-inside-cards: group with whitespace instead. */

export const mCard = "rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]";
export const mTint = "rounded-2xl bg-[color:var(--lavender-100)]";
/** Hairline used for dividers INSIDE a card (rows, header strips) - not a frame. */
export const mLine = "border-[color:var(--mist)]";

/* ============================ StatCard ============================ */

/**
 * StatCard - the period-scoped KPI tile.
 *
 * Two rules that are easy to break and loud when broken:
 *  - max ONE `hero` (Deep Purple) tile per row; the rest are plain white.
 *  - `note` is not decoration. Every KPI carries its period/scope ("this month",
 *    "upcoming events", "$0 · free events so far") so a bare number can never
 *    be misread. Money is NEVER "Free" - write "$0" and scope it in the note.
 */
export function StatCard({
  label,
  value,
  note,
  hero = false,
}: {
  label: string;
  value: string;
  note?: string;
  hero?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 rounded-2xl px-4 py-4 ${
        hero ? "bg-[color:var(--purple)]" : mCard
      }`}
    >
      <span
        className={`text-[11px] font-bold uppercase tracking-[0.09em] ${
          hero ? "text-[color:var(--lavender-300)]" : "text-[color:var(--ink-faint)]"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-display text-[27px] font-semibold leading-[1.05] tabular-nums ${
          hero ? "text-[color:var(--champagne)]" : "text-[color:var(--ink)]"
        }`}
      >
        {value}
      </span>
      {note ? (
        <span
          className={`text-xs leading-snug ${
            hero ? "text-[color:var(--champagne)]/75" : "text-[color:var(--slate)]"
          }`}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}

/* ============================ CapacityMeter ============================ */

/**
 * CapacityMeter - the SINGLE way capacity renders anywhere in the portal
 * (event rows, dashboard cards, event detail). "confirmed / cap" over a slim
 * bar. The fill turns Coral above 85% full ("nearly full" is the one status
 * that earns colour here); otherwise it is Purple.
 */
export function CapacityMeter({
  confirmed,
  cap,
  maxWidth = 96,
  className = "",
}: {
  confirmed: number;
  cap: number;
  /** Bar width cap in px. Pass `null` to let it fill the container. */
  maxWidth?: number | null;
  className?: string;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((confirmed / cap) * 100)) : 0;
  const nearlyFull = cap > 0 && confirmed / cap > 0.85;
  const barStyle: CSSProperties = maxWidth ? { maxWidth } : {};

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[color:var(--ink)]">
        {confirmed} / {cap}
      </span>
      <span
        className="block h-[5px] w-full overflow-hidden rounded-full bg-[color:var(--lavender-100)]"
        style={barStyle}
        role="img"
        aria-label={`${confirmed} of ${cap} spots taken`}
      >
        <span
          className={`block h-full rounded-full ${
            nearlyFull ? "bg-[color:var(--coral)]" : "bg-[color:var(--purple-500)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

/* ============================ StatusPill ============================ */

/**
 * StatusPill - the single merchant status vocabulary. Wraps the core `Badge` so
 * the tones can never drift per surface. Sage = live + money-good, Amber = a
 * waiting state, Coral = cancelled, Lavender = a confirmed booking, neutral =
 * over/inert. Rejected is the one true error - it takes `--danger` via `coral`'s
 * AA ink, since a merchant must act on it.
 */
export type MerchantStatus =
  | "live"
  | "featured"
  | "ended"
  | "pending"
  | "pending_payment"
  | "rejected"
  | "cancelled"
  | "confirmed"
  | "waitlist"
  | "waitlisted"
  | "full"
  | "locked"
  | "draft"
  | "paid"
  | "refunded";

const STATUS_MAP: Record<MerchantStatus, { tone: BadgeTone; label: string }> = {
  live: { tone: "sage", label: "Live" },
  featured: { tone: "sage", label: "Featured" },
  paid: { tone: "sage", label: "Paid" },
  confirmed: { tone: "lavender", label: "Confirmed" },
  pending: { tone: "amber", label: "Pending" },
  pending_payment: { tone: "amber", label: "Awaiting payment" },
  waitlist: { tone: "amber", label: "Waitlist" },
  waitlisted: { tone: "amber", label: "Waitlisted" },
  full: { tone: "coral", label: "Full" },
  cancelled: { tone: "coral", label: "Cancelled" },
  rejected: { tone: "coral", label: "Rejected" },
  locked: { tone: "neutral", label: "Locked" },
  ended: { tone: "neutral", label: "Ended" },
  draft: { tone: "neutral", label: "Draft" },
  refunded: { tone: "neutral", label: "Refunded" },
};

/** Normalises the repository's mixed casing ("Live", "pending_payment") to a key. */
export function toMerchantStatus(raw: string): MerchantStatus {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_") as MerchantStatus;
  return key in STATUS_MAP ? key : "draft";
}

/**
 * What status a host should SEE for one of their events, as opposed to what the
 * events row stores. "Ended" and "Full" are not stored statuses - they are the
 * clock and the capacity - so every surface has to derive them, and three
 * surfaces were doing it separately: the events panel and the calendar chip had
 * it right, and the dashboard card printed the raw column, so a sold-out or
 * finished event still read "Live" on the first screen a host opens.
 *
 * Precedence matters and is the same everywhere: Cancelled and Rejected win
 * over Ended, because "not on" is what the host needs to read first.
 *
 * Returns a StatusPill key; pass it straight to <StatusPill status={...} /> or
 * to merchantStatusLabel for the words.
 */
export function merchantEventDisplayStatus(event: {
  status: string;
  startsAt: string;
  endsAt?: string | null;
  confirmed: number;
  capacity: number;
  /** Pass the host's clock reading; server components should compute it once. */
  nowMs?: number;
}): string {
  if (event.status === "Cancelled") return "cancelled";
  if (event.status === "Rejected") return "rejected";
  const now = event.nowMs ?? Date.now();
  if (new Date(event.endsAt ?? event.startsAt).getTime() < now) return "ended";
  if (event.confirmed >= event.capacity && event.status === "Live") return "full";
  return event.status;
}

/** The words StatusPill would print for a status key. */
export function merchantStatusLabel(status: string): string {
  return STATUS_MAP[toMerchantStatus(status)].label;
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const entry = STATUS_MAP[toMerchantStatus(status)];
  return <Badge tone={entry.tone}>{label ?? entry.label}</Badge>;
}

/* ============================ WizardStepper ============================ */

/**
 * WizardStepper - numbered progress dots joined by hairlines, for every
 * multi-step merchant flow (become a host, create event, post-approval
 * onboarding). Completed steps turn SAGE with a check and are clickable; the
 * current step is Deep Purple; upcoming steps are a quiet outline.
 *
 * A step AHEAD is clickable only when the caller passed `completed` and every
 * step before the target validates - so you still cannot skip past unvalidated
 * input, but a host who has filled the whole wizard can jump straight back to
 * Review instead of pressing Next once per step.
 *
 * Pass `paths` to make completed steps navigate (our wizards are route-driven);
 * omit it for a read-only progress display.
 *
 * `completed` is the truth about which steps actually hold valid input. Without
 * it completion is inferred from POSITION - every step before the current one
 * gets a green tick - so deep-linking to the last step of a route-driven wizard
 * painted a full row of ticks over an empty form. Pass it and a step only reads
 * as done when it really is; omit it and the positional default stands (fine
 * for a linear flow you cannot deep-link into).
 */
export function WizardStepper({
  steps,
  current,
  paths,
  completed,
  className = "",
}: {
  steps: readonly string[];
  current: number;
  paths?: readonly string[];
  completed?: readonly boolean[];
  className?: string;
}) {
  return (
    <ol className={`flex items-center gap-2 ${className}`}>
      {steps.map((title, i) => {
        const done = i < current && (completed ? completed[i] === true : true);
        const active = i === current;

        // Forward jumps. Without these the stepper was a one-way ratchet, and
        // the cost landed on the create-event wizard's Review step: its "Edit"
        // links drop a host three or four steps back, and the only way back to
        // Review was pressing Next once per step. A step ahead is reachable
        // when every step before it validates - which the caller has to have
        // told us, via `completed`. No `completed` (the signup and onboarding
        // wizards) means we cannot know, so those keep the old backwards-only
        // behaviour exactly.
        const canJumpForward =
          i > current && !!completed && completed.slice(0, i).every(Boolean);
        const linkable = (done || canJumpForward) && !!paths?.[i];

        const dot = (
          <span
            className={`inline-flex size-6 flex-none items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
              done
                ? "bg-[color:var(--sage)] text-white"
                : active
                  ? "bg-[color:var(--purple)] text-white"
                  : "border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] text-[color:var(--slate)]"
            }`}
          >
            {done ? <Icon name="check" size={12} stroke={2.8} /> : i + 1}
          </span>
        );

        /* sr-only, NOT `hidden`. display:none drops the node out of the
           accessibility tree as well as the layout, so under 640px a screen
           reader used to hear bare numerals - "1, 2, 3", one of them current,
           none of them named. sr-only keeps the step name announced at every
           width while still painting nothing below sm, and sm:not-sr-only puts
           it back in flow for the desktop row.

           Layout is unchanged either way: sr-only clips the span to 1px and
           takes it out of flow, exactly as `hidden` did, so the li's flex gap
           still sees only the dot on small screens. */
        const label = (
          <span
            className={`sr-only text-[12px] font-bold uppercase tracking-[0.08em] sm:not-sr-only sm:inline ${
              active ? "text-[color:var(--purple-700)]" : "text-[color:var(--ink-faint)]"
            }`}
          >
            {title}
          </span>
        );

        const inner =
          linkable && paths?.[i] ? (
            <Link
              href={paths[i]}
              aria-label={i < current ? `Go back to ${title}` : `Go to ${title}`}
              /* -my-2 py-2 grows the hit area to 40px without moving the dot:
                 below sm the label is sr-only, so the whole target was the 24px
                 dot itself - under the 44px a thumb needs, on the one control
                 that moves between steps. */
              className="-my-2 inline-flex items-center gap-[7px] rounded-full py-2 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]"
            >
              {dot}
              {label}
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-[7px]"
              aria-current={active ? "step" : undefined}
            >
              {dot}
              {label}
            </span>
          );

        return (
          <li key={title} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            {inner}
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={`h-[1.5px] flex-1 ${
                  i < current ? "bg-[color:var(--purple-400)]" : "bg-[color:var(--mist-strong)]"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ============================ portal chrome ============================ */
/* Small shared pieces the reference screen uses on every merchant page. Kept
   here (not re-declared per tab) so a restyle lands everywhere at once. */

/**
 * SectionLabel - the quiet section overline inside a merchant page ("July at a
 * glance", "Your events", "Venues"). The `.eyebrow` class in globals.css is the
 * canonical overline; this just guarantees the merchant's faint tone.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/**
 * MerchantEmpty - the lavender-wash empty state. One optional CTA, never two,
 * and never a duplicate of a "Create event" button already on the screen.
 */
export function MerchantEmpty({
  icon = "calendar",
  title,
  body,
  action,
}: {
  icon?: "calendar" | "ticket" | "users" | "pin";
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${mTint} flex flex-col items-center gap-2.5 px-6 py-8 text-center`}>
      <span className="flex size-11 items-center justify-center rounded-full bg-[color:var(--paper)] text-[color:var(--purple)]">
        <Icon name={icon} size={20} />
      </span>
      <p className="font-display text-[16.5px] font-semibold text-[color:var(--ink)]">{title}</p>
      {body ? (
        <p className="max-w-[420px] text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * InfoNote - the lavender-wash inline note ("Address privacy: …", "Paid bookings
 * route via Stripe …"). One glyph, one line of body copy, no heading.
 */
export function InfoNote({
  icon = "info",
  children,
}: {
  icon?: "info" | "lock" | "ticket" | "calendar";
  children: ReactNode;
}) {
  return (
    <div className={`${mTint} flex items-start gap-2.5 px-4 py-3`}>
      <span className="mt-px text-[color:var(--purple)]">
        <Icon name={icon} size={16} />
      </span>
      <p className="min-w-0 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">{children}</p>
    </div>
  );
}
