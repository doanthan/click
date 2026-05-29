"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithMeta,
} from "@/app/login/actions";
import {
  formatAbn,
  formatAcn,
  normalizeAbn,
  normalizeAcn,
  validateOptionalAbn,
  validateOptionalAcn,
} from "@/lib/abn";
import { MapboxAutocomplete, type MapboxPlace } from "./mapbox-autocomplete";

// Merchant signup — multi-step wizard covering spec §1. Each step has its own
// URL so users can bookmark, link to, and browser-back through them:
//   /merchant/signup           · auth gate (rendered for logged-out visitors)
//   /merchant/signup/business  · step 1 · business details
//   /merchant/signup/contact   · step 2 · contact & address
//   /merchant/signup/documents · step 3 · documents → Submit
//
// Form state lives in a React context provided by <MerchantSignupProvider>
// mounted inside the route's layout, so it persists across client-side
// navigation between sibling step pages (App Router keeps shared layouts
// mounted). Each step page renders <WizardShell step={n}> which surfaces the
// step indicator, validation messages, and Back / Next / Submit nav. Per-step
// validators run on Next; Submit re-runs all three and router.push()'es back
// to the offending step's URL. Documents upload immediately on file-pick to
// /api/merchant/documents; everything else commits on Submit.

// ---------- constants & types ----------

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
type AuState = (typeof AU_STATES)[number];

const AU_STATE_NAMES: Record<AuState, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Aust. Capital Terr.",
  NT: "Northern Territory",
};

const BUSINESS_TYPES = [
  { value: "sole_trader", label: "Sole trader" },
  { value: "company", label: "Company (Pty Ltd)" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

const DOC_TYPES = ["abn_certificate", "public_liability_insurance", "liquor_licence"] as const;
type DocumentType = (typeof DOC_TYPES)[number];

type CategoryOption = { id: string; name: string; slug: string };
type ExistingDoc = { documentType: DocumentType; fileName: string };

export type MerchantSignupProviderProps = {
  sessionEmail: string;
  sessionName: string;
  categories: CategoryOption[];
  existingDocs: ExistingDoc[];
  children: React.ReactNode;
};

// 0 = Business, 1 = Contact, 2 = Documents.
export type StepIndex = 0 | 1 | 2;
const STEP_COUNT = 3;
const STEP_TITLES = ["Business", "Contact", "Documents"] as const;
export const STEP_PATHS = [
  "/merchant/signup/business",
  "/merchant/signup/contact",
  "/merchant/signup/documents",
] as const;

type State = {
  // Business
  businessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  businessType: BusinessType | "";
  eventCategoryIds: string[];
  // Contact & address
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  socialHandle: string;
  addressStreet: string;
  addressSuburb: string;
  addressState: AuState | "";
  addressPostcode: string;
  // Documents
  uploads: Record<DocumentType, { fileName: string } | null>;
  // Submission
  submitState: "idle" | "submitting" | "success" | "error";
  submitMessage: string;
};

type Action =
  | {
      type: "field";
      key: keyof Omit<
        State,
        "uploads" | "submitState" | "submitMessage" | "eventCategoryIds"
      >;
      value: string;
    }
  | { type: "toggleCategory"; id: string }
  | { type: "upload"; docType: DocumentType; info: { fileName: string } | null }
  | { type: "submitStart" }
  | { type: "submitError"; message: string }
  | { type: "submitSuccess" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "field":
      // Editing any field invalidates a stale submit error — clear it.
      return { ...state, [action.key]: action.value, submitMessage: "" };
    case "toggleCategory": {
      const has = state.eventCategoryIds.includes(action.id);
      return {
        ...state,
        eventCategoryIds: has
          ? state.eventCategoryIds.filter((id) => id !== action.id)
          : [...state.eventCategoryIds, action.id],
        submitMessage: "",
      };
    }
    case "upload":
      return {
        ...state,
        uploads: { ...state.uploads, [action.docType]: action.info },
        submitMessage: "",
      };
    case "submitStart":
      return { ...state, submitState: "submitting", submitMessage: "" };
    case "submitError":
      return { ...state, submitState: "error", submitMessage: action.message };
    case "submitSuccess":
      return { ...state, submitState: "success", submitMessage: "" };
  }
}

function initialState(props: {
  sessionEmail: string;
  sessionName: string;
  existingDocs: ExistingDoc[];
}): State {
  const existing: State["uploads"] = {
    abn_certificate: null,
    public_liability_insurance: null,
    liquor_licence: null,
  };
  for (const doc of props.existingDocs) {
    existing[doc.documentType] = { fileName: doc.fileName };
  }
  return {
    businessName: props.sessionName ? `${props.sessionName}'s Events` : "",
    tradingName: "",
    abn: "",
    acn: "",
    businessType: "",
    eventCategoryIds: [],
    contactEmail: props.sessionEmail,
    phone: "",
    websiteUrl: "",
    socialHandle: "",
    addressStreet: "",
    addressSuburb: "",
    addressState: "",
    addressPostcode: "",
    uploads: existing,
    submitState: "idle",
    submitMessage: "",
  };
}

// ---------- context ----------

type WizardContextValue = {
  state: State;
  dispatch: Dispatch<Action>;
  categories: CategoryOption[];
};

const WizardContext = createContext<WizardContextValue | null>(null);

function useWizard(): WizardContextValue {
  const value = useContext(WizardContext);
  if (!value) {
    throw new Error(
      "useWizard must be used inside <MerchantSignupProvider> (mounted in src/app/merchant/signup/layout.tsx)",
    );
  }
  return value;
}

export function MerchantSignupProvider({
  sessionEmail,
  sessionName,
  categories,
  existingDocs,
  children,
}: MerchantSignupProviderProps) {
  const [state, dispatch] = useReducer(
    reducer,
    { sessionEmail, sessionName, existingDocs },
    initialState,
  );
  return (
    <WizardContext.Provider value={{ state, dispatch, categories }}>
      {children}
    </WizardContext.Provider>
  );
}

// ---------- step validation ----------

function validateStep(step: StepIndex, state: State): string | null {
  if (step === 0) {
    const name = state.businessName.trim();
    if (name.length < 2 || name.length > 100)
      return "Business name must be 2–100 characters.";
    // ABN is optional for now — only validate the format when supplied.
    const abnError = validateOptionalAbn(state.abn);
    if (abnError) return abnError;
    const acnError = validateOptionalAcn(state.acn);
    if (acnError) return acnError;
    if (!state.businessType) return "Pick a business type.";
    if (state.eventCategoryIds.length === 0)
      return "Pick at least one event category.";
    return null;
  }
  if (step === 1) {
    if (!state.contactEmail.includes("@")) return "Enter a valid contact email.";
    if (!/^(?:\+?61|0)\d{9}$/.test(state.phone.replace(/\s+/g, ""))) {
      return "Phone must be a valid Australian number (e.g. 0412 345 678).";
    }
    if (!state.addressStreet.trim()) return "Street address is required.";
    if (!state.addressSuburb.trim()) return "Suburb is required.";
    if (!state.addressState) return "Pick a state.";
    if (!/^[0-9]{4}$/.test(state.addressPostcode.trim()))
      return "Postcode must be 4 digits.";
    return null;
  }
  // All documents are optional at signup; admins can request follow-ups during verification.
  return null;
}

// ---------- wizard shell ----------

export function WizardShell({
  step,
  children,
}: {
  step: StepIndex;
  children: React.ReactNode;
}) {
  const { state, dispatch } = useWizard();
  const router = useRouter();
  const isLast = step === STEP_COUNT - 1;

  function goNext() {
    const error = validateStep(step, state);
    if (error) {
      dispatch({ type: "submitError", message: error });
      return;
    }
    router.push(STEP_PATHS[step + 1]);
  }

  function goBack() {
    if (step > 0) {
      router.push(STEP_PATHS[step - 1]);
    }
  }

  async function submit() {
    // Re-run every step's validation on final submit — guards against a user
    // editing an earlier step after passing it, or deep-linking past one.
    for (let s = 0; s < STEP_COUNT; s++) {
      const error = validateStep(s as StepIndex, state);
      if (error) {
        dispatch({ type: "submitError", message: error });
        router.push(STEP_PATHS[s]);
        return;
      }
    }

    dispatch({ type: "submitStart" });

    const payload = {
      mode: "wizard" as const,
      businessName: state.businessName.trim(),
      tradingName: state.tradingName.trim(),
      abn: normalizeAbn(state.abn),
      acn: normalizeAcn(state.acn),
      businessType: state.businessType,
      eventCategoryIds: state.eventCategoryIds,
      contactEmail: state.contactEmail.trim().toLowerCase(),
      phone: state.phone.replace(/\s+/g, ""),
      websiteUrl: state.websiteUrl.trim(),
      socialHandle: state.socialHandle.trim(),
      addressStreet: state.addressStreet.trim(),
      addressSuburb: state.addressSuburb.trim(),
      addressState: state.addressState,
      addressPostcode: state.addressPostcode.trim(),
    };

    const response = await fetch("/api/merchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      window.location.href = "/merchant/login?callbackUrl=/merchant/signup";
      return;
    }

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      dispatch({ type: "submitError", message: body.error ?? "Submission failed." });
      return;
    }

    dispatch({ type: "submitSuccess" });
    router.push("/merchant-pending");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <StepIndicator current={step} />

      <SectionCard>{children}</SectionCard>

      {state.submitMessage ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]"
        >
          {state.submitMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || state.submitState === "submitting"}
          className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[color:var(--cream)]"
        >
          ← Back
        </button>

        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
          Step {step + 1} of {STEP_COUNT} · {STEP_TITLES[step]}
        </span>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={state.submitState === "submitting"}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
          >
            {state.submitState === "submitting" ? "Submitting…" : "Submit application →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: StepIndex }) {
  // Completed steps (i < current) render as <Link>s so users can jump back to
  // an earlier stage without using the Back button — matches the goBack()
  // behaviour above (backward nav skips per-step validation; forward nav is
  // still gated by the Next button). Active and not-yet-reached steps stay
  // as plain spans so users can't skip ahead past unvalidated input.
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEP_TITLES.map((title, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const circleClass = `flex size-8 flex-none items-center justify-center rounded-full border-2 border-[color:var(--line)] text-xs font-bold ${
          isActive
            ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
            : isDone
              ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
              : "bg-[color:var(--champagne)] text-[color:var(--mauve)]"
        }`;
        const labelClass = `hidden sm:inline font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] ${
          isActive ? "text-[color:var(--ink)]" : "text-[color:var(--mauve)]"
        }`;

        const stepContent = isDone ? (
          <Link
            href={STEP_PATHS[i]}
            aria-label={`Go back to ${title}`}
            className="flex items-center gap-2 sm:gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--champagne)] hover:opacity-80"
          >
            <span className={circleClass}>✓</span>
            <span className={labelClass}>{title}</span>
          </Link>
        ) : (
          <>
            <span className={circleClass} aria-current={isActive ? "step" : undefined}>
              {i + 1}
            </span>
            <span className={labelClass}>{title}</span>
          </>
        );

        return (
          <li key={title} className="flex flex-1 items-center gap-2 sm:gap-3">
            {stepContent}
            {i < STEP_TITLES.length - 1 ? (
              <span
                className={`h-[2px] flex-1 ${
                  isDone ? "bg-[color:var(--peach)]" : "bg-[color:var(--line-soft)]"
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow sm:p-8">
      {children}
    </div>
  );
}

// ---------- step 0 (auth gate) ----------

export function StepAuthCard({
  googleConfigured,
  metaConfigured,
}: {
  googleConfigured: boolean;
  metaConfigured: boolean;
}) {
  // Use the same actions as /login / /merchant/login but route the callback
  // back to /merchant/signup so the user lands inside the wizard at Step 1.
  const callbackUrl = "/merchant/signup";
  return (
    <div className="grid gap-6 lg:grid-cols-[0.45fr_0.55fr] lg:items-start">
      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Sign in first
        </p>
        <h2 className="mt-3 font-display text-3xl font-light leading-tight">
          One account for hosting and attending.
        </h2>
        <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          We use the same identity for your Click attendee profile and your merchant portal.
          Sign in with Google, Facebook, or email — we’ll bring you straight back to the form.
        </p>
        <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Already a host?{" "}
          <Link href="/merchant/login" className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]">
            Log in to the host portal
          </Link>{" "}
          instead.
        </p>
      </div>

      <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow">
        <form action={signInWithGoogle} className="grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={!googleConfigured}
            className="flex min-h-[52px] w-full items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleConfigured ? "Continue with Google" : "Google · setup required"}
          </button>
        </form>

        <form action={signInWithMeta} className="mt-3 grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={!metaConfigured}
            className="flex min-h-[52px] w-full items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[#1877F2] px-5 text-sm font-bold uppercase tracking-wide text-white hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {metaConfigured ? "Continue with Facebook" : "Facebook · setup required"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            or with email
          </span>
          <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
        </div>

        <form action={signInWithEmail} className="grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--mauve)]">
            Business email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
          >
            Continue →
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- field primitives ----------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
      {children}
    </span>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)] ${props.className ?? ""}`}
    />
  );
}

// ---------- section · business ----------

export function BusinessSection() {
  const { state, dispatch, categories } = useWizard();
  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Business details</h3>

      <label className="grid gap-2">
        <FieldLabel>Business name *</FieldLabel>
        <TextInput
          value={state.businessName}
          onChange={(e) => dispatch({ type: "field", key: "businessName", value: e.target.value })}
          placeholder="Sydney Table Friends"
          required
        />
      </label>

      <label className="grid gap-2">
        <FieldLabel>Trading name (if different)</FieldLabel>
        <TextInput
          value={state.tradingName}
          onChange={(e) => dispatch({ type: "field", key: "tradingName", value: e.target.value })}
          placeholder="STF Events"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel>ABN (optional, 11 digits, checksum-validated)</FieldLabel>
          <TextInput
            value={state.abn}
            inputMode="numeric"
            maxLength={14}
            onChange={(e) =>
              dispatch({
                type: "field",
                key: "abn",
                value: normalizeAbn(e.target.value).slice(0, 11),
              })
            }
            onBlur={() =>
              dispatch({ type: "field", key: "abn", value: formatAbn(state.abn) })
            }
            placeholder="11 222 333 444"
          />
        </label>

        <label className="grid gap-2">
          <FieldLabel>ACN (optional, 9 digits)</FieldLabel>
          <TextInput
            value={state.acn}
            inputMode="numeric"
            onChange={(e) => dispatch({ type: "field", key: "acn", value: e.target.value })}
            onBlur={() =>
              dispatch({ type: "field", key: "acn", value: formatAcn(state.acn) })
            }
            placeholder="000 000 000"
          />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1"><FieldLabel>Business type *</FieldLabel></legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BUSINESS_TYPES.map((opt) => {
            const selected = state.businessType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => dispatch({ type: "field", key: "businessType", value: opt.value })}
                className={`rounded-xl border-2 border-[color:var(--line)] px-3 py-2.5 text-sm font-bold ${
                  selected
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <CategoryPicker
        categories={categories}
        selectedIds={state.eventCategoryIds}
        onToggle={(id) => dispatch({ type: "toggleCategory", id })}
      />
    </div>
  );
}

// Searchable multi-select for event categories. Selected pills stay pinned
// above the search results so they're always visible while the user filters.
function CategoryPicker({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: CategoryOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selectedIds);
  const selected = categories.filter((c) => selectedSet.has(c.id));
  const q = query.trim().toLowerCase();
  const available = categories.filter((c) => {
    if (selectedSet.has(c.id)) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <FieldLabel>Event categories you host * (pick at least one)</FieldLabel>
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
          {selectedIds.length} selected
        </span>
      </legend>

      {categories.length === 0 ? (
        <p className="text-sm font-medium text-[color:var(--mauve)]">
          No categories available — check your database connection.
        </p>
      ) : (
        <>
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggle(cat.id)}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--surface-deep)] hover:bg-[color:var(--rose)]"
                  aria-label={`Remove ${cat.name}`}
                >
                  ✓ {cat.name} ×
                </button>
              ))}
            </div>
          ) : null}

          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              aria-label="Search event categories"
              className="w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
            />
          </div>

          {available.length === 0 ? (
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              {q
                ? `No categories match “${query}”.`
                : "All categories selected — nice."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggle(cat.id)}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

// ---------- section · contact & address ----------

export function ContactSection() {
  const { state, dispatch } = useWizard();

  // Picking a Mapbox suggestion fills street + suburb/state/postcode in one go.
  function handlePick(place: MapboxPlace) {
    dispatch({ type: "field", key: "addressStreet", value: place.street || place.name });
    if (place.suburb) dispatch({ type: "field", key: "addressSuburb", value: place.suburb });
    if ((AU_STATES as readonly string[]).includes(place.state)) {
      dispatch({ type: "field", key: "addressState", value: place.state });
    }
    if (/^[0-9]{4}$/.test(place.postcode)) {
      dispatch({ type: "field", key: "addressPostcode", value: place.postcode });
    }
  }

  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Contact & address</h3>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">
          <FieldLabel>Contact email *</FieldLabel>
          <TextInput
            type="email"
            value={state.contactEmail}
            onChange={(e) => dispatch({ type: "field", key: "contactEmail", value: e.target.value })}
            placeholder="bookings@example.com"
            required
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Phone * (AU)</FieldLabel>
          <TextInput
            type="tel"
            value={state.phone}
            onChange={(e) => dispatch({ type: "field", key: "phone", value: e.target.value })}
            placeholder="0412 345 678"
            required
          />
        </label>
      </div>

      <label className="grid gap-2">
        <FieldLabel>Website (optional)</FieldLabel>
        <TextInput
          type="url"
          value={state.websiteUrl}
          onChange={(e) => dispatch({ type: "field", key: "websiteUrl", value: e.target.value })}
          placeholder="https://www.yourbusiness.com.au"
        />
      </label>

      <label className="grid gap-2">
        <FieldLabel>Facebook or Instagram handle (optional)</FieldLabel>
        <TextInput
          value={state.socialHandle}
          onChange={(e) => dispatch({ type: "field", key: "socialHandle", value: e.target.value })}
          placeholder="@yourbusiness"
        />
        <span className="text-xs font-medium text-[color:var(--mauve)]">
          Handy for verifying hosts who don&apos;t have formal documents yet.
        </span>
      </label>

      <label className="grid gap-2">
        <FieldLabel>Street address *</FieldLabel>
        <MapboxAutocomplete
          value={state.addressStreet}
          onValueChange={(v) => dispatch({ type: "field", key: "addressStreet", value: v })}
          onSelect={handlePick}
          placeholder="Start typing — e.g. 42 Crown Street, Surry Hills"
        />
        <span className="text-xs font-medium text-[color:var(--mauve)]">
          Pick a suggestion and we&apos;ll fill in suburb, state &amp; postcode.
        </span>
      </label>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="grid gap-2">
          <FieldLabel>Suburb *</FieldLabel>
          <TextInput
            value={state.addressSuburb}
            onChange={(e) => dispatch({ type: "field", key: "addressSuburb", value: e.target.value })}
            placeholder="Surry Hills"
            required
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>State *</FieldLabel>
          <StateSelect
            value={state.addressState}
            onChange={(value) => dispatch({ type: "field", key: "addressState", value })}
          />
        </label>
        <label className="grid gap-2">
          <FieldLabel>Postcode *</FieldLabel>
          <TextInput
            value={state.addressPostcode}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => dispatch({ type: "field", key: "addressPostcode", value: e.target.value.replace(/\D/g, "") })}
            placeholder="2010"
            required
          />
        </label>
      </div>
    </div>
  );
}

// Custom State picker — replaces the native <select> so the dropdown surface
// can actually be styled on-brand (the OS-rendered popup ignores CSS). Mirrors
// the chip-button vocabulary used by Business type above, but as a popover so
// it stays compact inside the narrow Suburb / State / Postcode row.
function StateSelect({
  value,
  onChange,
}: {
  value: AuState | "";
  onChange: (value: AuState) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside-click or Escape. Both listeners are only attached while
  // the popover is open so we don't leak globals across the whole wizard.
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border-2 border-[color:var(--line)] px-4 py-3 text-base font-semibold outline-none hard-shadow-sm ${
          open
            ? "bg-[color:var(--cream)] text-[color:var(--ink)]"
            : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
        }`}
      >
        <span className={value ? "" : "text-[color:var(--mauve)]"}>
          {value || "—"}
        </span>
        <svg
          viewBox="0 0 12 8"
          width="12"
          height="8"
          aria-hidden="true"
          className={`flex-none transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M1 1.5l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Australian state or territory"
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-2 hard-shadow"
        >
          <ul className="grid grid-cols-2 gap-1.5">
            {AU_STATES.map((s) => {
              const selected = value === s;
              return (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(s);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-xl border-2 border-[color:var(--line)] px-2.5 py-1.5 text-left ${
                      selected
                        ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                        : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
                    }`}
                  >
                    <span className="text-sm font-bold leading-tight">{s}</span>
                    <span
                      className={`font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] leading-tight ${
                        selected ? "text-[color:var(--surface-deep)]" : "text-[color:var(--mauve)]"
                      }`}
                    >
                      {AU_STATE_NAMES[s]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------- section · documents ----------

export function DocumentsSection() {
  const { state, dispatch } = useWizard();
  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Documents</h3>
      <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Upload PDFs or images (max 5 MB each). Files land in a private Supabase Storage bucket;
        only admins and you can access them via signed URLs.
      </p>

      <DocumentUploadRow
        label="ABN certificate (optional)"
        documentType="abn_certificate"
        state={state}
        dispatch={dispatch}
      />
      <DocumentUploadRow
        label="Public liability insurance (optional)"
        documentType="public_liability_insurance"
        state={state}
        dispatch={dispatch}
      />
      <DocumentUploadRow
        label="Liquor licence (only if you host alcohol events)"
        documentType="liquor_licence"
        state={state}
        dispatch={dispatch}
      />
    </div>
  );
}

function DocumentUploadRow({
  label,
  documentType,
  state,
  dispatch,
}: {
  label: string;
  documentType: DocumentType;
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = state.uploads[documentType];

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("document_type", documentType);
      form.set("file", file);
      const response = await fetch("/api/merchant/documents", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { error?: string; document?: { file_name: string } };
      if (!response.ok) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      dispatch({
        type: "upload",
        docType: documentType,
        info: { fileName: body.document?.file_name ?? file.name },
      });
    } finally {
      setBusy(false);
      // Reset the input so re-selecting the same file fires onChange again.
      event.target.value = "";
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        {existing ? (
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[color:var(--peach)]">
            ✓ uploaded
          </span>
        ) : null}
      </div>
      {existing ? (
        <p className="text-sm font-semibold text-[color:var(--ink)]">{existing.fileName}</p>
      ) : null}
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={onChange}
        disabled={busy}
        className="text-sm font-medium text-[color:var(--ink)] file:mr-3 file:rounded-full file:border-2 file:border-[color:var(--line)] file:bg-[color:var(--cream)] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-[0.12em] file:text-[color:var(--ink)] hover:file:bg-[color:var(--champagne)]"
      />
      {busy ? (
        <p className="text-xs font-medium text-[color:var(--mauve)]">Uploading…</p>
      ) : null}
      {error ? (
        <p className="text-xs font-bold text-[color:var(--surface-deep)]">{error}</p>
      ) : null}
    </div>
  );
}
