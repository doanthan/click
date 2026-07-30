"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Badge } from "./ds";
import { MapboxAutocomplete, type MapboxPlace } from "./mapbox-autocomplete";
import { toTitleCase } from "@/lib/text-format";
import { EVENT_CREATE_STORAGE_KEY } from "@/lib/event-create-storage";

// Create-event — multi-step wizard. Each step has its own URL so users can
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
  // set events.ends_at — without it every event silently defaulted to 2 hours.
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

// Wizard form state is held in React context (mounted in the route layout), so
// it survives client-side navigation between step pages. It does NOT survive a
// full page load — a refresh or a direct deep-link to a later step (e.g. opening
// /review on its own) starts a fresh context and resets to these defaults. To
// keep entered values across those reloads too, we mirror the state into
// sessionStorage and rehydrate from it on mount.
// Shared with the "Duplicate event" action, which seeds a prefilled draft into
// this same slot (see src/lib/event-create-storage.ts).
const STORAGE_KEY = EVENT_CREATE_STORAGE_KEY;

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

function validateStep(step: StepIndex, v: WizardValues): string | null {
  if (step === 0) {
    if (!v.title.trim()) return "Event title is required.";
    if (!v.groupName.trim()) return "Group / host name is required.";
    if (!v.description.trim()) return "Description is required.";
    if (!v.relationshipGoal.trim())
      return "Tell people why they should come (relationship goal).";
  }
  if (step === 1) {
    if (!v.startsAt) return "Pick a start date and time.";
    const start = new Date(v.startsAt);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return "Start time must be in the future.";
    }
    const capacity = Number.parseInt(v.capacity, 10);
    if (!Number.isFinite(capacity) || capacity < 1) {
      return "Capacity must be a positive number.";
    }
    if (v.recurrenceFreq !== "none") {
      const n = Number.parseInt(v.recurrenceCount, 10);
      if (!Number.isFinite(n) || n < 2 || n > 26) {
        return "Pick 2–26 occurrences for a recurring event.";
      }
    }
  }
  if (step === 2) {
    if (!v.locationName.trim()) return "Venue name is required.";
    if (!v.suburb.trim()) return "Suburb is required.";
    // Require the full street address so confirmed attendees always get a
    // complete address (number, street, state, postcode) once the venue
    // unlocks — not just a suburb. Picking a Mapbox suggestion fills this with
    // the full formatted line; merchants can append a unit/level number.
    if (!v.address.trim()) return "Street address is required.";
  }
  if (step === 3) {
    // Media step is optional — when the merchant skips uploads we fall back
    // to a category-themed placeholder server-side, so there's nothing to
    // validate here.
  }
  return null;
}

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
const DURATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
  { value: "150", label: "2.5 hours" },
  { value: "180", label: "3 hours" },
  { value: "240", label: "4 hours" },
  { value: "300", label: "5 hours" },
  { value: "360", label: "6 hours" },
  { value: "480", label: "8 hours" },
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

// ---------- context ----------

type WizardContextValue = {
  values: WizardValues;
  setValues: Dispatch<SetStateAction<WizardValues>>;
  set: <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => void;
  categoryOptions: string[];
  tagOptions: string[];
  // Suggestions for the Basics step's group/host-name combobox and the Location
  // step's venue combobox — derived server-side from the merchant's profile and
  // past events. Both fields stay freetext; these just save retyping.
  hostNameOptions: string[];
  venueOptions: string[];
  stepError: string | null;
  setStepError: Dispatch<SetStateAction<string | null>>;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
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
  children,
}: {
  categoryOptions: string[];
  tagOptions?: string[];
  hostNameOptions?: string[];
  venueOptions?: string[];
  children: React.ReactNode;
}) {
  const [values, setValues] = useState<WizardValues>(() => ({
    ...initial,
    category: categoryOptions[0] ?? "",
  }));
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Gate persistence until after the rehydrate effect runs, so we don't clobber
  // saved progress with the default state on first paint.
  const [hydrated, setHydrated] = useState(false);

  // Rehydrate from sessionStorage on mount (client only). Done in an effect
  // rather than the useState initializer so server + first client render agree
  // on the defaults (no hydration mismatch); the saved values flash in right
  // after mount.
  useEffect(() => {
    let saved: Partial<WizardValues> | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        saved = JSON.parse(raw) as Partial<WizardValues>;
      }
    } catch {
      // Malformed / unavailable storage — fall back to defaults.
    }
    const frame = window.requestAnimationFrame(() => {
      if (saved) setValues((v) => ({ ...v, ...saved }));
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Persist every change once hydrated so a refresh or a direct deep-link to a
  // later step keeps what the merchant has entered.
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Storage full / unavailable — non-fatal, the in-memory state still works.
    }
  }, [values, hydrated]);

  const set = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

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
        stepError,
        setStepError,
        submitting,
        setSubmitting,
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
  const { values, stepError, setStepError, submitting, setSubmitting, uploading } =
    useWizard();
  const router = useRouter();
  const isLast = step === STEP_COUNT - 1;
  const errorRef = useRef<HTMLParagraphElement>(null);

  function goNext() {
    if (uploading) {
      toast.error("Hang on - your photos are still uploading.");
      return;
    }
    const err = validateStep(step, values);
    if (err) {
      setStepError(err);
      toast.error(err);
      // Pull the inline error next to the button and focus it — on a tall
      // form the top-right toast is easy to miss (bug board #210).
      requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        errorRef.current?.focus();
      });
      return;
    }
    setStepError(null);
    router.push(STEP_PATHS[step + 1]);
  }

  function goBack() {
    if (step > 0) {
      setStepError(null);
      router.push(STEP_PATHS[step - 1]);
    }
  }

  async function submit() {
    // Re-run every step's validation on final submit — guards against a user
    // editing an earlier step after passing it, or deep-linking past one.
    for (let s = 0; s < STEP_COUNT; s++) {
      const err = validateStep(s as StepIndex, values);
      if (err) {
        setStepError(err);
        toast.error(err);
        router.push(STEP_PATHS[s]);
        return;
      }
    }

    setSubmitting(true);
    setStepError(null);
    try {
      // Expand recurrence client-side: one POST per occurrence. "none" yields
      // a single-element array so the loop is the only path.
      const occurrences = computeOccurrenceDates(
        values.startsAt,
        values.recurrenceFreq,
        Number.parseInt(values.recurrenceCount, 10) || 1,
      );
      const startsAtList = occurrences.length
        ? occurrences.map((d) =>
            formatLocalDateTimeString(d, d.getHours(), d.getMinutes()),
          )
        : [values.startsAt];

      let okCount = 0;
      const errors: string[] = [];
      let firstTitle: string | undefined;
      // Whether the created event(s) went straight live (trusted / auto-approved
      // merchant) vs landed in the pending review queue — drives the toast copy.
      let firstStatus: string | undefined;

      for (const startsAt of startsAtList) {
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
        // Multi-photo gallery from the Media step — one append per URL so the
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
          // /merchant/signup). Toast the reason and navigate there — every
          // queued occurrence shares the same root cause, so there's nothing
          // useful to retry until the merchant finishes the step the server
          // pointed them at. (Paid events no longer gate on payout setup — the
          // event sits in pending for admin review regardless.)
          if (payload.redirect) {
            const msg = payload.error ?? "Action needed before publishing.";
            toast.error(msg);
            window.location.href = payload.redirect;
            return;
          }
          errors.push(payload.error ?? "Submission failed.");
          continue;
        }
        okCount++;
        firstTitle = firstTitle ?? payload.event?.title;
        firstStatus = firstStatus ?? payload.event?.status;
      }

      if (okCount === 0) {
        const msg = errors[0] ?? "Submission failed.";
        setStepError(msg);
        toast.error(msg);
        return;
      }

      // Submission succeeded — drop the saved draft so the next "Create event"
      // starts clean instead of rehydrating this event's values.
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Non-fatal.
      }

      const label = firstTitle ?? values.title ?? "Event";
      // Trusted merchants (auto-approve on) publish straight to live — congratulate
      // them instead of saying it's "submitted for admin review", which reads as a
      // contradiction of the trust they were just granted (bug board #180).
      const liveNow =
        firstStatus === "live" || firstStatus === "featured" || firstStatus === "Live";
      if (errors.length === 0) {
        toast.success(
          liveNow
            ? startsAtList.length === 1
              ? `🎉 ${label} is live - members can find it on Discover now.`
              : `🎉 ${okCount} occurrences of ${label} are live on Discover.`
            : startsAtList.length === 1
              ? `${label} submitted for admin review.`
              : `${okCount} occurrences of ${label} submitted for admin review.`,
        );
      } else {
        toast.success(`${okCount} of ${startsAtList.length} submitted`, {
          description: `${errors.length} failed - retry from the merchant dashboard.`,
        });
      }
      router.push("/merchant?tab=events");
      router.refresh();
    } catch {
      const msg = "Submission failed. Check your connection.";
      setStepError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
      <StepIndicator current={step} />

      <div className="space-y-5 p-6">
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="ck-btn ck-btn--secondary ck-btn--md"
          >
            ← Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="ck-btn ck-btn--primary ck-btn--md"
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={uploading}
              className="ck-btn ck-btn--primary ck-btn--md"
            >
              {uploading ? "Uploading…" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: StepIndex }) {
  // Every step is a <Link> so users can jump anywhere in the wizard — the
  // form state lives in React context (mounted in layout.tsx), so navigating
  // away preserves what they've entered, and Submit re-runs every validator
  // and rebounces them to the offending step if any are still incomplete.
  // The current step links to itself (idempotent) just to keep the markup
  // uniform; aria-current marks it for screen readers.
  // Visual vocabulary matches the merchant-console WizardStepper: completed
  // steps sage with a check, current step Deep Purple, upcoming a quiet outline.
  return (
    <ol className="flex flex-wrap items-center gap-3 border-b border-[color:var(--mist)] px-5 py-4">
      {STEP_TITLES.map((title, idx) => {
        const active = idx === current;
        const done = idx < current;
        return (
          <li key={title}>
            <Link
              href={STEP_PATHS[idx]}
              aria-label={`Go to ${title}`}
              aria-current={active ? "step" : undefined}
              className="inline-flex items-center gap-2 rounded-full transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]"
            >
              <span
                className={`inline-flex size-6 flex-none items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${
                  done
                    ? "bg-[color:var(--sage)] text-[color:var(--champagne)]"
                    : active
                      ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
                      : "border-[1.5px] border-[color:var(--mist-strong)] bg-[color:var(--paper)] text-[color:var(--slate)]"
                }`}
              >
                {done ? <span aria-hidden>✓</span> : idx + 1}
              </span>
              <span
                className={`text-[12.5px] font-semibold ${
                  active ? "text-[color:var(--purple-700)]" : "text-[color:var(--slate)]"
                }`}
              >
                {title}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm text-[color:var(--ink)]">
      <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xs font-medium leading-5 text-[color:var(--slate)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function inputClass() {
  return "rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]";
}

// Max tags the merchant can attach. Mirrors the server-side `.slice(0, 8)` in
// createEventForMerchant so the UI can't promise more than the backend keeps.
const MAX_TAGS = 8;

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Tag input backed by a comma-separated string (the wizard's `values.tags`).
// Merchants search the admin-curated `options` list and click to add as pills.
// Tags are "click tags" — never free-form: only labels present in `options` can
// be added, so a merchant cannot mint a new tag. Picking from the list keeps tag
// spelling consistent with the tags users hold on their profiles, which is
// what powers matching. Selected tags render as removable pills; the serialised
// comma string is handed back through `onChange` so the submit path is unchanged.
function TagPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
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

  // All available (unselected) tags matching the search box — rendered as a
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
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <li key={tag.toLowerCase()}>
              <span className="ck-tag ck-tag--selected">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="grid size-4 place-items-center rounded-full text-[0.75rem] leading-none text-[color:var(--champagne)] hover:opacity-75"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        type="text"
        value={query}
        disabled={atLimit}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          atLimit ? `Tag limit reached (${MAX_TAGS})` : "Search tags…"
        }
        className={`${inputClass()} h-12 w-full disabled:cursor-not-allowed disabled:opacity-60`}
      />

      {/* Browsable chip cloud — tap to add, no typing required. The list does
          NOT use an inner scroll area: on phones a tap inside a nested
          overflow-y-auto box gets swallowed as a scroll-start, so chips could
          only be added via search (bug board #179). Instead we render a plain
          wrapping cloud and, when nothing's typed, cap how many chips show so
          the full list can't blow out the form — search narrows it for the
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
                      className="ck-tag ck-tag--select touch-manipulation"
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
// is allowed — `options` are no-retyping conveniences (the merchant's host names
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
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  transform?: (s: string) => string;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options
      .filter((opt) => opt.toLowerCase() !== q)
      .filter((opt) => (q ? opt.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [options, value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(transform ? transform(e.target.value) : e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        className={inputClass()}
        required={required}
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl bg-[color:var(--paper)] py-1 shadow-[var(--shadow-md)]">
          {suggestions.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                // onMouseDown (not onClick) so the pick lands before onBlur
                // closes the dropdown.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm font-medium text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
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
  const { values, set, categoryOptions, tagOptions, hostNameOptions } = useWizard();
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);

  function toggleIntent(label: string) {
    setSelectedIntents((prev) => {
      const next = prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label];
      const generated = composeGoalFromIntents(next);
      // Only manage the goal text while it's empty or a phrasing we generated —
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
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Step 1 · Basics</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          What is this event?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Don&apos;t worry about getting it perfect - you can edit any of this later from your event page.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Event title" hint="Auto-capitalised as you type.">
          <input
            value={values.title}
            onChange={(e) => set("title", toTitleCase(e.target.value))}
            placeholder="Restaurant Meetup: Table for Eight"
            className={inputClass()}
            required
          />
        </Field>
        <Field
          label="Group / host name"
          hint="Pick a saved name or type a new one."
        >
          <Combobox
            value={values.groupName}
            options={hostNameOptions}
            onChange={(next) => set("groupName", next)}
            placeholder="Sydney Table Friends"
            required
          />
        </Field>
        <Field label="Category">
          <select
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            className={`${inputClass()} h-12 self-start`}
          >
            {categoryOptions.length === 0 ? (
              <option value="">No categories available</option>
            ) : (
              categoryOptions.map((c) => <option key={c}>{c}</option>)
            )}
          </select>
        </Field>
        <Field
          label="Tags"
          hint="Search and pick from Click's tag list. Top 5 used for matching."
        >
          <TagPicker
            value={values.tags}
            options={tagOptions}
            onChange={(next) => set("tags", next)}
          />
        </Field>
      </div>
      <Field
        label="Who's this event for? (intent)"
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
                className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${
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
      </Field>
      <Field label="Why should people come? (relationship goal)">
        <input
          value={values.relationshipGoal}
          onChange={(e) => set("relationshipGoal", e.target.value)}
          placeholder="Make dinner feel like the easiest first plan with new people."
          className={inputClass()}
        />
      </Field>
      <Field label="Short description">
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          placeholder="A hosted restaurant table for people who want dinner plans without the awkward group-chat setup…"
          className={inputClass()}
        />
      </Field>
    </div>
  );
}

export function ScheduleSection() {
  const { values, set } = useWizard();
  return (
    <div className="space-y-4">
      <header>
        <p className="eyebrow">Step 2 · Schedule</p>
        <h2 className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          When + how many?
        </h2>
      </header>

      <DateTimePicker
        value={values.startsAt}
        onChange={(v) => set("startsAt", v)}
      />

      <Field label="Duration" hint="How long does the event run?">
        <select
          value={values.durationMinutes}
          onChange={(e) => set("durationMinutes", e.target.value)}
          className={inputClass()}
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <RecurrencePicker
        startsAt={values.startsAt}
        freq={values.recurrenceFreq}
        count={values.recurrenceCount}
        onFreqChange={(f) => set("recurrenceFreq", f)}
        onCountChange={(c) => set("recurrenceCount", c)}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Capacity" hint="Max number of guests.">
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={values.capacity}
            onChange={(e) => set("capacity", e.target.value.replace(/[^0-9]/g, ""))}
            className={inputClass()}
            required
          />
        </Field>
        <Field label="Price" hint="Enter 0 for free.">
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={values.price}
            onChange={(e) => set("price", e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            className={inputClass()}
          />
        </Field>
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
}: {
  value: string;
  onChange: (v: string) => void;
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
    <fieldset className="mx-auto w-full max-w-sm rounded-2xl border border-[color:var(--mist)] bg-[color:var(--champagne)] px-4 py-3 md:max-w-2xl">
      <legend className="flex flex-wrap items-baseline justify-between gap-2 px-2">
        <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
          Start time
        </span>
        <span className="text-[12.5px] font-semibold text-[color:var(--purple)]">
          {summary ?? "Pick a day + time"}
        </span>
      </legend>

      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-stretch md:gap-6">
      <div className="md:flex-1">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, -1))}
          disabled={!canGoBackMonth}
          aria-label="Previous month"
          className="rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-1.5 text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)] disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-1.5 text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
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
          const base =
            "h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors";
          const stateClass = isSelected
            ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
            : isPast
              ? "bg-transparent text-[color:var(--slate)]/40 cursor-not-allowed"
              : inMonth
                ? `bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)] ${
                    isToday ? "ring-1 ring-[color:var(--purple)]" : ""
                  }`
                : "bg-transparent text-[color:var(--slate)]/50 hover:bg-[color:var(--lavender-100)]";
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
                className={`ck-tag ck-tag--select ${active ? "ck-tag--selected" : ""}`}
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

// Recurrence selector — expanded into N events at submit time. Cap is 26 so a
// typo can't blow up the queue; backend doesn't currently know about
// recurrence, each occurrence is just another row.
function RecurrencePicker({
  startsAt,
  freq,
  count,
  onFreqChange,
  onCountChange,
}: {
  startsAt: string;
  freq: RecurrenceFreq;
  count: string;
  onFreqChange: (v: RecurrenceFreq) => void;
  onCountChange: (v: string) => void;
}) {
  const n = Number.parseInt(count, 10) || 1;
  const occurrences = computeOccurrenceDates(startsAt, freq, n);
  const showPreview = freq !== "none" && occurrences.length > 0;

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

      <div
        role="radiogroup"
        aria-label="Recurrence"
        className="mt-3 flex flex-wrap gap-2"
      >
        {FREQ_OPTIONS.map((opt) => {
          const active = opt.value === freq;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={opt.hint}
              onClick={() => {
                onFreqChange(opt.value);
                // Bump the count to a sensible default when switching off
                // "none" — otherwise the user lands on "1" and has to type.
                if (opt.value !== "none" && (Number.parseInt(count, 10) || 0) < 2) {
                  onCountChange("4");
                }
              }}
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
              type="number"
              min={2}
              max={26}
              value={count}
              onChange={(e) => onCountChange(e.target.value)}
              className="w-20 rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-2 text-base text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            />
          </label>
          <span className="text-xs font-medium text-[color:var(--slate)]">
            Max 26 · one event row per date below.
          </span>
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
  const { values, set, venueOptions } = useWizard();
  // The search box is its own field — a throwaway query used to locate the
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
    // line — a plain street address shouldn't become the venue name. Respect a
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
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Step 3 · Location</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Where in Sydney?
        </h2>
        <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">
          Search a street address to fill the suburb, pin it on the map, and
          auto-fill the venue name - edit it below if needed.
        </p>
      </header>

      <Field
        label="Find address"
        hint="Powered by Mapbox. Bias is Australia; pick a suggestion to fill the suburb, capture exact coordinates, and suggest a venue name."
      >
        <MapboxAutocomplete
          value={query}
          onValueChange={setQuery}
          onSelect={handlePick}
          placeholder="e.g. 48 Spencer Road, Potts Point"
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Venue name" hint="Pick a saved venue or type a new one.">
          <Combobox
            value={values.locationName}
            options={venueOptions}
            onChange={(next) => set("locationName", next)}
            placeholder="Bar Lucia"
            required
          />
        </Field>
        <Field label="Suburb">
          <input
            value={values.suburb}
            onChange={(e) => set("suburb", e.target.value)}
            placeholder="Potts Point"
            className={inputClass()}
            required
          />
        </Field>
      </div>

      <Field
        label="Street address"
        hint="Shown to confirmed attendees once they RSVP. Include the unit / level number, street, state and postcode."
      >
        <input
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Unit 6/29 Bridge Rd, Stanmore NSW 2048"
          className={inputClass()}
          required
        />
      </Field>

      <p
        className={`text-xs font-medium ${
          pinned ? "text-[color:var(--purple)]" : "text-[color:var(--slate)]"
        }`}
      >
        {pinned
          ? // Number(...) guards against a stale sessionStorage duplicate draft
            // that seeded string coords before the #223 repository fix landed.
            `Pinned at ${Number(values.latitude).toFixed(5)}, ${Number(values.longitude).toFixed(5)}`
          : "No coordinates yet - picking a suggestion will pin this on the map."}
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
// out the first 5 images — anything beyond that never renders, so we stop the
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

export function MediaSection() {
  const { set, setUploading } = useWizard();
  const [pending, setPending] = useState<PendingUpload[]>([]);
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
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Step 4 · Media</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Drop in a few real photos.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          Add up to {MEDIA_MAX_PHOTOS} photos. The first one is the cover - use{" "}
          <span className="font-semibold text-[color:var(--ink)]">Set cover</span> on
          any tile (or drag to reorder) to choose it. Drop, paste, or tap to
          upload.
        </p>
      </header>

      {/* Drop / paste zone — focusable so paste works on click, mirrors the
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
        className={`grid place-items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--purple)] ${
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
        <div className="space-y-2">
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
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
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
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isCover && tile.status === "done" ? (
                      <button
                        type="button"
                        onClick={() => makeCover(tile.id)}
                        className="rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2 py-1 text-[11px] font-semibold text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                        aria-label={`Set ${tile.name} as cover`}
                      >
                        Set cover
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeTile(tile.id)}
                      className="rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2 py-1 text-[11px] font-semibold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
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
  const { values } = useWizard();
  const tagsPreview = useMemo(
    () =>
      values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 3),
    [values.tags],
  );

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
      ? `${timeFormat.format(validStart)} – ${timeFormat.format(validEnd)}`
      : timeFormat.format(validStart)
    : "Pick a time";
  const priceLabel =
    !values.price || values.price === "0" ? "Free" : `$${values.price}`;
  const capacity = Number.parseInt(values.capacity, 10);
  const seatsLabel =
    Number.isFinite(capacity) && capacity > 0 ? `${capacity} seats` : "Seats TBA";
  const location =
    [values.locationName, values.suburb].filter(Boolean).join(", ") ||
    "Location TBA";

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Step 5 · Review</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Looks good?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--slate)]">
          This is how your event card will look on Click. Submissions go to admin
          for approval before going live.
        </p>
      </header>

      <div className="mx-auto w-full max-w-sm">
        <article className="group relative min-w-0 overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
          <div className="relative block h-60 overflow-hidden">
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
                    ? `${values.category} · cover photo`
                    : "Add a cover photo on the media step"}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/30 via-transparent to-transparent" />
            <span className="absolute left-3 top-3">
              <Badge tone="amber">Pending review</Badge>
            </span>
            <span className="absolute bottom-3 left-3 rounded-lg bg-[color:var(--paper)]/95 px-3 py-2 text-xs font-semibold leading-tight text-[color:var(--ink)] shadow-[var(--shadow-xs)]">
              {dateLabel}
              <span className="block text-[11px] font-medium text-[color:var(--slate)]">
                {timeLabel}
              </span>
            </span>
            <span className="absolute bottom-3 right-3 rounded-lg bg-[color:var(--paper)]/95 px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--ink)] shadow-[var(--shadow-xs)]">
              {seatsLabel}
            </span>
          </div>

          <div className="p-5">
            <p className="break-words text-[12.5px] font-semibold text-[color:var(--slate)]">
              {values.suburb || "-"} · {values.category || "-"} · {priceLabel}
            </p>
            <h3 className="font-display mt-2 text-[length:var(--card-title)] font-semibold leading-snug tracking-[-0.02em] text-[color:var(--ink)]">
              {values.title || "Untitled event"}
            </h3>
            <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">
              {location}
            </p>
            {values.groupName ? (
              <p className="mt-1 text-xs font-medium text-[color:var(--slate)]">
                Hosted by {values.groupName}
              </p>
            ) : null}
            <p className="mt-3 text-sm leading-6 text-[color:var(--slate)]">
              {values.description || "Add a description on the basics step."}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {values.recurrenceFreq !== "none" ? (
                <span className="ck-tag">
                  {values.recurrenceCount}× {values.recurrenceFreq}
                </span>
              ) : null}
              {tagsPreview.map((t) => (
                <span key={t} className="ck-tag">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </article>
        <p className="mt-3 text-center text-xs font-medium text-[color:var(--slate)]">
          Preview · public listing card
        </p>
      </div>
    </div>
  );
}
