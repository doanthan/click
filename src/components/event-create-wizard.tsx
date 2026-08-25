"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Badge, EndowedProgress, FormField, Icon } from "./ds";
import { InfoNote, WizardStepper } from "./merchant-ds";
import { ConfirmDialog } from "./confirm-dialog";
import { MapboxAutocomplete, type MapboxPlace } from "./mapbox-autocomplete";
import { toTitleCase } from "@/lib/text-format";
import {
  EVENT_CREATE_DRAFT_STORAGE,
  EVENT_CREATE_DRAFT_VERSION,
  EVENT_CREATE_STORAGE_KEY,
} from "@/lib/event-create-storage";
import { CAPACITY_PATTERN, PRICE_PATTERN, sanitizeAmount } from "@/lib/amounts";
import { useFormDraft } from "@/lib/use-form-draft";
import { DURATION_OPTIONS } from "@/lib/event-duration";
import { scopedKey, useAccountScope } from "@/lib/account-scope";

// Create-event - multi-step wizard. Each step has its own URL so users can
// bookmark, link to, and browser-back through them:
//   /merchant/events/create           · redirects → /basics
//   /merchant/events/create/basics    · step 1 · what is this event
//   /merchant/events/create/schedule  · step 2 · when + how many
//   /merchant/events/create/location  · step 3 · where (Mapbox)
//   /merchant/events/create/media     · step 4 · photos (drop / paste / pick)
//   /merchant/events/create/review    · step 5 · review → Submit
//
// Form state lives in a React context provided by <EventCreateProvider>
// mounted inside the route's layout, so it persists across client-side
// navigation between sibling step pages (App Router keeps shared layouts
// mounted). Each step page renders <WizardShell step={n}> which surfaces the
// step indicator, validation messages, and Back / Next / Submit nav. Per-step
// validators run on Next; Submit re-runs all five and router.push()'es back to
// the offending step's URL.

type RecurrenceFreq = "none" | "weekly" | "fortnightly" | "monthly";

type WizardValues = {
  title: string;
  groupName: string;
  category: string;
  startsAt: string;
  // How long the event runs, in minutes. Combined with startsAt server-side to
  // set events.ends_at - without it every event silently defaulted to 2 hours.
  durationMinutes: string;
  capacity: string;
  locationName: string;
  suburb: string;
  // Full street address (e.g. "Unit 6/29 Bridge Rd, Stanmore NSW 2048"), shown
  // to confirmed attendees on the event page. Auto-filled from the Mapbox pick
  // but freely editable (units / level numbers Mapbox can't infer).
  address: string;
  // Captured from the Mapbox address autocomplete in the location step and
  // serialized alongside the rest of the form on submit.
  latitude: number | null;
  longitude: number | null;
  price: string;
  tags: string;
  relationshipGoal: string;
  description: string;
  // Ordered gallery captured in the Media step's drop / paste / file-picker
  // zone. Each entry is a public URL returned by /api/upload/event-image.
  // images[0] is the event cover (mirrored to events.image_url) and the rest
  // land in events.image_urls[]. See database/015_event_image_urls.sql.
  images: string[];
  imageAlt: string;
  // Recurrence is expanded client-side at submit time: WizardShell.submit()
  // POSTs one event per occurrence to /api/events. "none" submits a single row.
  recurrenceFreq: RecurrenceFreq;
  recurrenceCount: string;
};

// 0 = Basics, 1 = Schedule, 2 = Location, 3 = Media, 4 = Review.
export type StepIndex = 0 | 1 | 2 | 3 | 4;
const STEP_COUNT = 5;
const STEP_TITLES = ["Basics", "Schedule", "Location", "Media", "Review"] as const;
export const STEP_PATHS = [
  "/merchant/events/create/basics",
  "/merchant/events/create/schedule",
  "/merchant/events/create/location",
  "/merchant/events/create/media",
  "/merchant/events/create/review",
] as const;
// Endowed progress: already moving on step one, a big jump for clearing the two
// heavy steps (Basics + Schedule hold 13 of the 18 fields), and never 100 until
// the event actually exists.
const STEP_PCT = [24, 52, 72, 88, 96] as const;

// Wizard form state is held in React context (mounted in the route layout), so
// it survives client-side navigation between step pages. It does NOT survive a
// full page load - a refresh or a direct deep-link to a later step (e.g. opening
// /review on its own) starts a fresh context and resets to these defaults. To
// keep entered values across those reloads too, useFormDraft mirrors the state
// into sessionStorage and rehydrates from it on mount.
// Shared with the "Duplicate event" action, which seeds a prefilled draft into
// this same slot in the same { v, values } envelope (see
// src/lib/event-create-storage.ts). The key is scoped to the signed-in account
// by the hook - two hosts sharing a browser must not share a half-built event.

const initial: WizardValues = {
  title: "",
  groupName: "",
  category: "",
  startsAt: "",
  durationMinutes: "120",
  capacity: "12",
  locationName: "",
  suburb: "",
  address: "",
  latitude: null,
  longitude: null,
  price: "0",
  tags: "",
  relationshipGoal: "",
  description: "",
  images: [],
  imageAlt: "",
  recurrenceFreq: "none",
  recurrenceCount: "1",
};

/* One message per offending field rather than one message per attempt. The old
   validator returned a single string and bailed on the first failure, so a
   merchant with four empty fields got bounced four times, learning one
   requirement per attempt, from a paragraph down by the nav buttons that never
   said WHICH field it meant. */
type FieldErrors = Partial<Record<keyof WizardValues, string>>;

/* Insertion order below is DOM order within the step, and Object.keys preserves
   it for string keys - that is what makes "focus the first offender" land on the
   topmost one rather than an arbitrary field. */
function validateStep(step: StepIndex, v: WizardValues): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 0) {
    if (!v.title.trim()) errors.title = "Give the event a title.";
    if (!v.groupName.trim()) errors.groupName = "Add the group or host name.";
    // Category used to be seeded to categoryOptions[0] - alphabetically first,
    // so every event nobody touched published as "Career". It starts empty now,
    // which makes this the check that stops a wrong one going out.
    if (!v.category.trim()) errors.category = "Pick the category it belongs in.";
    if (!v.relationshipGoal.trim()) {
      errors.relationshipGoal = "Say why people should come - one line is plenty.";
    }
    if (!v.description.trim()) errors.description = "Add a short description.";
  }

  if (step === 1) {
    if (!v.startsAt) {
      errors.startsAt = "Pick a start date and time.";
    } else {
      const start = new Date(v.startsAt);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
        errors.startsAt = "Start time must be in the future.";
      }
    }
    if (v.recurrenceFreq !== "none") {
      const n = Number.parseInt(v.recurrenceCount, 10);
      if (!Number.isFinite(n) || n < 2 || n > 26) {
        errors.recurrenceCount = "Pick 2-26 occurrences for a repeating event.";
      }
    }
    // Whole seats only. The capacity input used to strip every non-digit, so
    // "1.5" silently became 15 - a 10x guest list nobody typed. The field now
    // keeps what was typed and this is what rejects it, so the merchant sees
    // their own value next to the reason it was refused.
    if (!CAPACITY_PATTERN.test(v.capacity.trim()) || Number.parseInt(v.capacity, 10) < 1) {
      errors.capacity = "Capacity must be a whole number of seats, e.g. 12.";
    }
    // Stripe runs in live mode, so a price that reads differently from what was
    // typed is a real charge on a real card. The same strip turned "12.50" into
    // "1250" and the Review card showed "$1250" as if it were intended. Both
    // patterns live in lib/amounts.ts alongside sanitizeAmount so the keystroke
    // handler and the validator can be tested together - tests/amounts.test.mjs.
    if (v.price.trim() && !PRICE_PATTERN.test(v.price.trim())) {
      errors.price = "Price must be a dollar amount, e.g. 12.50.";
    }
  }

  if (step === 2) {
    if (!v.locationName.trim()) errors.locationName = "Name the venue.";
    if (!v.suburb.trim()) errors.suburb = "Add the suburb.";
    // Require the full street address so confirmed attendees always get a
    // complete address (number, street, state, postcode) once the venue
    // unlocks - not just a suburb. Picking a Mapbox suggestion fills this with
    // the full formatted line; merchants can append a unit/level number.
    if (!v.address.trim()) errors.address = "Add the street address.";
  }

  if (step === 3) {
    // Media step is optional - when the merchant skips uploads we fall back
    // to a category-themed placeholder server-side, so there's nothing to
    // validate here.
  }

  return errors;
}

/** DOM id for a field's control, so validation can focus the one at fault. */
function fieldAnchorId(field: keyof WizardValues) {
  return `ce-field-${field}`;
}

/* sanitizeAmount (keep the digits and at most one decimal point, truncating
   extra places rather than rounding) now lives in lib/amounts.ts with the two
   patterns above. It moved out of this file for one reason: `node --test` cannot
   import a .tsx module, so the only money path in the wizard had no way to be
   covered. See tests/amounts.test.mjs. */

// ---------- date helpers (DateTimePicker + RecurrencePicker) ----------

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const QUICK_TIMES: Array<{ label: string; hour: number; minute: number }> = [
  { label: "5:00 PM", hour: 17, minute: 0 },
  { label: "6:00 PM", hour: 18, minute: 0 },
  { label: "6:30 PM", hour: 18, minute: 30 },
  { label: "7:00 PM", hour: 19, minute: 0 },
  { label: "7:30 PM", hour: 19, minute: 30 },
  { label: "8:00 PM", hour: 20, minute: 0 },
];
const FREQ_OPTIONS: Array<{ value: RecurrenceFreq; label: string; hint: string }> = [
  { value: "none", label: "Just once", hint: "Single event." },
  { value: "weekly", label: "Weekly", hint: "Same weekday + time every 7 days." },
  { value: "fortnightly", label: "Fortnightly", hint: "Every 14 days." },
  { value: "monthly", label: "Monthly", hint: "Same date each month." },
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addMonths(d: Date, n: number) {
  const next = new Date(d);
  next.setMonth(next.getMonth() + n);
  return next;
}

// startsAt is stored in the same shape an <input type="datetime-local"> emits
// (YYYY-MM-DDTHH:MM, local wall-clock). Parse it back into discrete pieces the
// calendar grid + time controls can work with.
function parseLocalDateTime(
  value: string,
): { date: Date; hour: number; minute: number } | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) {
    return {
      date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
      hour: Number(m[4]),
      minute: Number(m[5]),
    };
  }
  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) return null;
  return {
    date: startOfDay(fallback),
    hour: fallback.getHours(),
    minute: fallback.getMinutes(),
  };
}

function formatLocalDateTimeString(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(hour)}:${pad2(minute)}`;
}

/** Short human label for one occurrence's datetime-local string, e.g. "Sat 6 Sep". */
function occurrenceLabel(startsAt: string) {
  const parsed = parseLocalDateTime(startsAt);
  if (!parsed) return startsAt;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parsed.date);
}

// Returns one Date per occurrence. "none" → just the start. Capped at 26 to
// match validateStep so a typo can't blow up the queue.
function computeOccurrenceDates(
  startsAt: string,
  freq: RecurrenceFreq,
  count: number,
): Date[] {
  const parsed = parseLocalDateTime(startsAt);
  if (!parsed) return [];
  const base = new Date(
    parsed.date.getFullYear(),
    parsed.date.getMonth(),
    parsed.date.getDate(),
    parsed.hour,
    parsed.minute,
  );
  if (freq === "none") return [base];
  const n = Math.max(1, Math.min(26, count));
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    if (freq === "weekly") d.setDate(d.getDate() + 7 * i);
    else if (freq === "fortnightly") d.setDate(d.getDate() + 14 * i);
    else if (freq === "monthly") d.setMonth(d.getMonth() + i);
    out.push(d);
  }
  return out;
}

// ---------- partial-submit retry ----------

/**
 * A recurring event is created one POST per occurrence. When some of them fail,
 * the wizard arms a retry with EXACTLY the dates that did not land, so pressing
 * Submit again cannot duplicate the ones that already published.
 *
 * That arm used to be `useState` inside WizardShell, and WizardShell REMOUNTS on
 * every step route (its own comment says so). So the moment a host followed a
 * Review "Edit" link to fix whatever the server rejected - the most likely next
 * move after a partial failure - the arm was destroyed, Submit went back to
 * creating ALL of them, and the occurrences that had already published were
 * created a second time. On a paid event that is a duplicate live listing per
 * date, each one able to take real money.
 *
 * So it lives on the provider, which is mounted in the create layout and
 * survives every step change, and it is mirrored to storage so a reload or a
 * closed tab cannot lose it either. The schedule it belongs to is stored with
 * it: an arm is only valid for the exact start / frequency / count that
 * produced it, and any edit to those means a different set of occurrences.
 */
type RetryArm = { scheduleKey: string; dates: string[] };

const RETRY_ARM_KEY = "click:event-create-retry:v1";
const RETRY_ARM_VERSION = 1;

function useRetryArm() {
  const [retryArm, setRetryArm] = useState<RetryArm | null>(null);
  const scope = useAccountScope();
  const key = scopedKey(scope, RETRY_ARM_KEY);
  // Storage is read in an effect, never in a useState initializer: browser
  // storage does not exist on the server, so lazy-initialising from it makes the
  // server render and the first client render disagree. Same rule, and the same
  // reason, as useFormDraft.
  const hydratedRef = useRef(false);

  useEffect(() => {
    // rAF-gated for the same reason useFormDraft gates its own read: it pushes
    // the state write past the commit of the server-matched first paint, so the
    // restored arm lands as a change to an already-hydrated tree instead of
    // racing it.
    const frame = window.requestAnimationFrame(() => {
      hydratedRef.current = true;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          v?: number;
          scheduleKey?: string;
          dates?: string[];
        };
        if (
          parsed.v !== RETRY_ARM_VERSION ||
          typeof parsed.scheduleKey !== "string" ||
          !Array.isArray(parsed.dates) ||
          parsed.dates.length === 0 ||
          !parsed.dates.every((d) => typeof d === "string")
        ) {
          window.localStorage.removeItem(key);
          return;
        }
        setRetryArm({ scheduleKey: parsed.scheduleKey, dates: parsed.dates });
      } catch {
        // Private mode, quota, a corrupt value. Losing the arm degrades to "the
        // retry re-creates everything", which is exactly where we started, so it
        // is never worth throwing into the wizard over.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  const armRetry = useCallback(
    (arm: RetryArm | null) => {
      setRetryArm(arm);
      // Guarded on the read having happened: writing before it would clobber a
      // saved arm with the initial null on the very first commit.
      if (!hydratedRef.current) return;
      try {
        if (arm) {
          window.localStorage.setItem(
            key,
            JSON.stringify({ v: RETRY_ARM_VERSION, ...arm }),
          );
        } else {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Same reasoning as the read.
      }
    },
    [key],
  );

  return { retryArm, armRetry };
}

// ---------- context ----------

type WizardContextValue = {
  values: WizardValues;
  setValues: Dispatch<SetStateAction<WizardValues>>;
  set: <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => void;
  categoryOptions: string[];
  tagOptions: string[];
  // Suggestions for the Basics step's group/host-name combobox and the Location
  // step's venue combobox - derived server-side from the merchant's profile and
  // past events. Both fields stay freetext; these just save retyping.
  hostNameOptions: string[];
  venueOptions: string[];
  // Whether the merchant has finished Stripe Connect. Creating events no longer
  // requires it (free events publish fine), but a PAID event can't be approved
  // until payouts are live - the Schedule step's price field says so rather than
  // letting the merchant find out from an admin rejection.
  chargesEnabled: boolean;
  // Whether payouts are live too. The publish gate needs BOTH: charges on with
  // payouts off still cannot go live, because we could take the money and not
  // pass it on.
  payoutsEnabled: boolean;
  // Whether an admin has already approved one of this host's events, so new
  // ones skip the review queue (merchant_profiles.auto_approve_events). The
  // Review step's card preview needs it to stop stamping "Pending review" on an
  // event that will be on Discover the moment they press submit.
  autoApproveEvents: boolean;
  // Click's cut of a paid ticket, in basis points (PLATFORM_FEE_BPS, read
  // server-side in the route layout). The Schedule step spends it on one line of
  // "you'll receive $X" - a merchant should never learn the take rate from
  // their first payout.
  platformFeeBps: number;
  stepError: string | null;
  setStepError: Dispatch<SetStateAction<string | null>>;
  // Per-field validation messages for the step currently on screen. Each step
  // section reads its own keys and hands them to FormField's `error` slot, so
  // the message sits under the control it is about.
  fieldErrors: FieldErrors;
  setFieldErrors: Dispatch<SetStateAction<FieldErrors>>;
  // True when the mount rehydrate actually applied a saved draft - either the
  // merchant's own unfinished one or a "Duplicate event" seed. Without this the
  // wizard silently opens full of last month's event with no explanation.
  restoredDraft: boolean;
  discardDraft: () => void;
  // Drops the saved draft WITHOUT touching the form on screen. WizardShell calls
  // it on the success branch of submit, once every occurrence has published -
  // never before, or a partial failure leaves the dates that failed with nothing
  // to retry from.
  clearDraft: () => void;
  // Mutable, NOT state: WizardShell remounts on every step route, so a piece of
  // state would reset with it. The provider lives in the layout and survives, so
  // the flag rides here and tells the freshly-mounted shell whether it arrived
  // by navigation (move focus) or by first load (leave focus alone).
  navigatedRef: React.MutableRefObject<boolean>;
  // Which step the messages currently in `fieldErrors` / `stepError` were raised
  // for. Also mutable-not-state, and for the same reason. Only goNext and goBack
  // used to clear them, so jumping via the stepper carried "3 things still need
  // a moment" onto a step none of them were about.
  errorStepRef: React.MutableRefObject<StepIndex | null>;
  // Set by a Review "Edit" link before it navigates, read by the shell that
  // mounts on the step it lands on, which then offers a one-tap way back to
  // Review. State, NOT a ref like the two above: this one decides what the step
  // renders, and a ref read during render is the thing React warns about. It
  // survives the route change because the provider is mounted in the layout.
  fromReview: boolean;
  setFromReview: Dispatch<SetStateAction<boolean>>;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  // The occurrences of a recurring event that did NOT get created, and the
  // schedule they belong to. It rides HERE, on the provider, and is mirrored to
  // storage - see useRetryArm below for why both.
  retryArm: RetryArm | null;
  armRetry: (arm: RetryArm | null) => void;
  // True while the Media step has one or more image uploads in flight. Set by
  // MediaSection, read by WizardShell to block "Next" until uploads settle so
  // a merchant can't advance with half-uploaded photos.
  uploading: boolean;
  setUploading: Dispatch<SetStateAction<boolean>>;
};

const WizardContext = createContext<WizardContextValue | null>(null);

function useWizard(): WizardContextValue {
  const value = useContext(WizardContext);
  if (!value) {
    throw new Error(
      "useWizard must be used inside <EventCreateProvider> (mounted in src/app/merchant/events/create/layout.tsx)",
    );
  }
  return value;
}

export function EventCreateProvider({
  categoryOptions,
  tagOptions = [],
  hostNameOptions = [],
  venueOptions = [],
  chargesEnabled = false,
  payoutsEnabled = false,
  autoApproveEvents = false,
  platformFeeBps = 0,
  children,
}: {
  categoryOptions: string[];
  tagOptions?: string[];
  hostNameOptions?: string[];
  venueOptions?: string[];
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  autoApproveEvents?: boolean;
  platformFeeBps?: number;
  children: React.ReactNode;
}) {
  // NO category seed. This used to be `categoryOptions[0]`, and the options come
  // back `order by name asc`, so every event a merchant didn't think to change
  // published as "Career" - with no Category row on Review to catch it either.
  // Empty + required + a placeholder option is the whole fix.
  const [values, setValues] = useState<WizardValues>(() => ({ ...initial }));
  const [stepError, setStepError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { retryArm, armRetry } = useRetryArm();
  const navigatedRef = useRef(false);
  const errorStepRef = useRef<StepIndex | null>(null);
  const [fromReview, setFromReview] = useState(false);

  // Draft persistence is the shared useFormDraft hook, same as every other long
  // form in the app: it reads inside an effect (never a useState initializer, or
  // server and first client render disagree and React throws a hydration
  // mismatch), rAF-gates the apply past first paint, and namespaces the key per
  // account so two hosts sharing a browser cannot see each other's half-built
  // event.
  //
  // This used to be a hand-rolled pair of effects, because the hook stores a
  // versioned { v, values } envelope while "Duplicate event" wrote a BARE values
  // object into the same slot - adopting the envelope on one side only would
  // have made every duplicate look like a stale draft. Both sides now stamp
  // EVENT_CREATE_DRAFT_VERSION. A bare draft left over from the previously
  // deployed duplicate button has no `v`, so the hook removes it and the wizard
  // opens empty: discarding it whole beats half-applying a shape we cannot
  // verify into a form the merchant is about to publish for money.
  const { restored, clear: clearDraft } = useFormDraft<WizardValues>({
    key: EVENT_CREATE_STORAGE_KEY,
    version: EVENT_CREATE_DRAFT_VERSION,
    // localStorage, not session: a half-built event is 15+ fields of work and
    // sessionStorage threw it away when the tab closed. The key is already
    // namespaced per account by the hook, so a shared browser still can't
    // surface one host's draft to another, and "Start over" clears it outright.
    // Imported, not literal - the duplicate button writes this same slot by
    // hand and the two must not drift.
    storage: EVENT_CREATE_DRAFT_STORAGE,
    values,
    apply: (saved) => setValues((v) => ({ ...v, ...saved })),
  });

  // Counts "Start over" presses. Two jobs: it retires the restored-draft note
  // (the hook's own `restored` latches for the life of the mount and knows
  // nothing about the merchant throwing the draft away), and it sequences the
  // clear - see the effect below.
  const [discardCount, setDiscardCount] = useState(0);
  const restoredDraft = restored && discardCount === 0;

  const set = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Editing a field retires its error. Leaving it up while the merchant fixes
    // the value is how a form starts reading as broken rather than picky.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // "Start over" from the restored-draft note. Irreversible, so WizardShell puts
  // a ConfirmDialog in front of it. Only the in-memory reset happens here; the
  // storage clear is deferred one commit, below.
  const discardDraft = () => {
    setValues({ ...initial });
    setFieldErrors({});
    setStepError(null);
    errorStepRef.current = null;
    // The arm belongs to the schedule that is being thrown away. Leaving it
    // behind would let a brand-new event inherit "only create these 3 dates".
    armRetry(null);
    setDiscardCount((n) => n + 1);
  };

  // The clear has to land AFTER the emptied form has been committed, not with
  // it. useFormDraft's clear() snapshots the values as they are at the call and
  // suppresses writes only while they stay identical, so clearing first would
  // key that window to the draft we are throwing away, the reset would read as a
  // genuine edit, and the empty form would be written straight back as a fresh
  // draft - the merchant reloads and is told "picked up where you left off" over
  // a blank wizard. Running it in an effect puts it after the hook's own write
  // effect for this render, so the removeItem is the last word.
  useEffect(() => {
    if (discardCount === 0) return;
    clearDraft();
  }, [discardCount, clearDraft]);

  return (
    <WizardContext.Provider
      value={{
        values,
        setValues,
        set,
        categoryOptions,
        tagOptions,
        hostNameOptions,
        venueOptions,
        chargesEnabled,
        payoutsEnabled,
        autoApproveEvents,
        platformFeeBps,
        stepError,
        setStepError,
        fieldErrors,
        setFieldErrors,
        restoredDraft,
        discardDraft,
        clearDraft,
        navigatedRef,
        errorStepRef,
        fromReview,
        setFromReview,
        submitting,
        setSubmitting,
        retryArm,
        armRetry,
        uploading,
        setUploading,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

// ---------- wizard shell ----------

export function WizardShell({
  step,
  children,
}: {
  step: StepIndex;
  children: React.ReactNode;
}) {
  const {
    values,
    chargesEnabled,
    payoutsEnabled,
    autoApproveEvents,
    stepError,
    setStepError,
    setFieldErrors,
    restoredDraft,
    discardDraft,
    clearDraft,
    navigatedRef,
    errorStepRef,
    fromReview,
    setFromReview,
    submitting,
    setSubmitting,
    retryArm,
    armRetry,
    uploading,
  } = useWizard();
  const router = useRouter();
  const isLast = step === STEP_COUNT - 1;
  // Same gate as createEventForMerchant and the Review card: a trusted host
  // publishes straight to Discover, so the button must not say "Submit for
  // review" and then put the event live. A paid ticket still needs Connect
  // finished (charges AND payouts); a free one needs neither.
  const publishesImmediately =
    autoApproveEvents &&
    (Math.round((Number.parseFloat(values.price) || 0) * 100) === 0 ||
      (chargesEnabled && payoutsEnabled));
  // Which steps genuinely hold valid input, so the stepper's ticks mean
  // something. Deep-linking to /review used to paint four green ticks over an
  // empty event because "done" was inferred from position alone.
  const completedSteps = useMemo(
    () =>
      STEP_TITLES.map(
        (_, i) => Object.keys(validateStep(i as StepIndex, values)).length === 0,
      ),
    [values],
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const stepBodyRef = useRef<HTMLDivElement>(null);
  // Set by a Review "Edit" link; cleared by goNext, goBack and backToReview, so
  // it only stays true while the host is on the detour it describes.
  const cameFromReview = fromReview;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // How many occurrence POSTs have finished, out of how many the submit will
  // make. Null until submit starts, so the bar only exists during the wait.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  // A retry arm is only valid for the schedule it came from. Editing the start,
  // the frequency or the count means a different set of occurrences, so the arm
  // is dropped and Submit goes back to creating all of them. The comparison is
  // against the arm's OWN stored schedule rather than a ref, because the arm now
  // outlives this component - a ref here would be null again on the very step
  // change this guard exists to survive.
  const scheduleKey = `${values.startsAt}|${values.recurrenceFreq}|${values.recurrenceCount}`;
  const retryDates =
    retryArm && retryArm.scheduleKey === scheduleKey ? retryArm.dates : null;
  useEffect(() => {
    if (retryArm && retryArm.scheduleKey !== scheduleKey) armRetry(null);
  }, [retryArm, scheduleKey, armRetry]);

  // Each step is its own route, so this shell REMOUNTS on every Next / Back and
  // focus falls back to <body>. Move it to the top of the new step body - which
  // sits immediately before that step's <h1> - but only when we got here by
  // navigating, never on the first load of the wizard (stealing focus from a
  // page the merchant just opened is worse than not moving it).
  useEffect(() => {
    if (!navigatedRef.current) return;
    navigatedRef.current = false;
    // preventScroll, then scroll ourselves. focus()'s own scroll ignores
    // scroll-margin-top on the focused element, so the step's <h1> landed
    // ~20px up behind the sticky site header on every Next / Back.
    stepBodyRef.current?.focus({ preventScroll: true });
    stepBodyRef.current?.scrollIntoView({ block: "start" });
  }, [navigatedRef]);

  // Validation messages belong to the step that raised them. Arriving at a
  // DIFFERENT step - via the stepper, a Review "Edit" link, or the back button,
  // none of which route through goNext/goBack - used to carry "3 things still
  // need a moment" onto a step none of them were about. The submit path sets
  // errorStepRef to the step it is bouncing to, so its messages survive.
  useEffect(() => {
    if (errorStepRef.current === step) return;
    errorStepRef.current = null;
    setStepError(null);
    setFieldErrors({});
  }, [step, errorStepRef, setStepError, setFieldErrors]);

  /**
   * Shared by goNext and submit: mark every offending field and say how many.
   * `focusFirst` is false on the submit path, where we are about to route to
   * another step - the focus would land on a control that is being unmounted,
   * and the remount effect above moves focus to the new step body anyway.
   */
  function showFieldErrors(
    errors: FieldErrors,
    {
      stepLabel,
      focusFirst,
      forStep = step,
    }: { stepLabel?: string; focusFirst: boolean; forStep?: StepIndex },
  ) {
    const keys = Object.keys(errors) as Array<keyof WizardValues>;
    // Stamp which step these belong to BEFORE the route change, so the shell
    // that mounts on the offending step keeps them instead of clearing them.
    errorStepRef.current = forStep;
    setFieldErrors(errors);
    const summary =
      keys.length === 1
        ? (errors[keys[0]] as string)
        : `${keys.length} things still need a moment${stepLabel ? ` on ${stepLabel}` : ""} - they're marked below.`;
    setStepError(summary);
    toast.error(summary);
    if (!focusFirst) return;
    // Land the merchant ON the offending control. The old version scrolled the
    // summary paragraph by the nav buttons into view, which said something was
    // wrong but never where (bug board #210).
    requestAnimationFrame(() => {
      const first = document.getElementById(fieldAnchorId(keys[0]));
      const target = first ?? errorRef.current;
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function goNext() {
    if (uploading) {
      toast.error("Hang on - your photos are still uploading.");
      return;
    }
    const errors = validateStep(step, values);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors, { focusFirst: true });
      return;
    }
    setFieldErrors({});
    setStepError(null);
    errorStepRef.current = null;
    navigatedRef.current = true;
    setFromReview(false);
    router.push(STEP_PATHS[step + 1]);
  }

  function goBack() {
    // The same guard goNext carries. MediaSection holds its in-flight tiles in
    // its own state and only mirrors FINISHED uploads into values.images, so
    // leaving the Media step while photos are still going unmounts them: not
    // failed, not retried, just gone, with nothing said. goNext and the stepper
    // both refused; Back and Exit did not.
    if (uploading) {
      toast.error("Hang on - your photos are still uploading.");
      return;
    }
    if (step > 0) {
      setStepError(null);
      errorStepRef.current = null;
      navigatedRef.current = true;
      setFromReview(false);
      router.push(STEP_PATHS[step - 1]);
    }
  }

  // The one-tap way out of a Review "Edit" detour. Validates the step first, so
  // a host cannot carry a half-fixed field back to Review and submit it - the
  // same rule Next enforces, just with a different destination.
  function backToReview() {
    if (uploading) {
      toast.error("Hang on - your photos are still uploading.");
      return;
    }
    const errors = validateStep(step, values);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors, { focusFirst: true });
      return;
    }
    setFieldErrors({});
    setStepError(null);
    errorStepRef.current = null;
    navigatedRef.current = true;
    setFromReview(false);
    router.push(STEP_PATHS[STEP_COUNT - 1]);
  }

  async function submit() {
    // Re-run every step's validation on final submit - guards against a user
    // editing an earlier step after passing it, or deep-linking past one.
    for (let s = 0; s < STEP_COUNT; s++) {
      const errors = validateStep(s as StepIndex, values);
      if (Object.keys(errors).length > 0) {
        showFieldErrors(errors, {
          stepLabel: STEP_TITLES[s],
          focusFirst: false,
          forStep: s as StepIndex,
        });
        navigatedRef.current = true;
        router.push(STEP_PATHS[s]);
        return;
      }
    }

    setSubmitting(true);
    setStepError(null);
    setFieldErrors({});
    try {
      // Expand recurrence client-side: one POST per occurrence. "none" yields
      // a single-element array so the loop is the only path.
      const occurrences = computeOccurrenceDates(
        values.startsAt,
        values.recurrenceFreq,
        Number.parseInt(values.recurrenceCount, 10) || 1,
      );
      // retryDates is set only by the partial-failure branch below: it holds the
      // occurrences that did NOT get created, so a retry re-POSTs those and
      // nothing else. Without it, pressing Submit again after a partial failure
      // duplicated every occurrence that had already succeeded.
      const startsAtList =
        retryDates ??
        (occurrences.length
          ? occurrences.map((d) =>
              formatLocalDateTimeString(d, d.getHours(), d.getMinutes()),
            )
          : [values.startsAt]);

      let okCount = 0;
      // The DATE that failed, not just the reason. "3 failed - retry from the
      // merchant dashboard" told a merchant neither which three of their 26
      // occurrences were missing nor where on the dashboard to do anything
      // about it.
      const failures: Array<{ startsAt: string; date: string; reason: string }> = [];
      let firstTitle: string | undefined;
      // Whether the created event(s) went straight live (trusted / auto-approved
      // merchant) vs landed in the pending review queue - drives the toast copy.
      let firstStatus: string | undefined;

      // Indexed rather than for-of purely so the bar below can say which
      // occurrence is in flight. The order, the awaits and the one-POST-at-a-time
      // shape are unchanged - a fortnightly x26 event is still 26 serial
      // round-trips, it just stops looking like a hung button.
      setProgress({ done: 0, total: startsAtList.length });
      for (let i = 0; i < startsAtList.length; i++) {
        const startsAt = startsAtList[i];
        setProgress({ done: i, total: startsAtList.length });
        const form = new FormData();
        form.set("title", values.title);
        form.set("groupName", values.groupName);
        form.set("category", values.category);
        form.set("startsAt", startsAt);
        form.set("durationMinutes", values.durationMinutes);
        form.set("capacity", values.capacity);
        form.set("locationName", values.locationName);
        form.set("suburb", values.suburb);
        form.set("address", values.address);
        if (values.latitude !== null && values.longitude !== null) {
          form.set("latitude", String(values.latitude));
          form.set("longitude", String(values.longitude));
        }
        form.set("price", values.price);
        form.set("tags", values.tags);
        form.set("relationshipGoal", values.relationshipGoal);
        form.set("description", values.description);
        // Multi-photo gallery from the Media step - one append per URL so the
        // server gets the full ordered list via formData.getAll("imageUrls").
        for (const url of values.images) {
          if (url) form.append("imageUrls", url);
        }
        // Mirror the first photo into imageUrl for older code paths that still
        // read a single cover; the server prefers imageUrls when both are set.
        if (values.images[0]) form.set("imageUrl", values.images[0]);
        if (values.imageAlt) form.set("imageAlt", values.imageAlt);

        const response = await fetch("/api/events", { method: "POST", body: form });

        if (response.status === 401) {
          window.location.href =
            "/merchant/login?callbackUrl=/merchant/events/create";
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          event?: { title?: string; status?: string };
          error?: string;
          redirect?: string;
        };
        if (!response.ok) {
          // Server can hand us a follow-up URL (e.g. MerchantSignupRequired →
          // /merchant/signup). Toast the reason and navigate there - every
          // queued occurrence shares the same root cause, so there's nothing
          // useful to retry until the merchant finishes the step the server
          // pointed them at. (Paid events no longer gate on payout setup - the
          // event sits in pending for admin review regardless.)
          if (payload.redirect) {
            const msg = payload.error ?? "Action needed before publishing.";
            toast.error(msg);
            window.location.href = payload.redirect;
            return;
          }
          failures.push({
            startsAt,
            date: occurrenceLabel(startsAt),
            reason: payload.error ?? "Submission failed.",
          });
          continue;
        }
        okCount++;
        firstTitle = firstTitle ?? payload.event?.title;
        firstStatus = firstStatus ?? payload.event?.status;
      }

      if (okCount === 0) {
        const msg = failures[0]?.reason ?? "Submission failed.";
        setStepError(msg);
        errorStepRef.current = step;
        toast.error(msg);
        return;
      }

      const label = firstTitle ?? values.title ?? "Event";
      // Trusted merchants (auto-approve on) publish straight to live - congratulate
      // them instead of saying it's "submitted for admin review", which reads as a
      // contradiction of the trust they were just granted (bug board #180).
      const liveNow =
        firstStatus === "live" || firstStatus === "featured" || firstStatus === "Live";
      if (failures.length > 0) {
        // PARTIAL FAILURE - stay put. Navigating to the dashboard (as both
        // branches used to) took the merchant away from the only screen that
        // knew which dates were missing, and the ones that DID publish were
        // invisible from here, so the honest thing was a hidden success and an
        // unnamed failure at once. Name both, keep the draft, don't move.
        const dates = failures.map((f) => f.date).join(", ");
        const reasons = Array.from(new Set(failures.map((f) => f.reason)));
        // Arm the retry with EXACTLY the dates that failed, so pressing the
        // button again cannot duplicate the ones that already published.
        armRetry({ scheduleKey, dates: failures.map((f) => f.startsAt) });
        setStepError(
          `${okCount} of ${startsAtList.length} dates were created and are safe on your events tab. These were not: ${dates}. ${reasons.join(" ")} The button below now retries only the missing dates.`,
        );
        errorStepRef.current = step;
        toast.error(`${failures.length} of ${startsAtList.length} dates failed`, {
          description: dates,
        });
        return;
      }
      armRetry(null);

      // Only a clean sweep drops the saved draft. Clearing it before the
      // partial-failure branch above (as this used to) left the dates that
      // failed with nothing to retry from. clearDraft is useFormDraft's clear()
      // - it swallows a blocked storage write itself, so nothing to catch here.
      clearDraft();
      toast.success(
        liveNow
          ? startsAtList.length === 1
            ? `🎉 ${label} is live - members can find it on Discover now.`
            : `🎉 ${okCount} occurrences of ${label} are live on Discover.`
          : startsAtList.length === 1
            ? `${label} submitted for admin review.`
            : `${okCount} occurrences of ${label} submitted for admin review.`,
      );
      router.push("/merchant?tab=events");
      router.refresh();
    } catch {
      const msg = "Submission failed. Check your connection.";
      setStepError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      {/* Bar above dots: the bar answers "how far in am I", the dots answer
          "which part am I on". PCT is weighted to the real work rather than
          evenly - Basics carries 7 fields and 4 of the 9 required, Review
          carries none - so the back half doesn't feel like it stalled. */}
      <div className="space-y-3.5 border-b border-[color:var(--mist)] px-5 py-4">
        <EndowedProgress step={step} total={STEP_COUNT} pct={STEP_PCT[step]} />
        <WizardStepper
          steps={STEP_TITLES}
          current={step}
          // Links go dead while photos are in flight: the stepper was the one
          // way out of the Media step that goNext's upload guard never saw, and
          // leaving mid-upload unmounts the tiles that were still uploading.
          paths={uploading ? undefined : STEP_PATHS}
          completed={completedSteps}
        />
      </div>

      {/* scroll-mt clears the sticky site header plus a
          little air - focus()'s scroll does not honour it, so the effect above
          calls scrollIntoView, which does. */}
      <div
        ref={stepBodyRef}
        tabIndex={-1}
        className="space-y-5 scroll-mt-[calc(var(--header-h)+8px)] p-6 outline-none"
      >
        {/* A restored draft used to arrive silently, which is worst on the
            "Duplicate event" path - the merchant opens Create event and finds it
            already full of last month's event with no explanation. */}
        {restoredDraft && step === 0 ? (
          <InfoNote icon="info">
            Picked up where you left off - your last draft is filled in below.{" "}
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="font-semibold text-[color:var(--purple)] underline underline-offset-2"
            >
              Start over
            </button>
          </InfoNote>
        ) : null}

        {children}

        {stepError ? (
          <p
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl bg-[color:var(--danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--danger)] outline-none"
          >
            {stepError}
          </p>
        ) : null}

        {/* The arm outlives this component now; the stepError that explained it
            does not - it is cleared the moment the host lands on a different
            step. Without this the most likely journey after a partial failure
            (Edit the field the server rejected, come back) ended on a button
            reading "Retry 3 dates" with nothing on screen saying which three,
            or why the other 23 were not going to be created again. Amber on a
            note, never on the button. */}
        {retryDates && !stepError ? (
          <div
            role="status"
            className="rounded-xl border border-[color-mix(in_srgb,var(--amber)_38%,transparent)] bg-[color-mix(in_srgb,var(--amber)_9%,var(--paper))] px-4 py-3"
          >
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {retryDates.length} {retryDates.length === 1 ? "date" : "dates"} still
              to create.
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-soft)]">
              The rest of this series is already on your events tab. Submitting
              again creates only {retryDates.map(occurrenceLabel).join(", ")}.
            </p>
          </div>
        ) : null}

        {/* The submit fires one POST per occurrence, serially, and can take a
            while. Without a counter the merchant cannot tell a working submit
            from a hung one, and the natural response - reload - leaves half the
            occurrences created. */}
        {/* aria-live: the Submit button goes `disabled` the moment this appears,
            which drops keyboard focus to <body>. Announcing the progress is what
            replaces the context that focus loss took away. */}
        <div aria-live="polite" aria-atomic="true">
          {progress ? (
            <EndowedProgress
              step={progress.done}
              total={progress.total}
              label={
                progress.total === 1
                  ? "Creating your event…"
                  : `Creating ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              }
              className="rise-soft"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || submitting}
              // aria-disabled for the uploading case, not `disabled`: a real
              // disabled button never dispatches a click, which would make
              // goBack's explanation unreachable - the same reasoning as Next.
              aria-disabled={uploading || undefined}
              className="ck-btn ck-btn--secondary ck-btn--md aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            >
              ← Back
            </button>
            {/* A wizard with no exit is how a half-built event ends in a
                force-quit. But "Save & exit" oversold it: the draft is in
                localStorage, NOT on the server, so it does not follow the host
                to their phone or survive a cleared browser - and "saved" is
                exactly the word that makes someone assume it does. Say where it
                is kept instead. */}
            <Link
              href="/merchant?tab=events"
              title="Your answers stay in this browser until you submit"
              // Third and last way out of the Media step that could take
              // in-flight uploads with it. preventDefault rather than a
              // disabled-looking link: the exit is legitimate, it just has to
              // wait the few seconds the uploads need.
              onClick={(e) => {
                if (!uploading) return;
                e.preventDefault();
                toast.error("Hang on - your photos are still uploading.");
              }}
              aria-disabled={uploading || undefined}
              className="text-sm font-semibold text-[color:var(--slate)] underline underline-offset-2 hover:text-[color:var(--purple)] aria-disabled:opacity-60"
            >
              Exit - kept in this browser
            </Link>
          </div>
          {!isLast && cameFromReview ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* Next stays reachable, just quieter: the host came here from
                  Review to change one thing, so "back to Review" is the action
                  and "keep going" is the exception. */}
              <button
                type="button"
                onClick={goNext}
                aria-disabled={uploading || undefined}
                className="ck-btn ck-btn--secondary ck-btn--md aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={backToReview}
                aria-disabled={uploading || undefined}
                aria-busy={uploading || undefined}
                className="ck-btn ck-btn--primary ck-btn--md aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Done - back to review"}
              </button>
            </div>
          ) : isLast ? (
            <button
              type="button"
              onClick={submit}
              // Genuinely must not double-fire: a second click is a second set
              // of live-Stripe events. This is the one place `disabled` earns it.
              disabled={submitting}
              className="ck-btn ck-btn--primary ck-btn--md"
            >
              {submitting
                ? "Submitting…"
                : retryDates
                  ? `Retry ${retryDates.length} ${retryDates.length === 1 ? "date" : "dates"}`
                  : publishesImmediately
                    ? "Publish event"
                    : "Submit for review"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              // aria-disabled, NOT disabled: a disabled button never dispatches a
              // click, which made goNext's "photos are still uploading" toast
              // unreachable and dropped keyboard users out of the tab order with
              // no explanation. goNext still refuses to advance.
              aria-disabled={uploading || undefined}
              aria-busy={uploading || undefined}
              className="ck-btn ck-btn--primary ck-btn--md aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Next →"}
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Start over?"
        description="This clears the draft that was filled in and gives you an empty form. It can't be undone."
        confirmLabel="Start over"
        cancelLabel="Keep the draft"
        onConfirm={() => {
          setConfirmDiscard(false);
          discardDraft();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

/* StepIndicator and the local Field / inputClass() used to live here. All three
   are gone: the stepper is merchant-ds.tsx's WizardStepper (which links ONLY
   completed steps, so nobody lands on a Review card reading "Untitled event"),
   and the field chrome is ds.tsx's FormField over the .ck-input class - which is
   also what gives every control here an `error` slot. */

// Max tags the merchant can attach. Mirrors the server-side `.slice(0, 8)` in
// createEventForMerchant so the UI can't promise more than the backend keeps.
const MAX_TAGS = 8;

// The TagPicker's search box. Fixed rather than generated because ds.tsx is
// hook-free (it renders on the server too), so FormField cannot mint an id of
// its own to hand its label - and there is only ever one tag picker on screen.
const TAG_SEARCH_ID = "ce-tag-search";

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Tag input backed by a comma-separated string (the wizard's `values.tags`).
// Merchants search the admin-curated `options` list and click to add as pills.
// Tags are "click tags" - never free-form: only labels present in `options` can
// be added, so a merchant cannot mint a new tag. Picking from the list keeps tag
// spelling consistent with the tags users hold on their profiles, which is
// what powers matching. Selected tags render as removable pills; the serialised
// comma string is handed back through `onChange` so the submit path is unchanged.
function TagPicker({
  value,
  options,
  onChange,
  id,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  /** id of the search input, so the wrapping FormField's label can point at it. */
  id?: string;
}) {
  const [query, setQuery] = useState("");

  const selected = useMemo(() => parseTags(value), [value]);
  const selectedKeys = useMemo(
    () => new Set(selected.map((t) => t.toLowerCase())),
    [selected],
  );
  // Canonical label for each allowed option, keyed by lowercase, so we can both
  // reject non-list input and normalise spelling/casing to the curated label.
  const optionByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of options) map.set(opt.toLowerCase(), opt);
    return map;
  }, [options]);
  const atLimit = selected.length >= MAX_TAGS;

  // All available (unselected) tags matching the search box - rendered as a
  // browsable, clickable chip cloud so merchants can discover existing tags
  // without having to guess search terms.
  const browsable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((opt) => !selectedKeys.has(opt.toLowerCase()))
      .filter((opt) => (q ? opt.toLowerCase().includes(q) : true));
  }, [options, selectedKeys, query]);

  const suggestions = browsable;

  const commit = (next: string[]) => onChange(next.join(", "));

  const addTag = (raw: string) => {
    if (atLimit) return;
    // Click tags only: reject anything that isn't an exact (case-insensitive)
    // match for a curated option. No free-form tags reach `onChange`.
    const canonical = optionByKey.get(raw.trim().toLowerCase());
    if (!canonical) return;
    if (selectedKeys.has(canonical.toLowerCase())) {
      setQuery("");
      return;
    }
    commit([...selected, canonical]);
    setQuery("");
  };

  const removeTag = (tag: string) =>
    commit(selected.filter((t) => t.toLowerCase() !== tag.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Enter commits the top suggestion (a curated tag), never the raw text.
      e.preventDefault();
      if (suggestions.length > 0) addTag(suggestions[0]);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      removeTag(selected[selected.length - 1]);
    }
  };

  return (
    <div className="grid gap-2">
      {/* Adding or removing a tag re-renders the cloud under the pointer and
          says nothing. One polite live region covers both directions. */}
      <p aria-live="polite" className="sr-only">
        {selected.length === 0
          ? "No tags selected"
          : `${selected.length} of ${MAX_TAGS} tags selected: ${selected.join(", ")}`}
      </p>
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <li key={tag.toLowerCase()}>
              <span className="ck-tag ck-tag--selected ck-tag--tap">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="-mr-1.5 grid size-7 place-items-center rounded-full text-sm leading-none text-[color:var(--champagne)] hover:opacity-75"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        id={id}
        type="text"
        value={query}
        disabled={atLimit}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          atLimit ? `Tag limit reached (${MAX_TAGS})` : "Search tags…"
        }
        className="ck-input w-full disabled:cursor-not-allowed disabled:opacity-60"
      />

      {/* Browsable chip cloud - tap to add, no typing required. The list does
          NOT use an inner scroll area: on phones a tap inside a nested
          overflow-y-auto box gets swallowed as a scroll-start, so chips could
          only be added via search (bug board #179). Instead we render a plain
          wrapping cloud and, when nothing's typed, cap how many chips show so
          the full list can't blow out the form - search narrows it for the
          rest. `touch-manipulation` also drops the mobile tap delay. */}
      {!atLimit && browsable.length > 0 ? (
        (() => {
          const BROWSE_CAP = 14;
          const visibleTags = query.trim() ? browsable : browsable.slice(0, BROWSE_CAP);
          const hiddenCount = browsable.length - visibleTags.length;
          return (
            <div className="mt-1">
              <p className="mb-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
                {query.trim() ? `Matching tags (${browsable.length})` : `Tap to add · ${browsable.length}`}
              </p>
              <ul className="flex flex-wrap gap-2 rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-2">
                {visibleTags.map((opt) => (
                  <li key={opt}>
                    <button
                      type="button"
                      onClick={() => addTag(opt)}
                      // --tap, not the bare 24px tag: here the tag IS the
                      // control, and a 24px target next to 44px buttons asks
                      // for three times the precision for no reason.
                      className="ck-tag ck-tag--select ck-tag--tap touch-manipulation"
                    >
                      <span aria-hidden className="text-[color:var(--slate)]">+</span> {opt}
                    </button>
                  </li>
                ))}
                {hiddenCount > 0 ? (
                  <li className="self-center text-[12.5px] font-semibold text-[color:var(--slate)]">
                    +{hiddenCount} more - search to filter
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}

// Single-value text input with a suggestion dropdown. Unlike TagPicker, freetext
// is allowed - `options` are no-retyping conveniences (the merchant's host names
// / past venues), not a closed list. Picking a suggestion fills the field; the
// merchant can still type anything. `transform` lets callers normalise input as
// it's typed (e.g. title-casing), applied to typed text but not to picked options.
function Combobox({
  value,
  options,
  onChange,
  placeholder,
  required,
  transform,
  id,
  invalid,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  transform?: (s: string) => string;
  // The wrapping FormField owns the label and the message; the control it wraps
  // is ours, so the anchor id (for focus-the-first-offender) and the --danger
  // hairline have to be passed down.
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Which suggestion the arrow keys have landed on, -1 for "none - the field
  // still holds exactly what was typed". The options are deliberately not tab
  // stops (see tabIndex below), so the input never gives up focus; this index is
  // what aria-activedescendant points at, which is how a screen reader hears the
  // highlighted row move.
  const [active, setActive] = useState(-1);
  // Both call sites pass an anchor id, but the prop is optional and the option
  // ids have to be unique per instance or aria-activedescendant would address
  // the wrong list once two of these are on a page.
  const fallbackId = useId();
  const baseId = id ?? fallbackId;
  const listId = `${baseId}-suggestions`;

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options
      .filter((opt) => opt.toLowerCase() !== q)
      .filter((opt) => (q ? opt.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [options, value]);

  const listOpen = open && suggestions.length > 0;
  const activeOption =
    listOpen && active >= 0 && active < suggestions.length ? suggestions[active] : null;

  // The list holds up to eight rows but the box scrolls at about six, so
  // arrowing to the bottom used to highlight a row nobody could see.
  useEffect(() => {
    if (!activeOption) return;
    document.getElementById(`${baseId}-suggestion-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [activeOption, active, baseId]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setActive(-1);
  }

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      // preventDefault or the caret jumps to the start / end of the text while
      // the highlight moves, which reads as the field eating your typing.
      e.preventDefault();
      if (!listOpen) {
        // Arrowing is also how you get the list back after Escape.
        setOpen(true);
        setActive(e.key === "ArrowDown" ? 0 : suggestions.length - 1);
        return;
      }
      setActive((i) =>
        e.key === "ArrowDown" ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length : i) - 1,
      );
      return;
    }
    if (e.key === "Enter" && activeOption) {
      // Only swallow Enter while a suggestion is highlighted. Freetext is the
      // whole point of this control, so an un-arrowed Enter has to keep reaching
      // the form rather than being silently absorbed here.
      e.preventDefault();
      pick(activeOption);
      return;
    }
    if (e.key === "Escape" && listOpen) {
      // Escape dismisses the suggestions and nothing else - it must not travel
      // on to a surrounding dialog and throw away the half-filled step.
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div
      className="relative"
      // Focus leaving the whole control is what closes the list. This replaced a
      // 120ms timer on the input's blur, which fired even when focus had moved
      // INTO the list: the row the host was reaching for unmounted mid-Tab and
      // left them at document.body, back at the top of the page. React's onBlur
      // is focusout, so it can see relatedTarget - anything still inside this
      // wrapper keeps the list up.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(transform ? transform(e.target.value) : e.target.value);
          setOpen(true);
          // A fresh filter means the old highlight points at a row that may no
          // longer be there, so typing always drops back to "nothing selected".
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        aria-activedescendant={activeOption ? `${baseId}-suggestion-${active}` : undefined}
        aria-autocomplete="list"
        // The browser's own autofill panel covers this list and steals the arrow
        // keys for itself, so the keyboard path above would only work on fields
        // the browser had no saved value for.
        autoComplete="off"
        className={`ck-input w-full ${invalid ? "ck-input--invalid" : ""}`}
        required={required}
      />
      {listOpen ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl bg-[color:var(--paper)] py-1 shadow-[var(--shadow-md)]"
        >
          {suggestions.map((opt, i) => (
            // role="presentation" so the listbox owns the options directly - a
            // bare <li> in between makes the "option 3 of 8" count vanish.
            <li key={opt} role="presentation">
              <button
                type="button"
                id={`${baseId}-suggestion-${i}`}
                role="option"
                aria-selected={i === active}
                // Not a tab stop. The input keeps focus and drives the list
                // through aria-activedescendant, so Tab still means "leave this
                // field" instead of walking eight suggestions one at a time.
                tabIndex={-1}
                // onMouseDown (not onClick) so the pick lands before focus
                // leaves the input: macOS browsers don't focus a button on
                // click, so waiting for onClick would let the focusout above
                // close the list out from under the pointer. onClick is the twin
                // for clicks that arrive with no mousedown ahead of them, which
                // is what assistive tech dispatches.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(opt);
                }}
                onClick={() => pick(opt)}
                className={`block w-full px-4 py-2 text-left text-sm font-medium text-[color:var(--ink)] ${
                  i === active ? "bg-[color:var(--lavender-100)]" : "hover:bg-[color:var(--lavender-100)]"
                }`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Mirrors the connection intents members pick in onboarding, so a merchant can
// quickly say who an event is for instead of writing the goal sentence by hand.
const EVENT_INTENTS: { label: string; phrase: string }[] = [
  { label: "Make friends", phrase: "make new friends" },
  { label: "Dating", phrase: "meet someone in a relaxed setting" },
  { label: "Networking", phrase: "network with like-minded people" },
  { label: "Hobbies", phrase: "bond over a shared hobby" },
  { label: "Wellness", phrase: "unwind and look after themselves" },
  { label: "Community", phrase: "feel part of the local community" },
  { label: "New in town", phrase: "settle into Sydney" },
];

function composeGoalFromIntents(labels: string[]): string {
  const phrases = EVENT_INTENTS.filter((i) => labels.includes(i.label)).map((i) => i.phrase);
  if (phrases.length === 0) return "";
  const joined =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
  return `Great for people who want to ${joined}.`;
}

export function BasicsSection() {
  const { values, set, fieldErrors, categoryOptions, tagOptions, hostNameOptions } =
    useWizard();
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);

  function toggleIntent(label: string) {
    setSelectedIntents((prev) => {
      const next = prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label];
      const generated = composeGoalFromIntents(next);
      // Only manage the goal text while it's empty or a phrasing we generated -
      // never clobber a sentence the merchant wrote themselves.
      if (
        values.relationshipGoal.trim() === "" ||
        values.relationshipGoal === composeGoalFromIntents(prev)
      ) {
        set("relationshipGoal", generated);
      }
      return next;
    });
  }

  return (
    // rise-soft on the section root, then three staggered groups. Capped at
    // three: past ~4 the last group is dead time, not arrival. The keyframes end
    // on transform:none, so the Combobox dropdown still escapes the container.
    <div className="space-y-5 rise-soft">
      <header className="rise-soft rise-d1">
        <p className="eyebrow">Step 1 · Basics</p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          What is this event?
        </h1>
        {/* "You can edit any of this later" was not true - and it was least
            true on this step. updateMerchantEventDetails accepts exactly five
            fields: title, description, interest tags, address and photos. The
            category and the relationship goal collected below are NOT among
            them, and neither are date, price or capacity on the later steps.
            Naming the editable set is the difference between a host taking care
            over the right fields and finding out afterwards. */}
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          You can edit the title and description later from your event page.
          Category and who it&apos;s for are fixed once you submit, so take a
          moment on those.
        </p>
      </header>
      <div className="grid gap-4 rise-soft rise-d2 md:grid-cols-2">
        <FormField
          label="Event title"
          hint="Auto-capitalised as you type."
          required
          error={fieldErrors.title}
          id={fieldAnchorId("title")}
          value={values.title}
          onChange={(e) => set("title", toTitleCase(e.target.value))}
          placeholder="Restaurant Meetup: Table for Eight"
        />
        <FormField
          label="Group / host name"
          hint="Pick a saved name or type a new one."
          required
          error={fieldErrors.groupName}
          // htmlFor, because the control below is ours, not FormField's. Without
          // it the wrapping <label> forwarded a click on the text to the first
          // labelable thing it could find - see the note on FormField.
          htmlFor={fieldAnchorId("groupName")}
        >
          <Combobox
            id={fieldAnchorId("groupName")}
            invalid={Boolean(fieldErrors.groupName)}
            value={values.groupName}
            options={hostNameOptions}
            onChange={(next) => set("groupName", next)}
            placeholder="Sydney Table Friends"
            required
          />
        </FormField>
        <FormField
          as="select"
          label="Category"
          hint="Sets the badge on your card and the category cover if you skip photos."
          required
          error={fieldErrors.category}
          id={fieldAnchorId("category")}
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
        >
          {categoryOptions.length === 0 ? (
            <option value="">No categories available</option>
          ) : (
            <>
              {/* An empty, non-selectable first option. Seeding the first real
                  category instead published every untouched event as "Career". */}
              <option value="" disabled>
                Pick a category…
              </option>
              {categoryOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </>
          )}
        </FormField>
        <FormField
          label="Tags"
          hint={`Search and pick from Click's tag list - up to ${MAX_TAGS}. They're how we put your event in front of the right members, so pick the ones that really describe the night.`}
          htmlFor={TAG_SEARCH_ID}
        >
          <TagPicker
            id={TAG_SEARCH_ID}
            value={values.tags}
            options={tagOptions}
            onChange={(next) => set("tags", next)}
          />
        </FormField>
      </div>
      <div className="space-y-5 rise-soft rise-d3">
        {/* No htmlFor: these chips are a GROUP, not one control, so FormField
            renders role="group" and a click on the label correctly does nothing.
            It used to toggle the first chip and rewrite the goal sentence. */}
        <FormField
          label="Who's this event for?"
          hint="Pick one or more - we'll draft the goal line below, which you can edit."
        >
          <div className="flex flex-wrap gap-2">
            {EVENT_INTENTS.map((intent) => {
              const active = selectedIntents.includes(intent.label);
              return (
                <button
                  key={intent.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleIntent(intent.label)}
                  // background-color LONGHAND on the selected state, never a
                  // transitioned `background` shorthand - the shorthand leaves
                  // the selected chip unpainted mid-transition.
                  className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-[background-color,border-color] ${
                    active
                      ? "border-transparent bg-[color:var(--purple)] text-[color:var(--champagne)]"
                      : "border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                  }`}
                >
                  {intent.label}
                </button>
              );
            })}
          </div>
        </FormField>
        <FormField
          label="Why should people come?"
          hint="One line. It's the &ldquo;Why this event&rdquo; panel on your event page."
          required
          error={fieldErrors.relationshipGoal}
          id={fieldAnchorId("relationshipGoal")}
          value={values.relationshipGoal}
          onChange={(e) => set("relationshipGoal", e.target.value)}
          placeholder="Make dinner feel like the easiest first plan with new people."
        />
        <FormField
          as="textarea"
          label="Short description"
          required
          error={fieldErrors.description}
          id={fieldAnchorId("description")}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          placeholder="A hosted restaurant table for people who want dinner plans without the awkward group-chat setup…"
        />
      </div>
    </div>
  );
}

export function ScheduleSection() {
  const { values, set, fieldErrors, chargesEnabled, payoutsEnabled, platformFeeBps } =
    useWizard();
  // The SAME gate the publish decision uses - createEventForMerchant's
  // `stripeReady` is charges_enabled AND payouts_enabled (event-repository.ts),
  // and WizardShell's publishesImmediately reads both too. This note used to
  // check charges alone, so a host whose Connect account can take a card but
  // cannot pay out yet - the ordinary middle of onboarding, and the state where
  // we would be holding their money - was told nothing, then found out from an
  // admin queue their paid event had not gone live.
  const stripeReady = chargesEnabled && payoutsEnabled;
  // What the host actually receives. Stripe is in LIVE mode and the platform fee
  // is a real deduction on a real payout, so the wizard says the number before
  // the price is set rather than letting the first payout say it.
  const priceCents = Math.round((Number.parseFloat(values.price) || 0) * 100);
  const isPaid = priceCents > 0 && PRICE_PATTERN.test(values.price.trim());
  const feeCents = isPaid ? Math.floor((priceCents * platformFeeBps) / 10000) : 0;
  const netCents = priceCents - feeCents;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  return (
    <div className="space-y-4 rise-soft">
      <header className="rise-soft rise-d1">
        <p className="eyebrow">Step 2 · Schedule</p>
        <h1 className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          When + how many?
        </h1>
      </header>

      <div className="space-y-4 rise-soft rise-d2">
        <DateTimePicker
          id={fieldAnchorId("startsAt")}
          error={fieldErrors.startsAt}
          value={values.startsAt}
          onChange={(v) => set("startsAt", v)}
        />

        <FormField
          as="select"
          label="Duration"
          hint="How long does the event run?"
          value={values.durationMinutes}
          onChange={(e) => set("durationMinutes", e.target.value)}
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </FormField>

        <RecurrencePicker
          startsAt={values.startsAt}
          freq={values.recurrenceFreq}
          count={values.recurrenceCount}
          error={fieldErrors.recurrenceCount}
          onFreqChange={(f) => set("recurrenceFreq", f)}
          onCountChange={(c) => set("recurrenceCount", c)}
        />
      </div>

      <div className="space-y-4 rise-soft rise-d3">
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            label="Capacity"
            hint="Total seats at this event."
            required
            error={fieldErrors.capacity}
            id={fieldAnchorId("capacity")}
            type="text"
            inputMode="numeric"
            value={values.capacity}
            // Keeps what was typed rather than rewriting it. The old strip
            // turned "1.5" into 15 - a guest list nobody asked for - and
            // validateStep now rejects the decimal instead of hiding it.
            onChange={(e) => set("capacity", sanitizeAmount(e.target.value, 2))}
            placeholder="12"
          />
          <FormField
            label="Price per person"
            // "Price" beside "Capacity" read as the price of the whole event to
            // anyone listing a table or a room, and Stripe is live: a host who
            // meant $120 for eight seats charged each of the eight $120.
            hint="What ONE guest pays. Enter 0 for free. Dollars and cents, e.g. 12.50."
            error={fieldErrors.price}
            id={fieldAnchorId("price")}
            // type="text" + inputMode="decimal", NOT type="number": the number
            // input's own value sanitising is what let the old digits-only strip
            // turn "12.50" into "1250" without the merchant seeing it happen.
            // Stripe is live, so that was a real 100x charge.
            type="text"
            inputMode="decimal"
            value={values.price}
            onChange={(e) => set("price", sanitizeAmount(e.target.value, 2))}
            placeholder="0"
          />
        </div>
        {/* The money facts, at the moment the price is typed. Every line here was
            previously something a host only found out from their first payout,
            their tax return, or an attendee asking for a refund. */}
        {isPaid ? (
          <div className="space-y-2 rounded-xl border border-[color:var(--mist)] bg-[color:var(--lav-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--slate)]">
            <p className="text-[color:var(--ink)]">
              Each guest pays{" "}
              <strong className="font-semibold">{money(priceCents)}</strong>
              {platformFeeBps > 0 ? (
                <>
                  . Click keeps{" "}
                  {/* 290 bps reads "2.9%", not "2.90%" - up to two places, no
                      trailing zero. */}
                  <strong className="font-semibold">
                    {new Intl.NumberFormat("en-AU", {
                      maximumFractionDigits: 2,
                    }).format(platformFeeBps / 100)}
                    %
                  </strong>{" "}
                  ({money(feeCents)}), so you receive{" "}
                  <strong className="font-semibold">{money(netCents)}</strong> per
                  seat.
                </>
              ) : (
                <>. You receive the full amount - Click takes no cut.</>
              )}
            </p>
            <p>
              This price is GST-inclusive - the tax invoice takes the GST out of
              it (one eleventh of what the guest paid), it is never added on top.
              Guests may also see a separate booking fee; that one is Click&rsquo;s,
              not yours.
            </p>
            <p>
              Cancellations: a guest cancelling 48+ hours out gets a full refund,
              24-48 hours out gets half, and under 24 hours gets none. If you
              cancel the event, everyone is refunded in full.
            </p>
            {!stripeReady ? (
              <p className="text-[color:var(--ink)]">
                {/* Scoped to the PAID event being priced. It used to add "free
                    events included", which stopped being true when
                    createEventForMerchant started gating on price:
                    `needsStripe = priceCents > 0` (event-repository.ts:4369). */}
                Payout setup isn&rsquo;t finished, so this paid event stays in review
                until it is.{" "}
                <a
                  href={`/merchant/onboarding/payouts?returnTo=${encodeURIComponent(STEP_PATHS[1])}`}
                  className="font-medium text-[color:var(--purple)] underline underline-offset-2"
                >
                  Set up payouts
                </a>
              </p>
            ) : null}
          </div>
        ) : !stripeReady ? (
          <p className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--lav-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--slate)]">
            {/* This branch renders ONLY when the price is 0, and it used to say
                an unfinished payout setup held free events in review too. That
                was true once and is not any more: createEventForMerchant gates
                on price - `needsStripe = priceCents > 0`, then
                `autoApprove && (!needsStripe || stripeReady)` - so an approved
                host's free event publishes with no Stripe at all. Onboarding
                explicitly offers "skip for now, you can keep running free
                events", so this note was telling the hosts who took that offer
                that the offer was not real. */}
            No payout setup needed for a free event - this publishes as normal. You
            only need Stripe once you charge for a seat.{" "}
            <a
              href={`/merchant/onboarding/payouts?returnTo=${encodeURIComponent(STEP_PATHS[1])}`}
              className="font-medium text-[color:var(--purple)] underline underline-offset-2"
            >
              Set up payouts anyway
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Inline month-view calendar + time controls. Replaces the native
// <input type="datetime-local"> so the picker matches the rest of the
// wizard's DS styling and so past days are visually
// disabled in addition to validateStep rejecting them.
function DateTimePicker({
  value,
  onChange,
  id,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  // The picker is a fieldset, not one control, so the anchor id lands on the
  // fieldset (tabIndex -1 below) - that is what "focus the first offender" can
  // reach when the missing thing is a date rather than a text field.
  id?: string;
  error?: string;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const parsed = parseLocalDateTime(value);
  const selectedDate = parsed?.date ?? null;
  const selectedHour = parsed?.hour ?? 19;
  const selectedMinute = parsed?.minute ?? 0;

  const [cursor, setCursor] = useState<Date>(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const cursorYear = cursor.getFullYear();
  const cursorMonth = cursor.getMonth();

  // 6-week grid for stable height. First cell is the Sunday on or before the
  // 1st; cells outside the current month are dimmed but still pickable so
  // users don't lose the end of last month / start of next.
  const firstWeekday = new Date(cursorYear, cursorMonth, 1).getDay();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(cursorYear, cursorMonth, 1 + (i - firstWeekday));
    cells.push({ date: d, inMonth: d.getMonth() === cursorMonth });
  }

  const canGoBackMonth = cursor > new Date(today.getFullYear(), today.getMonth(), 1);

  function pickDay(d: Date) {
    if (d < today) return;
    onChange(formatLocalDateTimeString(d, selectedHour, selectedMinute));
  }
  function pickTime(hour: number, minute: number) {
    const base = selectedDate ?? today;
    onChange(formatLocalDateTimeString(base, hour, minute));
  }

  const summary = parsed
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(
        new Date(
          parsed.date.getFullYear(),
          parsed.date.getMonth(),
          parsed.date.getDate(),
          parsed.hour,
          parsed.minute,
        ),
      )
    : null;

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className={`mx-auto w-full max-w-sm rounded-2xl border bg-[color:var(--champagne)] px-4 py-3 outline-none md:max-w-2xl ${
        error ? "border-[color:var(--danger)]" : "border-[color:var(--mist)]"
      }`}
    >
      <legend className="flex flex-wrap items-baseline justify-between gap-2 px-2">
        <span className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            Start time
          </span>
          {/* The one required field on this step that carried no marker, because
              it is a fieldset rather than a FormField and so never got one. */}
          <span className="text-[11.5px] font-medium text-[color:var(--slate)]">
            Required
          </span>
          {/* The server reads this string as Sydney wall time (see
              parseEventStart), but the picker builds it from the BROWSER's
              clock. For a host outside Sydney those are different times, and
              nothing said which one they were setting. */}
          <span className="text-[11.5px] font-medium text-[color:var(--slate)]">
            · Sydney time
          </span>
        </span>
        <span className="text-[12.5px] font-semibold text-[color:var(--purple)]">
          {summary ?? "Pick a day + time"}
        </span>
      </legend>

      {error ? (
        <p
          role="alert"
          className="px-2 pt-1 text-[12.5px] font-medium text-[color:var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-stretch md:gap-6">
      <div className="md:flex-1">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          disabled={!canGoBackMonth}
          aria-label="Previous month"
          className="size-11 rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ←
        </button>
        <span className="font-display text-xl font-semibold leading-none tracking-[-0.02em] text-[color:var(--ink)]">
          {MONTH_NAMES[cursorMonth]} {cursorYear}
        </span>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
          className="size-11 rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
        >
          →
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <span
            key={w}
            className="text-[11px] font-semibold text-[color:var(--slate)]"
          >
            {w}
          </span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const isPast = date < today;
          const isToday = sameDay(date, today);
          const isSelected = selectedDate ? sameDay(date, selectedDate) : false;
          // h-11, not h-8: at 390px these were 36x32 boxes, the smallest tap
          // targets in a wizard whose every other control is min-h-11. Seven
          // 44px cells + gaps still fit inside the max-w-sm card.
          const base =
            "h-11 flex items-center justify-center rounded-lg text-[13px] font-semibold transition-colors";
          const stateClass = isSelected
            ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
            : isPast
              ? "bg-transparent text-[color:var(--slate)]/40 cursor-not-allowed"
              : inMonth
                ? `bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)] ${
                    isToday ? "ring-1 ring-[color:var(--purple)]" : ""
                  }`
                // Full-strength Slate, not /50. Out-of-month days ARE pickable
                // (deliberately - so the end of last month and the start of next
                // stay reachable), and half-opacity made them read as disabled,
                // exactly like the past days two branches up.
                : "bg-transparent text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)]";
          return (
            <button
              key={i}
              type="button"
              onClick={() => pickDay(date)}
              disabled={isPast}
              aria-pressed={isSelected}
              aria-label={date.toDateString()}
              className={`${base} ${stateClass}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      </div>

      <div className="border-t border-[color:var(--mist)] pt-3 md:mt-0 md:w-60 md:border-l md:border-t-0 md:pl-5 md:pt-0">
        <span className="block text-[12.5px] font-semibold text-[color:var(--slate)]">
          Time
        </span>
        {(() => {
            const isPm = selectedHour >= 12;
            const hour12 = selectedHour % 12 === 0 ? 12 : selectedHour % 12;
            const to24 = (h12: number, pm: boolean) =>
              pm ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
            const selectClass =
              "min-w-0 flex-1 rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2 py-2 text-sm font-medium text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]";
            return (
              <div className="mt-2 flex flex-nowrap items-center gap-1.5">
                <select
                  aria-label="Hour"
                  value={hour12}
                  onChange={(e) =>
                    pickTime(to24(Number(e.target.value), isPm), selectedMinute)
                  }
                  className={selectClass}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-semibold text-[color:var(--ink)]">:</span>
                <select
                  aria-label="Minute"
                  value={selectedMinute}
                  onChange={(e) =>
                    pickTime(selectedHour, Number(e.target.value))
                  }
                  className={selectClass}
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      {pad2(m)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="AM or PM"
                  value={isPm ? "pm" : "am"}
                  onChange={(e) =>
                    pickTime(to24(hour12, e.target.value === "pm"), selectedMinute)
                  }
                  className={selectClass}
                >
                  <option value="am">AM</option>
                  <option value="pm">PM</option>
                </select>
              </div>
            );
          })()}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_TIMES.map((t) => {
            const active = t.hour === selectedHour && t.minute === selectedMinute;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => pickTime(t.hour, t.minute)}
                aria-pressed={active}
                className={`ck-tag ck-tag--select ck-tag--tap ${active ? "ck-tag--selected" : ""}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      </div>
    </fieldset>
  );
}

// Recurrence selector - expanded into N events at submit time. Cap is 26 so a
// typo can't blow up the queue; backend doesn't currently know about
// recurrence, each occurrence is just another row.
function RecurrencePicker({
  startsAt,
  freq,
  count,
  error,
  onFreqChange,
  onCountChange,
}: {
  startsAt: string;
  freq: RecurrenceFreq;
  count: string;
  error?: string;
  onFreqChange: (v: RecurrenceFreq) => void;
  onCountChange: (v: string) => void;
}) {
  const n = Number.parseInt(count, 10) || 1;
  const occurrences = computeOccurrenceDates(startsAt, freq, n);
  const showPreview = freq !== "none" && occurrences.length > 0;

  function selectFreq(value: RecurrenceFreq) {
    onFreqChange(value);
    // Bump the count to a sensible default when switching off "none" -
    // otherwise the user lands on "1" and has to type.
    if (value !== "none" && (Number.parseInt(count, 10) || 0) < 2) {
      onCountChange("4");
    }
  }

  return (
    <fieldset className="rounded-2xl border border-[color:var(--mist)] bg-[color:var(--champagne)] px-5 py-4">
      <legend className="flex flex-wrap items-baseline justify-between gap-2 px-2">
        <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
          Repeat
        </span>
        <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
          {freq === "none" ? "One event" : `${n} events on submit`}
        </span>
      </legend>

      {/* A real radiogroup: arrow keys move between the options and only the
          checked one is in the tab order. It announced itself as a radiogroup
          before this and then behaved like four unrelated buttons, so keyboard
          users tabbed through every option and arrow keys did nothing. */}
      <div
        role="radiogroup"
        aria-label="Recurrence"
        className="mt-3 flex flex-wrap gap-2"
      >
        {FREQ_OPTIONS.map((opt, i) => {
          const active = opt.value === freq;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              title={opt.hint}
              onKeyDown={(e) => {
                const delta =
                  e.key === "ArrowRight" || e.key === "ArrowDown"
                    ? 1
                    : e.key === "ArrowLeft" || e.key === "ArrowUp"
                      ? -1
                      : 0;
                if (delta === 0) return;
                e.preventDefault();
                const next =
                  FREQ_OPTIONS[
                    (i + delta + FREQ_OPTIONS.length) % FREQ_OPTIONS.length
                  ];
                selectFreq(next.value);
                // Focus follows selection in a radiogroup, and the buttons are
                // siblings, so the next/previous element is the right target.
                const group = e.currentTarget.parentElement;
                const target = group?.children[
                  (i + delta + FREQ_OPTIONS.length) % FREQ_OPTIONS.length
                ] as HTMLElement | undefined;
                target?.focus();
              }}
              onClick={() => selectFreq(opt.value)}
              className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent bg-[color:var(--purple)] text-[color:var(--champagne)]"
                  : "border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {freq !== "none" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[color:var(--ink)]">
            <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
              How many?
            </span>
            <input
              id={fieldAnchorId("recurrenceCount")}
              type="number"
              min={2}
              max={26}
              value={count}
              onChange={(e) => onCountChange(e.target.value)}
              aria-invalid={error ? true : undefined}
              className={`ck-input w-20 ${error ? "ck-input--invalid" : ""}`}
            />
          </label>
          <span className="text-xs font-medium text-[color:var(--slate)]">
            Max 26 · one event row per date below.
          </span>
          {error ? (
            <span
              role="alert"
              className="text-[12.5px] font-medium text-[color:var(--danger)]"
            >
              {error}
            </span>
          ) : null}
        </div>
      ) : null}

      {showPreview ? (
        <div className="mt-4 rounded-xl bg-[color:var(--paper)] p-3">
          <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            Will create
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {occurrences.slice(0, 12).map((d, i) => (
              <span key={i} className="ck-tag">
                {new Intl.DateTimeFormat("en-AU", {
                  month: "short",
                  day: "numeric",
                }).format(d)}
              </span>
            ))}
            {occurrences.length > 12 ? (
              <span className="text-xs font-medium text-[color:var(--slate)]">
                +{occurrences.length - 12} more
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}

export function LocationSection() {
  const { values, set, fieldErrors, venueOptions } = useWizard();
  // The search box is its own field - a throwaway query used to locate the
  // address, pin the map, and (when Mapbox returns a named place) suggest the
  // venue name below. The venue field stays editable freetext either way.
  const [query, setQuery] = useState("");
  // Remember the last value we auto-filled into the venue field so re-picking a
  // different address updates it, but a name the merchant typed/edited is never
  // clobbered.
  const autoFilledVenue = useRef<string>("");

  function handlePick(place: MapboxPlace) {
    if (place.suburb) set("suburb", place.suburb);
    set("latitude", place.lat);
    set("longitude", place.lng);
    // Auto-fill the full street address from the pick (editable below).
    const picked = place.address?.trim() || place.street?.trim() || "";
    if (picked) set("address", picked);

    // Auto-fill the venue name from the POI name (e.g. "Fortress"), but only
    // when Mapbox returned a real place name distinct from the bare street
    // line - a plain street address shouldn't become the venue name. Respect a
    // name the merchant has already typed.
    const poi = place.name?.trim() ?? "";
    const isNamedPlace =
      poi.length > 0 &&
      poi.toLowerCase() !== place.street?.trim().toLowerCase() &&
      poi.toLowerCase() !== place.address?.trim().toLowerCase();
    const current = values.locationName.trim();
    if (isNamedPlace && (current === "" || current === autoFilledVenue.current)) {
      set("locationName", poi);
      autoFilledVenue.current = poi;
    }
  }

  const pinned = values.latitude !== null && values.longitude !== null;

  // Pilot area = greater Sydney. Warn (don't block) when the pinned venue is far
  // from the Sydney CBD so merchants know we're not active there yet. Haversine
  // distance in km from -33.8688, 151.2093.
  const SYDNEY_LAT = -33.8688;
  const SYDNEY_LNG = 151.2093;
  const PILOT_RADIUS_KM = 75;
  let distanceFromSydneyKm: number | null = null;
  if (pinned) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(values.latitude! - SYDNEY_LAT);
    const dLng = toRad(values.longitude! - SYDNEY_LNG);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(SYDNEY_LAT)) *
        Math.cos(toRad(values.latitude!)) *
        Math.sin(dLng / 2) ** 2;
    distanceFromSydneyKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const outsidePilotArea =
    distanceFromSydneyKm !== null && distanceFromSydneyKm > PILOT_RADIUS_KM;

  const [waitlistState, setWaitlistState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  async function joinLocationWaitlist() {
    setWaitlistState("saving");
    try {
      const response = await fetch("/api/merchant/location-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: values.address || null,
          suburb: values.suburb || null,
          latitude: values.latitude,
          longitude: values.longitude,
        }),
      });
      setWaitlistState(response.ok ? "done" : "error");
    } catch {
      setWaitlistState("error");
    }
  }

  return (
    <div className="space-y-5 rise-soft">
      <header className="rise-soft rise-d1">
        <p className="eyebrow">Step 3 · Location</p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Where in Sydney?
        </h1>
        {/* No "pin it on the map" - this step has never rendered a map, and the
            promise appeared twice. What picking a suggestion really does is
            capture coordinates, which is what puts the event in a suburb search
            and a distance sort. Say that instead. */}
        <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">
          Search a street address to fill in the suburb, capture the exact
          coordinates, and suggest a venue name - all editable below.
        </p>
      </header>

      <div className="space-y-5 rise-soft rise-d2">
        <FormField
          label="Find address"
          hint="Powered by Mapbox, biased to Australia. This box is just the search - what you pick fills the fields below."
        >
          <MapboxAutocomplete
            value={query}
            onValueChange={setQuery}
            onSelect={handlePick}
            ariaLabel="Find address"
            placeholder="e.g. 48 Spencer Road, Potts Point"
          />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Venue name"
            hint="Pick a saved venue or type a new one. Only shown to guests once they have a confirmed seat."
            required
            error={fieldErrors.locationName}
            htmlFor={fieldAnchorId("locationName")}
          >
            <Combobox
              id={fieldAnchorId("locationName")}
              invalid={Boolean(fieldErrors.locationName)}
              value={values.locationName}
              options={venueOptions}
              onChange={(next) => set("locationName", next)}
              placeholder="Bar Lucia"
              required
            />
          </FormField>
          <FormField
            label="Suburb"
            required
            error={fieldErrors.suburb}
            id={fieldAnchorId("suburb")}
            value={values.suburb}
            onChange={(e) => set("suburb", e.target.value)}
            placeholder="Potts Point"
          />
        </div>

        <FormField
          label="Street address"
          hint="Shown to confirmed attendees once they RSVP. Include the unit / level number, street, state and postcode."
          required
          error={fieldErrors.address}
          id={fieldAnchorId("address")}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Unit 6/29 Bridge Rd, Stanmore NSW 2048"
        />
      </div>

      <p
        className={`rise-soft rise-d3 text-xs font-medium ${
          pinned ? "text-[color:var(--purple)]" : "text-[color:var(--slate)]"
        }`}
      >
        {pinned
          ? // Number(...) guards against a stale sessionStorage duplicate draft
            // that seeded string coords before the #223 repository fix landed.
            `Coordinates captured (${Number(values.latitude).toFixed(5)}, ${Number(values.longitude).toFixed(5)}) - this event will show up in nearby searches.`
          : "No coordinates yet - pick a search suggestion above and this event can be found by distance."}
      </p>

      {outsidePilotArea ? (
        <div className="space-y-3 rounded-2xl bg-[color:var(--lavender-100)] p-4 text-sm leading-6 text-[color:var(--ink)]">
          <p>
            Heads up - this venue is about {Math.round(distanceFromSydneyKm!)} km
            from Sydney. Click is currently piloting in <strong>greater Sydney
            only</strong>. You can still publish, but reach will be limited until
            we launch in your area.
          </p>
          {waitlistState === "done" ? (
            <p className="rounded-xl bg-[color:var(--paper)] px-3 py-2 text-[color:var(--ink)]">
              Thanks - you&rsquo;re on the waitlist. We&rsquo;ll email you the moment Click
              launches near this venue.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void joinLocationWaitlist()}
                disabled={waitlistState === "saving"}
                className="ck-btn ck-btn--primary ck-btn--sm shrink-0"
              >
                {waitlistState === "saving" ? "Adding…" : "Notify me when you launch here"}
              </button>
              {waitlistState === "error" ? (
                <span className="text-xs font-medium text-[color:var(--danger)]">
                  Couldn&rsquo;t save that - try again.
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Drop / paste / file-picker uploader for the Media step. Each accepted file
// gets a local "pending" tile that flips to a public URL once the server has
// resized + stored it. Errored uploads stay visible with a retry-by-remove
// affordance so the merchant notices and re-tries. Tiles can be reordered
// (drag) and the first one becomes the event cover.
type PendingUpload = {
  // Stable client-side id used as the React key and the drag identifier.
  // Switches to `url` once the upload finishes, but the id stays.
  id: string;
  // Local object URL for the preview while uploading; replaced by the
  // server URL on success. Either way it's what the <img> renders.
  previewUrl: string;
  status: "uploading" | "done" | "error";
  // Server-side public URL once upload succeeds. Empty until then; the
  // submit handler reads from each tile's `url` to build the imageUrls list.
  url: string;
  error?: string;
  // Filename shown under the tile so paste-from-clipboard tiles still get a
  // label even if the OS doesn't supply one ("image.png" is the fallback).
  name: string;
};

const MEDIA_ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
// Hard cap on event photos. Matches the event detail gallery, which only lays
// out the first 5 images - anything beyond that never renders, so we stop the
// merchant uploading photos that would silently be dropped.
const MEDIA_MAX_PHOTOS = 5;

// Bundled sample covers a merchant can pick when they have no photos of their
// own (bug board #208). These are the same assets the server already falls back
// to via imageForCategory(), so picking one just makes that fallback explicit
// and visible. Their /media/*.jpg URL flows through values.images → imageUrls
// exactly like an uploaded photo, so no server change is needed.
const SAMPLE_PHOTOS: Array<{ url: string; name: string }> = [
  { url: "/media/networking.jpg", name: "Food & social" },
  { url: "/media/yoga.jpg", name: "Fitness & wellness" },
  { url: "/media/concert.jpg", name: "Music & creative" },
  { url: "/media/open-yoga.jpg", name: "General / outdoors" },
];

function makeUploadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Rebuild tiles from the wizard's saved gallery. Already-stored URLs are "done"
   by definition - there is nothing left to upload. */
function tilesFromUrls(urls: string[]): PendingUpload[] {
  return urls.filter(Boolean).map((url) => ({
    id: makeUploadId(),
    previewUrl: url,
    status: "done" as const,
    url,
    name: SAMPLE_PHOTOS.find((s) => s.url === url)?.name ?? "Photo",
  }));
}

export function MediaSection() {
  const { values, set, setUploading } = useWizard();
  // SEEDED FROM CONTEXT, never []. The provider lives in the route layout and
  // never remounts, but this section remounts on every visit - so an empty seed
  // plus the mirror effect below meant the first thing a Media -> Review -> Back
  // round trip did was write values.images = [], silently deleting every photo
  // the merchant had uploaded and submitting the event with none.
  const [pending, setPending] = useState<PendingUpload[]>(() =>
    tilesFromUrls(values.images),
  );
  const [dropping, setDropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Keep the wizard's `images` array in sync with successfully-uploaded
  // tiles, in their current display order. We mirror it from `pending` in an
  // effect (below) rather than calling `set` inline, so the rest of the wizard
  // (Review section, submit handler) just reads values.images.
  const commit = useCallback((next: PendingUpload[]) => {
    setPending(next);
  }, []);

  // Mirror successful uploads into the wizard's `images` after render. Calling
  // the provider's `set` synchronously from inside a `setPending` updater (or
  // during render) triggers React's "setState while rendering another
  // component" error, so we derive it here instead. Keyed on `pending` only:
  // the context `set` is stable between value changes, and depending on it
  // would re-fire this effect on every wizard edit and loop.
  useEffect(() => {
    set(
      "images",
      pending.filter((p) => p.status === "done" && p.url).map((p) => p.url),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // The seed above covers arriving with images already in context. It does NOT
  // cover a hard reload straight onto /media: the provider's sessionStorage
  // rehydrate is rAF-deferred, so the saved gallery lands one frame AFTER this
  // section's first render. Adopt it exactly once, and only while we are holding
  // nothing of our own - past that, a deliberate "Remove" must stick.
  //
  // The adopt is rAF-deferred for the same reason the provider's rehydrate is
  // (see EventCreateProvider): it has to land as a change to an already-painted
  // tree rather than racing it, and that is also what keeps it out of the
  // set-state-in-effect lint.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current) return;
    if (pending.length > 0) {
      adoptedRef.current = true;
      return;
    }
    if (values.images.length === 0) return;
    const urls = values.images;
    // The ref flips inside the callback, not beside the schedule: if the frame
    // gets cancelled the adopt has not happened, and marking it done would strand
    // the tiles empty for good.
    const frame = window.requestAnimationFrame(() => {
      adoptedRef.current = true;
      setPending(tilesFromUrls(urls));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [values.images, pending.length]);

  // Surface in-flight uploads to the wizard shell so it can block "Next" until
  // every tile settles. Reset on unmount so a flag stuck `true` (e.g. the user
  // navigates Back mid-upload) can't wedge the next step's button.
  const hasUploading = pending.some((p) => p.status === "uploading");
  useEffect(() => {
    setUploading(hasUploading);
    return () => setUploading(false);
  }, [hasUploading, setUploading]);

  const uploadOne = useCallback(
    async (file: File, id: string) => {
      const form = new FormData();
      form.set("file", file);
      try {
        const res = await fetch("/api/upload/event-image", {
          method: "POST",
          body: form,
        });
        const payload = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!res.ok || !payload.url) {
          throw new Error(payload.error || "Upload failed.");
        }
        setPending((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: "done" as const, url: payload.url! } : p,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        setPending((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: "error" as const, error: message } : p,
          ),
        );
        toast.error(message);
      }
    },
    [],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      // One pass: validate, build a tile for each survivor, and remember
      // the (tile, file) pairing so we kick off each upload with the right
      // file. Rejected files surface a toast but never reach `pending`.
      const accepted: Array<{ tile: PendingUpload; file: File }> = [];
      let remaining = MEDIA_MAX_PHOTOS - pending.length;
      if (remaining <= 0) {
        toast.error(`You can add up to ${MEDIA_MAX_PHOTOS} photos.`);
        return;
      }
      for (const file of files) {
        if (remaining <= 0) {
          toast.error(`Only the first ${MEDIA_MAX_PHOTOS} photos are kept - extras were skipped.`);
          break;
        }
        if (!MEDIA_ACCEPTED_MIME.has(file.type)) {
          toast.error(`${file.name || "Image"} - only JPG, PNG, or WEBP allowed.`);
          continue;
        }
        if (file.size > MEDIA_MAX_BYTES) {
          toast.error(`${file.name || "Image"} - must be 10 MB or smaller.`);
          continue;
        }
        if (file.size === 0) continue;
        accepted.push({
          file,
          tile: {
            id: makeUploadId(),
            previewUrl: URL.createObjectURL(file),
            status: "uploading",
            url: "",
            name: file.name || "Pasted image",
          },
        });
        remaining -= 1;
      }
      if (accepted.length === 0) return;
      setPending((prev) => [...prev, ...accepted.map((a) => a.tile)]);
      // Fire-and-forget; each upload patches its own tile when it resolves.
      for (const { file, tile } of accepted) {
        void uploadOne(file, tile.id);
      }
    },
    // pending.length is read above to enforce the photo cap, so the callback
    // must refresh when the count changes (otherwise it caps against a stale
    // count). It's only an event handler, so re-creating it is free.
    [uploadOne, pending.length],
  );

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) addFiles(files);
    // Reset so picking the same file twice in a row still triggers onChange.
    event.target.value = "";
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropping(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) addFiles(files);
  }

  function handleDragOver(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!dropping) setDropping(true);
  }

  function handleDragLeave(event: ReactDragEvent<HTMLDivElement>) {
    // Only clear the highlight when the drag actually leaves the container,
    // not when it enters a child element.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropping(false);
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items ?? [];
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  }

  function removeTile(id: string) {
    const next = pending.filter((p) => p.id !== id);
    // Release the object URL we created in addFiles so it doesn't leak.
    const removed = pending.find((p) => p.id === id);
    if (removed && removed.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    commit(next);
  }

  // Promote a photo to the cover slot (index 0). Gives merchants an explicit,
  // tap-friendly way to choose the cover instead of relying on drag-to-reorder
  // (which is fiddly and doesn't work on touch). images[0] is the cover.
  function makeCover(id: string) {
    const from = pending.findIndex((p) => p.id === id);
    if (from <= 0) return;
    const next = [...pending];
    const [moved] = next.splice(from, 1);
    next.unshift(moved);
    commit(next);
  }

  // Keyboard/touch path for reordering. Drag-and-drop was the only way to set
  // the gallery order past the cover, and it works with neither. Repeated
  // presses walk a photo forward one slot at a time.
  function moveEarlier(id: string) {
    const from = pending.findIndex((p) => p.id === id);
    if (from <= 0) return;
    const next = [...pending];
    [next[from - 1], next[from]] = [next[from], next[from - 1]];
    commit(next);
  }

  function onTileDragStart(index: number) {
    return (event: ReactDragEvent<HTMLDivElement>) => {
      dragIndexRef.current = index;
      event.dataTransfer.effectAllowed = "move";
      // Setting any data makes Firefox actually start the drag.
      event.dataTransfer.setData("text/plain", String(index));
    };
  }

  function onTileDragOver(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onTileDrop(toIndex: number) {
    return (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const from = dragIndexRef.current;
      dragIndexRef.current = null;
      if (from === null || from === toIndex) return;
      const next = [...pending];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      commit(next);
    };
  }

  // Pick a bundled sample cover (bug board #208). No upload round-trip: the
  // /media/*.jpg URL is already public, so we add a tile that's immediately
  // "done", and the images-sync effect mirrors it into values.images.
  function addSample(sample: { url: string; name: string }) {
    if (pending.length >= MEDIA_MAX_PHOTOS) {
      toast.error(`You can add up to ${MEDIA_MAX_PHOTOS} photos.`);
      return;
    }
    if (pending.some((p) => p.url === sample.url)) return; // already added
    commit([
      ...pending,
      {
        id: makeUploadId(),
        previewUrl: sample.url,
        status: "done" as const,
        url: sample.url,
        name: sample.name,
      },
    ]);
  }

  return (
    <div className="space-y-5 rise-soft">
      <header className="rise-soft rise-d1">
        <p className="eyebrow">Step 4 · Media · Optional</p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Drop in a few real photos.
        </h1>
        {/* This is the only step that validates nothing, and the only one that
            never said so - so a host with no photos to hand had no way to know
            they could just press Next. */}
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Add up to {MEDIA_MAX_PHOTOS} photos. The first one is the cover - use{" "}
          <span className="font-semibold text-[color:var(--ink)]">Set cover</span> on
          any tile to choose it. Drop, paste, or tap to upload.{" "}
          <span className="font-semibold text-[color:var(--ink)]">
            You can skip this step
          </span>{" "}
          - we&rsquo;ll use a cover for your category instead.
        </p>
      </header>

      {/* Adding, removing and reordering all change this grid silently. */}
      <p aria-live="polite" className="sr-only">
        {pending.length === 0
          ? "No photos added"
          : `${pending.length} of ${MEDIA_MAX_PHOTOS} photos. Cover: ${pending[0].name}.`}
      </p>

      {/* Drop / paste zone - focusable so paste works on click, mirrors the
          "drop anything here" affordance of Claude's chat composer. */}
      <div
        tabIndex={0}
        role="button"
        aria-label="Drop photos here, paste from clipboard, or tap to pick files"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onPaste={handlePaste}
        className={`grid place-items-center gap-3 rise-soft rise-d2 rounded-2xl border border-dashed px-6 py-10 text-center transition-[background-color,border-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--purple)] ${
          dropping
            ? "border-[color:var(--purple)] bg-[color:var(--lavender-100)]"
            : "border-[color:var(--mist-strong)] bg-[color:var(--champagne)] hover:bg-[color:var(--lavender-100)]/60"
        }`}
      >
        <span className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Drop photos, paste, or tap to upload
        </span>
        <span className="text-xs font-medium text-[color:var(--slate)]">
          JPG · PNG · WEBP · up to 10 MB each · {pending.length}/{MEDIA_MAX_PHOTOS} added
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* No photos yet? Offer bundled sample covers so a merchant without their
          own photos isn't left with an empty grid (bug board #208). Thumbnails
          use next/image so the (large) source files are served resized. */}
      {pending.length === 0 ? (
        <div className="space-y-2 rise-soft rise-d3">
          <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            No photos? Pick a sample to start
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SAMPLE_PHOTOS.map((sample) => (
              <button
                key={sample.url}
                type="button"
                onClick={() => addSample(sample)}
                className="group overflow-hidden rounded-2xl border border-[color:var(--mist)] bg-[color:var(--paper)] text-left transition-colors hover:border-[color:var(--purple)]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[color:var(--champagne)]">
                  <Image
                    src={sample.url}
                    alt={sample.name}
                    width={200}
                    height={150}
                    sizes="(max-width: 640px) 45vw, 200px"
                    className="size-full object-cover transition group-hover:scale-[1.03]"
                  />
                </div>
                <span className="block px-2 py-1.5 text-xs font-semibold text-[color:var(--ink)]">
                  {sample.name}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs font-medium leading-5 text-[color:var(--slate)]">
            You can swap it for your own photo any time - real photos always perform
            better.
          </p>
        </div>
      ) : null}

      {/* Card grid for uploaded photos. Each card is draggable so the
          merchant can promote any photo to the cover slot. */}
      {pending.length > 0 ? (
        <div className="grid gap-3 rise-soft rise-d3 sm:grid-cols-2 md:grid-cols-3">
          {pending.map((tile, idx) => {
            const isCover = idx === 0;
            return (
              <div
                key={tile.id}
                draggable={tile.status === "done"}
                onDragStart={onTileDragStart(idx)}
                onDragOver={onTileDragOver}
                onDrop={onTileDrop(idx)}
                className="group relative overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[color:var(--champagne)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.url || tile.previewUrl}
                    alt={tile.name}
                    className={`size-full object-cover transition ${
                      tile.status === "uploading" ? "opacity-60" : ""
                    }`}
                  />
                </div>
                {isCover ? (
                  <span className="absolute left-2 top-2 rounded-lg bg-[color:var(--purple)] px-2 py-1 text-[11px] font-semibold leading-none text-[color:var(--champagne)]">
                    Cover
                  </span>
                ) : null}
                {tile.status === "uploading" ? (
                  <span className="absolute right-2 top-2 rounded-lg bg-[color:var(--paper)]/90 px-2 py-1 text-[11px] font-semibold leading-none text-[color:var(--slate)]">
                    Uploading…
                  </span>
                ) : null}
                {tile.status === "error" ? (
                  <span className="absolute right-2 top-2 rounded-lg bg-[color:var(--danger)] px-2 py-1 text-[11px] font-semibold leading-none text-[color:var(--champagne)]">
                    Failed
                  </span>
                ) : null}
                <div className="flex items-center justify-between gap-2 border-t border-[color:var(--mist)] px-3 py-2">
                  <span className="truncate text-xs font-medium text-[color:var(--slate)]">
                    {tile.name}
                  </span>
                  {/* These were ~25px tall with the destructive Remove sitting
                      6px from Set cover, on a touch surface, where a mis-tap
                      deletes a photo the host just waited on an upload for.
                      min-h-9 gives a 36px box, and Remove is pushed a clear
                      12px away from the constructive pair so the two are not
                      one thumb-width apart. */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isCover && tile.status === "done" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => moveEarlier(tile.id)}
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2 text-[11px] font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                          aria-label={`Move ${tile.name} one place earlier`}
                        >
                          <span aria-hidden>←</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => makeCover(tile.id)}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2.5 text-[11px] font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                          aria-label={`Set ${tile.name} as cover`}
                        >
                          Set cover
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeTile(tile.id)}
                      className="ml-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2.5 text-[11px] font-semibold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
                      aria-label={`Remove ${tile.name}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ReviewSection() {
  const {
    values,
    platformFeeBps,
    chargesEnabled,
    payoutsEnabled,
    autoApproveEvents,
    setFromReview,
  } = useWizard();
  // Mirrors createEventForMerchant's publish gate exactly: a trusted host skips
  // the queue, but a PAID event still needs Connect finished (charges AND
  // payouts), because we cannot publish a ticket we can't route the money for.
  // A free event needs neither. This card used to stamp "Pending review" on
  // every preview, including events that are on Discover the instant the host
  // presses submit.
  // Same parse the Schedule step uses (line ~1517) - parsePriceCents itself is
  // server-only, and this is a client component.
  const paidTicket = Math.round((Number.parseFloat(values.price) || 0) * 100) > 0;
  const publishesImmediately =
    autoApproveEvents && (!paidTicket || (chargesEnabled && payoutsEnabled));
  const allTags = useMemo(() => parseTags(values.tags), [values.tags]);
  const tagsPreview = allTags.slice(0, 3);

  // Derive the same display bits the live EventCard shows, so this preview is a
  // faithful "here's how your card will look on Click" rather than a form dump.
  const cover = values.images[0] || null;
  const start = values.startsAt ? new Date(values.startsAt) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const dateLabel = validStart
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(validStart)
    : "Date TBA";
  const timeFormat = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
  const durationMinutes = Number.parseInt(values.durationMinutes, 10);
  const validEnd =
    validStart && Number.isFinite(durationMinutes) && durationMinutes > 0
      ? new Date(validStart.getTime() + durationMinutes * 60 * 1000)
      : null;
  const timeLabel = validStart
    ? validEnd
      ? `${timeFormat.format(validStart)} - ${timeFormat.format(validEnd)}`
      : timeFormat.format(validStart)
    : "Pick a time";
  // Formatted the way the SERVER will format it. `$${values.price}` echoed the
  // raw keystrokes, so "0.00" previewed as "$0.00" when it publishes as Free,
  // and ".5" previewed as "$.5".
  const priceCents = Math.round((Number.parseFloat(values.price) || 0) * 100);
  const priceLabel =
    priceCents <= 0
      ? "Free"
      : new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency: "AUD",
          minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
        }).format(priceCents / 100);
  const capacity = Number.parseInt(values.capacity, 10);
  const seatsLabel =
    Number.isFinite(capacity) && capacity > 0 ? `${capacity} seats` : "Seats TBA";
  // The live card hides the venue until a guest has a confirmed seat - it shows
  // the suburb and a lock. The preview used to print "Bar Lucia, Potts Point",
  // which told the host their venue was public when it is not.
  const suburbLabel = values.suburb || "Suburb TBA";
  const durationLabel =
    DURATION_OPTIONS.find((o) => o.value === values.durationMinutes)?.label ?? "";
  const photoCount = values.images.filter(Boolean).length;
  const photosLabel =
    photoCount === 0
      ? "None yet - we'll use a category cover"
      : photoCount === 1
        ? "1 photo"
        : `${photoCount} photos`;
  // The last screen before a LIVE Stripe listing is the last chance to see the
  // take rate. Same arithmetic as calculateApplicationFee (floor).
  const netCents = priceCents - Math.floor((priceCents * platformFeeBps) / 10000);
  const payoutLabel =
    priceCents <= 0
      ? "Free"
      : platformFeeBps > 0
        ? `${priceLabel} per guest · you receive ${new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
            minimumFractionDigits: netCents % 100 === 0 ? 0 : 2,
            maximumFractionDigits: netCents % 100 === 0 ? 0 : 2,
          }).format(netCents / 100)}`
        : `${priceLabel} per guest`;
  const repeatLabel =
    values.recurrenceFreq === "none"
      ? "Just once"
      : `${values.recurrenceCount} events, ${values.recurrenceFreq} - all created on submit`;

  return (
    <div className="space-y-5 rise-soft">
      <header className="rise-soft rise-d1">
        <p className="eyebrow">Step 5 · Review</p>
        <h1 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Looks good?
        </h1>
        {/* Branch, do not assert. This line used to say "Submissions go to admin
            for approval before going live" unconditionally - directly above a
            badge and a submit button that both correctly say the opposite for a
            trusted host. The same host was told two contradictory things about
            what their next tap does, in the same viewport. */}
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          This is how your event card will look on Click.{" "}
          {publishesImmediately
            ? "Submitting puts it straight on Discover - you can edit it afterwards."
            : "Submitting sends it to admin for approval, and we'll email you the outcome."}
        </p>
      </header>

      {/* Built to match ds EventCard, not to look like it: 16:9 cover (not a
          fixed 240px box), no scrim, the date/time line above the title, suburb
          + lock where the venue is NOT shown, tags, then price in the footer.
          The old preview had a scrim, a seats chip, the description and the
          venue name - four things the real card does not show - so "here's how
          your card will look" was a card that has never existed. */}
      <div className="mx-auto w-full max-w-sm rise-soft rise-d2">
        <article className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[color:var(--champagne-deep)]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={values.imageAlt || values.title || "Event cover"}
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center bg-[color:var(--lavender-100)] px-6 text-center">
                <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                  {values.category
                    ? `${values.category} cover - we'll supply one`
                    : "Add a cover photo on the media step"}
                </span>
              </div>
            )}
            <span className="absolute left-3 top-3">
              {/* Sage = live, Amber = waiting. Status colour on a badge only,
                  never on a CTA. */}
              {publishesImmediately ? (
                <Badge tone="sage">Goes live</Badge>
              ) : (
                <Badge tone="amber">Pending review</Badge>
              )}
            </span>
          </div>

          <div className="flex flex-col p-4">
            <p className="min-w-0 truncate text-[13px] font-semibold text-[color:var(--slate)]">
              {dateLabel} · {timeLabel}
            </p>
            <h3 className="font-display mt-1 line-clamp-2 min-w-0 text-[length:var(--card-title)] font-semibold leading-6 tracking-[-0.01em] text-[color:var(--ink)]">
              {values.title || "Untitled event"}
            </h3>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13.5px] font-medium text-[color:var(--slate)]">
              <span className="truncate">{suburbLabel}</span>
              <Icon
                name="lock"
                size={12}
                stroke={2.2}
                className="text-[color:var(--ink-faint)]"
                style={{ flex: "none" }}
              />
              <span className="sr-only">Venue shown when a guest RSVPs</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tagsPreview.length > 0 ? (
                tagsPreview.map((t) => (
                  <span key={t} className="ck-tag">
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-[13px] font-medium text-[color:var(--ink-faint)]">
                  No tags yet
                </span>
              )}
            </div>
            <p className="mt-2 text-[13px] font-medium text-[color:var(--slate)]">
              Be one of the first
            </p>
            <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-[color:var(--mist)] pt-3">
              <span
                className={`font-display text-base font-semibold ${
                  priceCents <= 0
                    ? "text-[color:var(--sage)]"
                    : "text-[color:var(--ink)]"
                }`}
              >
                {priceLabel}
              </span>
              <span className="ck-btn ck-btn--primary ck-btn--sm pointer-events-none">
                View
              </span>
            </div>
          </div>
        </article>
        <p className="mt-3 text-center text-xs font-medium text-[color:var(--slate)]">
          Preview · the card members see on Discover. Your venue name stays
          hidden until someone has a seat.
        </p>
      </div>

      {/* Everything the public card does NOT show. The street address is
          required and its hint promises it reaches confirmed attendees, but
          until now the last chance to proofread it was two steps back. Kept
          below the card, and quieter, so the card stays the hero of the step. */}
      <dl className="mx-auto grid w-full max-w-sm gap-px overflow-hidden rounded-2xl bg-[color:var(--mist)] rise-soft rise-d3">
        {[
          // Category was the one field with a silent default and no row here to
          // catch it, which is how events published as "Career".
          { label: "Category", value: values.category, step: 0 },
          { label: "Venue", value: values.locationName, step: 2 },
          { label: "Street address", value: values.address, step: 2 },
          { label: "Description", value: values.description, step: 0 },
          { label: "Why people should come", value: values.relationshipGoal, step: 0 },
          { label: "Runs for", value: durationLabel, step: 1 },
          { label: "Capacity", value: seatsLabel, step: 1 },
          { label: "Price per person", value: payoutLabel, step: 1 },
          { label: "Repeats", value: repeatLabel, step: 1 },
          { label: "Tags", value: allTags.join(", "), step: 0 },
          { label: "Photos", value: photosLabel, step: 3 },
        ].map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-[color:var(--paper)] px-4 py-3"
          >
            <dt className="text-[12.5px] font-semibold text-[color:var(--slate)]">
              {row.label}
            </dt>
            {/* Still a Link (middle-click, open-in-new-tab, the whole set of
                things a host expects of an underlined word), and the onClick
                just tells the shell that mounts on the destination that this is
                a detour - so it can offer one tap back here instead of four
                Nexts. */}
            <Link
              href={STEP_PATHS[row.step]}
              onClick={() => setFromReview(true)}
              className="text-[12px] font-semibold text-[color:var(--purple)] underline underline-offset-2"
            >
              Edit <span className="sr-only">{row.label}</span>
            </Link>
            <dd className="w-full text-[13.5px] leading-relaxed text-[color:var(--ink)]">
              {row.value || "Not set"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
