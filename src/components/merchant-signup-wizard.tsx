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
import { WizardStepper } from "./merchant-ds";

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


type DocumentType =
  | "abn_certificate"
  | "public_liability_insurance"
  | "liquor_licence";

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", placeholder: "@yourbusiness" },
  { value: "tiktok", label: "TikTok", placeholder: "@yourbusiness" },
  { value: "facebook", label: "Facebook", placeholder: "yourbusiness or page URL" },
  { value: "youtube", label: "YouTube", placeholder: "@yourchannel" },
  { value: "x", label: "X", placeholder: "@yourbusiness" },
] as const;
type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["value"];

// Greater Sydney postcode ranges — the area covered by the launch pilot. Used to
// show out-of-area hosts the waitlist notice. Kept deliberately inclusive so we
// don't tell a genuine Sydney host they're outside the pilot.
const SYDNEY_POSTCODE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [2000, 2249], // metro core + eastern/inner/northern/southern suburbs
  [2555, 2574], // Macarthur (Camden, Campbelltown)
  [2740, 2786], // Penrith, Blue Mountains, western fringe
];

function isSydneyPostcode(postcode: string): boolean {
  if (!/^\d{4}$/.test(postcode)) return false;
  const n = Number(postcode);
  return SYDNEY_POSTCODE_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

// Client-side postcode → state lookup via the bundled AU table (the table
// itself is server-only, so we hit its API route). Returns "" on any miss.
async function lookupStateForPostcode(postcode: string): Promise<string> {
  if (!/^\d{4}$/.test(postcode)) return "";
  try {
    const res = await fetch(`/api/geo/postcode?code=${postcode}`);
    if (!res.ok) return "";
    const body = (await res.json()) as { state?: string };
    return body.state ?? "";
  } catch {
    return "";
  }
}

type CategoryOption = { id: string; name: string; slug: string };
type ExistingDoc = { documentType: DocumentType; fileName: string };

// Saved merchant-signup answers used to pre-fill the wizard when a rejected
// merchant re-opens it to edit + resubmit (bug board #203). Structural match for
// the repository's MerchantSignupPrefill — kept loose so the component doesn't
// import server code.
export type MerchantSignupPrefill = {
  businessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  eventCategoryIds: string[];
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  socials: Record<string, string>;
  addressStreet: string;
  addressSuburb: string;
  addressState: string;
  addressPostcode: string;
};

export type MerchantSignupProviderProps = {
  sessionEmail: string;
  sessionName: string;
  categories: CategoryOption[];
  existingDocs: ExistingDoc[];
  // Present only for a rejected merchant resubmitting — pre-fills every field.
  existingProfile?: MerchantSignupPrefill | null;
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
  eventCategoryIds: string[];
  // Contact & address
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  // One handle per network — empty string means "not on it".
  socials: Record<SocialPlatform, string>;
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
        "uploads" | "submitState" | "submitMessage" | "eventCategoryIds" | "socials"
      >;
      value: string;
    }
  | { type: "social"; platform: SocialPlatform; value: string }
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
    case "social":
      return {
        ...state,
        socials: { ...state.socials, [action.platform]: action.value },
        submitMessage: "",
      };
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
  existingProfile?: MerchantSignupPrefill | null;
}): State {
  const existing: State["uploads"] = {
    abn_certificate: null,
    public_liability_insurance: null,
    liquor_licence: null,
  };
  for (const doc of props.existingDocs) {
    existing[doc.documentType] = { fileName: doc.fileName };
  }
  // Start every platform empty, then overlay any saved handles so the socials
  // record always has the full set of keys the UI iterates over.
  const socials = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p.value, ""]),
  ) as Record<SocialPlatform, string>;
  const prefill = props.existingProfile;
  if (prefill?.socials) {
    for (const [k, v] of Object.entries(prefill.socials)) {
      if (k in socials) socials[k as SocialPlatform] = v ?? "";
    }
  }
  return {
    // Pre-fill from a rejected merchant's saved answers when present, else the
    // session-derived defaults (bug board #203).
    businessName:
      prefill?.businessName || (props.sessionName ? `${props.sessionName}'s Events` : ""),
    tradingName: prefill?.tradingName ?? "",
    abn: prefill?.abn ?? "",
    acn: prefill?.acn ?? "",
    eventCategoryIds: prefill?.eventCategoryIds ?? [],
    contactEmail: prefill?.contactEmail || props.sessionEmail,
    phone: prefill?.phone ?? "",
    websiteUrl: prefill?.websiteUrl ?? "",
    socials,
    addressStreet: prefill?.addressStreet ?? "",
    addressSuburb: prefill?.addressSuburb ?? "",
    addressState: (prefill?.addressState as AuState | "") ?? "",
    addressPostcode: prefill?.addressPostcode ?? "",
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
  existingProfile,
  children,
}: MerchantSignupProviderProps) {
  const [state, dispatch] = useReducer(
    reducer,
    { sessionEmail, sessionName, existingDocs, existingProfile },
    initialState,
  );
  return (
    <WizardContext.Provider value={{ state, dispatch, categories }}>
      {children}
    </WizardContext.Provider>
  );
}

// ---------- step validation ----------

// Accepts AU mobiles, landlines AND business numbers, in the formats people
// actually type:
//   0412 345 678 · 412 345 678 · 02 9646 8888 · (02) 9646 8888 ·
//   +61 2 9646 8888 · 9646 8888 · 1300 123 456 · 1800 123 456 · 13 12 34
// Strips spaces/brackets/dashes, normalises a +61 / 61 country code and a
// 9-digit mobile (missing leading 0) to a leading 0, then accepts national
// numbers, bare local landlines, and 13/1300/1800 business lines. Kept
// deliberately permissive — a false rejection on a real number is worse than
// letting an oddly-formatted one through (admins see it during verification).
function normalizeAuPhone(raw: string): string {
  let digits = raw.replace(/[^\d]/g, "");
  // +61 / 0061 country code → national trunk 0. Many people write the standard
  // "+61 (0)4.." / "+61 0412.." print convention and keep their own trunk 0, so
  // strip any leftover leading 0(s) before re-adding ours — otherwise we'd get a
  // double zero ("00412345678") that fails every pattern (bug board #202).
  if (digits.startsWith("0061")) digits = "0" + digits.slice(4).replace(/^0+/, "");
  else if (digits.startsWith("61") && digits.length >= 10) digits = "0" + digits.slice(2).replace(/^0+/, "");
  // Mobile typed without the leading 0 ("412 345 678") → add it back.
  if (/^4\d{8}$/.test(digits)) digits = "0" + digits;
  return digits;
}

// Display-grouping formatter, mirroring formatAbn/formatAcn's "tidy on blur"
// pattern (bug board #201). Cosmetic only — submit re-normalises via
// normalizeAuPhone, so grouping can't corrupt the stored value. Unknown shapes
// fall back to the trimmed input rather than mangling it.
function formatAuPhone(raw: string): string {
  const digits = normalizeAuPhone(raw);
  // Mobile: 04XX XXX XXX
  if (/^04\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // Landline with area code: 0X XXXX XXXX
  if (/^0[2-9]\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  // 1300 / 1800: 1300 XXX XXX
  if (/^1[38]00\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  // 13 xx xx short business line: 13 XX XX
  if (/^13\d{4}$/.test(digits)) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  }
  // Bare 8-digit local landline: XXXX XXXX
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return raw.trim();
}

// Pinpoints WHY a number fails so the inline error is actionable (bug board
// #144: a tester typed a 9-digit landline and only saw a generic "doesn't look
// like an AU number", which read as a bug rather than a typo).
function auPhoneHint(raw: string): string {
  const digits = normalizeAuPhone(raw);
  if (/^0[2378]/.test(digits) && digits.length !== 10) {
    return `Landlines need 10 digits including the area code - you've entered ${digits.length}. e.g. 02 9646 8888.`;
  }
  if (/^04/.test(digits) && digits.length !== 10) {
    return `Mobiles need 10 digits - you've entered ${digits.length}. e.g. 0412 345 678.`;
  }
  if (/^1[38]00/.test(digits) && digits.length !== 10) {
    return `1300/1800 numbers need 10 digits - you've entered ${digits.length}. e.g. 1300 123 456.`;
  }
  return "That doesn’t look like an AU number yet - try 0412 345 678, 02 9646 8888 or 1300 123 456.";
}

function isValidAuPhone(raw: string): boolean {
  const digits = normalizeAuPhone(raw);
  return (
    /^0[2-9]\d{8}$/.test(digits) || // 10-digit mobile or area-code landline
    /^\d{8}$/.test(digits) || // bare 8-digit local landline (no area code)
    /^1[38]00\d{6}$/.test(digits) || // 1300 / 1800 business line
    /^13\d{4}$/.test(digits) // 13 xx xx short business line
  );
}

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
    if (state.eventCategoryIds.length === 0)
      return "Pick at least one event category.";
    return null;
  }
  if (step === 1) {
    if (!state.contactEmail.includes("@")) return "Enter a valid contact email.";
    if (!isValidAuPhone(state.phone)) {
      return "Phone must be a valid Australian mobile or landline (e.g. 0412 345 678 or 02 9646 8888).";
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
      eventCategoryIds: state.eventCategoryIds,
      contactEmail: state.contactEmail.trim().toLowerCase(),
      phone: normalizeAuPhone(state.phone),
      websiteUrl: state.websiteUrl.trim(),
      // Only send platforms the host actually filled in.
      socials: Object.fromEntries(
        SOCIAL_PLATFORMS.map((p) => [p.value, state.socials[p.value].trim()]).filter(
          ([, handle]) => handle,
        ),
      ),
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
          className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper))] px-4 py-3 text-sm font-semibold text-[color:var(--danger)]"
        >
          {state.submitMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || state.submitState === "submitting"}
          className="ck-btn ck-btn--secondary ck-btn--md"
        >
          ← Back
        </button>

        <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
          Step {step + 1} of {STEP_COUNT} · {STEP_TITLES[step]}
        </span>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={state.submitState === "submitting"}
            className="ck-btn ck-btn--primary ck-btn--md"
          >
            {state.submitState === "submitting" ? "Submitting…" : "Submit application →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="ck-btn ck-btn--primary ck-btn--md"
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
  // Rendering is delegated to the shared merchant-ds WizardStepper.
  return <WizardStepper steps={STEP_TITLES} current={current} paths={STEP_PATHS} />;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
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
        <p className="eyebrow">Sign in first</p>
        <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-[color:var(--ink)]">
          One account for hosting and attending.
        </h2>
        <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--slate)]">
          We use the same identity for your Click attendee profile and your merchant portal.
          Sign in with Google, Facebook, or email - we’ll bring you straight back to the form.
        </p>
        <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--slate)]">
          Already a host?{" "}
          <Link href="/merchant/login" className="font-semibold text-[color:var(--purple)] underline underline-offset-4 hover:text-[color:var(--purple-hover)]">
            Log in to the host portal
          </Link>{" "}
          instead.
        </p>
      </div>

      <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
        <form action={signInWithGoogle} className="grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={!googleConfigured}
            className="ck-btn ck-btn--secondary ck-btn--lg ck-btn--full"
          >
            {googleConfigured ? "Continue with Google" : "Google · setup required"}
          </button>
        </form>

        <form action={signInWithMeta} className="mt-3 grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={!metaConfigured}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#1877F2] px-5 text-[15px] font-semibold text-white transition hover:bg-[#1566d6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {metaConfigured ? "Continue with Facebook" : "Facebook · setup required"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--mist)]" />
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            or with email
          </span>
          <span className="h-px flex-1 bg-[color:var(--mist)]" />
        </div>

        <form action={signInWithEmail} className="grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <label className="grid gap-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
            Business email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            />
          </label>
          <button type="submit" className="ck-btn ck-btn--primary ck-btn--lg">
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
    <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
      {children}
    </span>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)] ${props.className ?? ""}`}
    />
  );
}

// ---------- section · business ----------

export function BusinessSection() {
  const { state, dispatch, categories } = useWizard();
  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-semibold leading-tight">Business details</h3>

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
          <FieldLabel>ABN (optional · real registered ABN, e.g. 51 824 753 556)</FieldLabel>
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
        <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
          {selectedIds.length} selected
        </span>
      </legend>

      {categories.length === 0 ? (
        <p className="text-sm font-medium text-[color:var(--slate)]">
          No categories available - check your database connection.
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
                  className="ck-tag ck-tag--select ck-tag--selected"
                  aria-label={`Remove ${cat.name}`}
                >
                  {cat.name} ×
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
              className="w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-2.5 text-base text-[color:var(--ink)] outline-none focus:border-[color:var(--purple)] focus:ring-2 focus:ring-[color:var(--lavender-100)]"
            />
          </div>

          {available.length === 0 ? (
            <p className="text-sm font-medium text-[color:var(--slate)]">
              {q
                ? `No categories match “${query}”.`
                : "All categories selected - nice."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onToggle(cat.id)}
                  className="ck-tag ck-tag--select"
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
  // Mapbox occasionally omits the region/state on an address feature, which left
  // the State picker blank ("the correct state doesn't populate"). When that
  // happens but we got a postcode, derive the state from the AU postcode table
  // so it's filled in deterministically.
  async function handlePick(place: MapboxPlace) {
    dispatch({ type: "field", key: "addressStreet", value: place.street || place.name });
    if (place.suburb) dispatch({ type: "field", key: "addressSuburb", value: place.suburb });

    const mapboxState = (AU_STATES as readonly string[]).includes(place.state)
      ? place.state
      : "";
    if (mapboxState) {
      dispatch({ type: "field", key: "addressState", value: mapboxState });
    }
    if (/^[0-9]{4}$/.test(place.postcode)) {
      dispatch({ type: "field", key: "addressPostcode", value: place.postcode });
      if (!mapboxState) {
        const fallbackState = await lookupStateForPostcode(place.postcode);
        if (fallbackState) {
          dispatch({ type: "field", key: "addressState", value: fallbackState });
        }
      }
    }
  }

  // Manual postcode entry: once it's a full 4 digits, fill the state from the AU
  // table so users typing an address by hand don't have to pick the state too.
  async function handlePostcodeChange(raw: string) {
    const postcode = raw.replace(/\D/g, "").slice(0, 4);
    dispatch({ type: "field", key: "addressPostcode", value: postcode });
    if (postcode.length === 4) {
      const fallbackState = await lookupStateForPostcode(postcode);
      if (fallbackState) {
        dispatch({ type: "field", key: "addressState", value: fallbackState });
      }
    }
  }

  // Show the waitlist notice once the host has entered an out-of-Sydney area.
  const postcode = state.addressPostcode.trim();
  const outsidePilot = /^\d{4}$/.test(postcode) && !isSydneyPostcode(postcode);
  const areaLabel = state.addressSuburb.trim() || "That area";

  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-semibold leading-tight">Contact & address</h3>

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
            inputMode="tel"
            autoComplete="tel"
            value={state.phone}
            onChange={(e) => dispatch({ type: "field", key: "phone", value: e.target.value })}
            onBlur={() =>
              dispatch({ type: "field", key: "phone", value: formatAuPhone(state.phone) })
            }
            placeholder="0412 345 678"
            aria-invalid={state.phone.trim() !== "" && !isValidAuPhone(state.phone)}
            required
          />
          {state.phone.trim() === "" ? (
            <p className="text-xs font-medium leading-5 text-[color:var(--slate)]">
              Mobile, landline or business line - e.g. 0412 345 678, 02 9646 8888 or 1300 123 456. Spaces, brackets and +61 are fine.
            </p>
          ) : isValidAuPhone(state.phone) ? (
            <p className="text-xs font-semibold leading-5 text-[color:var(--purple)]">
              ✓ Looks good.
            </p>
          ) : (
            <p className="text-xs font-semibold leading-5 text-[color:var(--danger)]">
              {auPhoneHint(state.phone)}
            </p>
          )}
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

      <div className="grid gap-2.5">
        <FieldLabel>Social profiles (optional)</FieldLabel>
        <div className="grid gap-2.5">
          {SOCIAL_PLATFORMS.map((opt) => (
            <label
              key={opt.value}
              className="grid gap-1.5 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-3"
            >
              <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
                {opt.label}
              </span>
              <TextInput
                value={state.socials[opt.value]}
                onChange={(e) =>
                  dispatch({ type: "social", platform: opt.value, value: e.target.value })
                }
                placeholder={opt.placeholder}
                aria-label={`${opt.label} handle`}
              />
            </label>
          ))}
        </div>
        <span className="text-xs font-medium text-[color:var(--mauve)]">
          Add any networks you&apos;re on - handy for verifying hosts who don&apos;t have formal documents yet.
        </span>
      </div>

      <label className="grid gap-2">
        <FieldLabel>Street address *</FieldLabel>
        <MapboxAutocomplete
          value={state.addressStreet}
          onValueChange={(v) => dispatch({ type: "field", key: "addressStreet", value: v })}
          onSelect={handlePick}
          placeholder="Start typing - e.g. 42 Crown Street, Surry Hills"
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
            onChange={(e) => handlePostcodeChange(e.target.value)}
            placeholder="2010"
            required
          />
        </label>
      </div>

      {outsidePilot ? (
        <p
          role="status"
          className="rounded-xl bg-[color:var(--lavender-100)] px-4 py-3 text-sm leading-6 text-[color:var(--ink)]"
        >
          <span className="font-semibold">{areaLabel} is outside our Sydney pilot.</span>{" "}
          You can still apply - we&apos;ll add you to the waitlist and email you the moment we launch in your area.
        </p>
      ) : null}
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
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--purple)] ${
          open
            ? "border-[color:var(--purple)]"
            : "border-[color:var(--mist)] hover:border-[color:var(--slate)]"
        }`}
      >
        <span className={value ? "" : "text-[color:var(--slate)]"}>
          {value || "-"}
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
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl bg-[color:var(--paper)] p-2 shadow-[var(--shadow-md)]"
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
                    className={`flex w-full flex-col items-start gap-0.5 rounded-xl border px-2.5 py-1.5 text-left ${
                      selected
                        ? "border-transparent bg-[color:var(--purple)] text-[color:var(--champagne)]"
                        : "border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                    }`}
                  >
                    <span className="text-sm font-semibold leading-tight">{s}</span>
                    <span
                      className={`text-[11px] font-medium leading-tight ${
                        selected ? "text-[color:var(--champagne)]/80" : "text-[color:var(--slate)]"
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
      <h3 className="font-display text-3xl font-semibold leading-tight">Documents</h3>
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
    <div className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        {existing ? (
          <span className="inline-flex items-center rounded-lg bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] px-2 py-0.5 text-xs font-semibold text-[color:var(--sage)]">
            Uploaded
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
        className="text-sm font-medium text-[color:var(--ink)] file:mr-3 file:rounded-xl file:border file:border-[color:var(--mist)] file:bg-[color:var(--paper)] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--ink)] hover:file:bg-[color:var(--lavender-100)]"
      />
      {busy ? (
        <p className="text-xs font-medium text-[color:var(--slate)]">Uploading…</p>
      ) : null}
      {error ? (
        <p className="text-xs font-semibold text-[color:var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
