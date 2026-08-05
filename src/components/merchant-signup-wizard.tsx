"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
import { useFormDraft } from "@/lib/use-form-draft";
import { MapboxAutocomplete, type MapboxPlace } from "./mapbox-autocomplete";
import { Badge, Button, EndowedProgress } from "./ds";
import { SubmitButton } from "./ds-client";
import { InfoNote, WizardStepper } from "./merchant-ds";

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

// MIRRORS the server constants at src/app/api/merchant/documents/route.ts:30-31,
// deliberately value-for-value. The route can only reject AFTER request.formData()
// has buffered the whole body, so a 15 MB scan on 4G spends its entire upload
// earning a "max 5 MB" - the only place that check helps anyone is here, before
// the send. These numbers and the route's MUST move together; the honest home for
// them is one shared module both sides import (see notesForHuman - this component
// cannot import the route without dragging node:crypto and the repository into the
// client bundle).
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;
const ALLOWED_UPLOAD_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
// The picker filter and the guard read from one list, so they cannot disagree.
const UPLOAD_ACCEPT = ALLOWED_UPLOAD_MIME.join(",");

/**
 * The client-side half of the upload contract. Returns the message to show, or
 * null when the file is fine. Kept exactly as strict as the route and no
 * stricter: a file this returns null for is a file the route accepts, so we can
 * never block a legal document locally. An empty file.type (some Android
 * pickers) fails both sides identically.
 */
function uploadRejection(file: File): string | null {
  if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.type)) {
    return "That file needs to be a PDF, JPG or PNG.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `That file is ${mb} MB and the limit is ${MAX_UPLOAD_MB} MB. A photo of the document, or a smaller scan, will do.`;
  }
  return null;
}

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

// Wizard state lives in a context mounted in the route LAYOUT, so it survives
// client-side navigation between the step pages - but not a full page load. A
// refresh on step 3, or opening a step URL cold, used to reset every field to
// blank while the uploaded documents (which POST immediately) still showed as
// "Uploaded", so the wizard looked half-filled and Submit threw you back to
// step 1. Mirror the answers into sessionStorage the way the event-create
// wizard already does.
// Persistence now runs through the shared useFormDraft hook, which wraps the
// answers in a { v, values } envelope rather than the flat { v, ...fields } this
// file used to write. DRAFT_VERSION stays at 1 deliberately: the FIELD shape did
// not change, and the hook already drops any stored draft whose `values` is
// missing, so a flat leftover is discarded rather than half-applied.
const STORAGE_KEY = "click:merchant-signup-draft";
const DRAFT_VERSION = 1;

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

// The answer fields only - `uploads` is rebuilt server-side from
// listMerchantDocuments, and submit status is per-attempt.
type DraftFields = Omit<State, "uploads" | "submitState" | "submitMessage">;

const DRAFT_FIELD_KEYS: ReadonlyArray<keyof DraftFields> = [
  "businessName",
  "tradingName",
  "abn",
  "acn",
  "eventCategoryIds",
  "contactEmail",
  "phone",
  "websiteUrl",
  "socials",
  "addressStreet",
  "addressSuburb",
  "addressState",
  "addressPostcode",
];

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
  | { type: "hydrate"; values: Partial<DraftFields> }
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
    case "hydrate":
      return { ...state, ...action.values };
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
  /** True once a saved draft has actually been applied - drives the quiet
      "picked up where you left off" note, so a pre-filled form never looks
      like it filled itself in. */
  draftRestored: boolean;
  /** Drop the saved draft. SUCCESS BRANCH ONLY - never before the write lands. */
  clearDraft: () => void;
  /** A rejected merchant editing their existing application. Derived from the
      prefill rather than the layout's isRejectedResubmit flag on purpose: the
      note says "pre-filled", so it must follow whether answers ACTUALLY came
      back, not whether we went looking for them. */
  resubmitting: boolean;
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

  // Only the answer fields ride in the draft - `uploads` is rebuilt server-side
  // from listMerchantDocuments on every load, and submit status is per-attempt.
  // Memoised on `state` so the hook writes once per real change rather than once
  // per render.
  const draftValues = useMemo(() => {
    const values: Partial<DraftFields> = {};
    for (const key of DRAFT_FIELD_KEYS) Object.assign(values, { [key]: state[key] });
    return values as DraftFields;
  }, [state]);

  // Restore, then persist - via the shared hook, which owns the two rules this
  // used to hand-roll: the read happens in an effect (never a lazy initializer,
  // or the server and first client render disagree) and writes stop dead once
  // clear() has run, so submitting can't have its own draft rewritten back over
  // the top of it a render later.
  //
  // sessionStorage, deliberately, NOT localStorage: the draft carries an ABN, a
  // phone number and a street address, and localStorage would leave that sitting
  // on a shared or borrowed device long after the tab closed. The cost is a draft
  // that dies with the tab, which the restored note below softens.
  const { restored, clear } = useFormDraft<DraftFields>({
    key: STORAGE_KEY,
    version: DRAFT_VERSION,
    storage: "session",
    values: draftValues,
    apply: (saved) => {
      const values: Partial<DraftFields> = {};
      for (const key of DRAFT_FIELD_KEYS) {
        if (saved[key] !== undefined) Object.assign(values, { [key]: saved[key] });
      }
      dispatch({ type: "hydrate", values });
    },
  });

  const resubmitting = Boolean(existingProfile);

  const value = useMemo<WizardContextValue>(
    () => ({
      state,
      dispatch,
      categories,
      draftRestored: restored,
      clearDraft: clear,
      resubmitting,
    }),
    [state, categories, restored, clear, resubmitting],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
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
  const { state, dispatch, draftRestored, clearDraft, resubmitting } = useWizard();
  const router = useRouter();
  const isLast = step === STEP_COUNT - 1;
  const submitting = state.submitState === "submitting";

  function goNext() {
    const error = validateStep(step, state);
    if (error) {
      dispatch({ type: "submitError", message: error });
      return;
    }
    router.push(STEP_PATHS[step + 1]);
  }

  function goBack() {
    // Back stays focusable while the application is in flight (aria-disabled,
    // not disabled - a browser blurs a control you disable under the user's
    // finger and dumps keyboard users to the top of the document), so the guard
    // has to live here.
    if (submitting) return;
    if (step > 0) {
      router.push(STEP_PATHS[step - 1]);
    }
  }

  async function submit() {
    if (submitting) return;
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

    try {
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
      // Only now, on the success branch - clearing before the POST lands would
      // take the answers with it if the request failed.
      clearDraft();
      router.push("/merchant-pending");
      router.refresh();
    } catch {
      // A dropped connection used to leave the button spinning forever with
      // nothing said. Put the form back the way it was and name the failure.
      dispatch({
        type: "submitError",
        message:
          "We couldn't reach Click just then - check your connection and send it again. Everything you typed is still here.",
      });
    }
  }

  return (
    <div className="grid gap-6">
      {/* ONE progress cluster, at the top. The dots say WHERE you are and let you
          jump back; the endowed bar says HOW FAR, and its counter line carries the
          step name on phones, where the dot labels are hidden. The counter that
          used to sit down beside the Next button said the same thing 700px away
          from this one, so it's gone. */}
      <div className="rise-soft grid gap-3">
        <StepIndicator current={step} />
        <EndowedProgress
          step={step}
          total={STEP_COUNT}
          label={`Step ${step + 1} of ${STEP_COUNT} · ${STEP_TITLES[step]}`}
        />
      </div>

      {/* At most ONE note here. A resubmitting host needs to know why the form is
          already full far more than they need to know a draft was restored, and
          two stacked lavender notes above the card is a wall, not reassurance.
          The rejection reason itself is not stored anywhere this wizard can read
          it - it travels by email - so the note points there rather than
          inventing a quote. */}
      {resubmitting ? (
        <div className="rise-soft rise-d1">
          <InfoNote icon="info">
            This is your existing application, filled in as you left it. Update whatever the
            review team asked about in their email, then send it again - it goes back into the
            queue for another look.
          </InfoNote>
        </div>
      ) : draftRestored ? (
        <div className="rise-soft rise-d1">
          <InfoNote icon="info">
            Picked up where you left off - the answers you had already typed are still here.
          </InfoNote>
        </div>
      ) : null}

      <SectionCard>{children}</SectionCard>

      {state.submitMessage ? (
        <p
          role="alert"
          className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper))] px-4 py-3 text-sm font-semibold text-[color:var(--danger)]"
        >
          {state.submitMessage}
        </p>
      ) : null}

      <div className="rise-soft rise-d3 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={goBack}
          disabled={step === 0}
          aria-disabled={submitting || undefined}
        >
          ← Back
        </Button>

        {isLast ? (
          <Button
            type="button"
            onClick={submit}
            loading={submitting}
            // The spinner hides the label, and a visibility:hidden label is gone
            // from the accessibility tree too - this keeps the button named while
            // it spins.
            aria-label="Submit application"
          >
            Submit application →
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Next →
          </Button>
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
  // The wizard's whole entrance choreography is three beats - progress, card,
  // nav - because each step page is a fresh mount, so it replays on every Next
  // and Back. rise-soft is 240ms/8px with fill `both`, so it ENDS at opacity 1
  // and a re-render can't restart it: the resting state is always visible and
  // the motion is purely additive. The global reduced-motion block collapses it;
  // never add a per-component media query for that.
  return (
    <div className="rise-soft rise-d2 rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
      {children}
    </div>
  );
}

// ---------- step 0 (auth gate) ----------

// Meta's brand blue. A provider button that isn't the provider's colour reads as
// a fake, so the FILL is a legitimate exception to the palette rule - the
// GEOMETRY is not, and comes from ck-btn like every other button in the app.
// This is Meta blue one step down (#1877F2's own hover shade): the cream ck-btn
// label lands at 4.9:1 on it and only 3.9:1 on #1877F2, which is under AA at the
// 16px the lg button uses. Wants to be a --fb-blue token in globals.css, which
// this component does not own - see notesForHuman.
const FB_BLUE = "#1566D6";

export function StepAuthCard({
  googleConfigured,
  metaConfigured,
  emailSent = false,
}: {
  googleConfigured: boolean;
  metaConfigured: boolean;
  emailSent?: boolean;
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
        {emailSent ? (
          <p
            role="status"
            className="mb-4 rounded-xl bg-[color:var(--lavender-100)] px-4 py-3 text-sm leading-6 text-[color:var(--ink)]"
          >
            Check your inbox - we&apos;ve sent a one-time link. Open it and we&apos;ll bring you
            straight back to the host application.
          </p>
        ) : null}

        {/* SubmitButton reads useFormStatus, so these three carry a real pending
            state during the round trip to the provider instead of looking idle. */}
        <form action={signInWithGoogle} className="grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <SubmitButton variant="secondary" size="lg" full disabled={!googleConfigured}>
            {googleConfigured ? "Continue with Google" : "Google · setup required"}
          </SubmitButton>
        </form>

        {metaConfigured ? (
          <form action={signInWithMeta} className="mt-3 grid gap-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <SubmitButton size="lg" full style={{ backgroundColor: FB_BLUE }}>
              Continue with Facebook
            </SubmitButton>
          </form>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--mist)]" />
          <span className="text-[12.5px] font-semibold text-[color:var(--slate)]">
            or with email
          </span>
          <span className="h-px flex-1 bg-[color:var(--mist)]" />
        </div>

        <form action={signInWithEmail} className="grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          {/* Answer the "check your inbox" back here, on the host funnel - not
              on the attendee login page saying "Welcome back". */}
          <input type="hidden" name="mode" value="signup" />
          <input type="hidden" name="formPath" value="/merchant/signup" />
          <label className="grid gap-2 text-[12.5px] font-semibold text-[color:var(--slate)]">
            Business email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              className="ck-input w-full"
            />
          </label>
          <SubmitButton size="lg">Continue →</SubmitButton>
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

// The control treatment is .ck-input (globals.css, beside .ck-btn) - one class
// for every input in the app, and no local focus string to drift from it. The
// wrapper stays because these fields still use their own 12.5px Slate label; the
// shared FormField is the migration this file has not taken yet.
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`ck-input w-full ${props.className ?? ""}`} />;
}

// ---------- section · business ----------

export function BusinessSection() {
  const { state, dispatch, categories } = useWizard();
  return (
    <div className="grid gap-5">
      <h2 className="font-display text-3xl font-semibold leading-tight">Business details</h2>

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
              className="ck-input w-full"
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
      <h2 className="font-display text-3xl font-semibold leading-tight">Contact & address</h2>

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
        <span className="text-xs font-medium text-[color:var(--slate)]">
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
        <span className="text-xs font-medium text-[color:var(--slate)]">
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
      <h2 className="font-display text-3xl font-semibold leading-tight">Documents</h2>
      {/* Written for a restaurant owner, not an engineer: the sentence this
          replaced said "private Supabase Storage bucket" and "signed URLs", which
          is leaked plumbing on the one step where trust is being asked for. It
          also never said the thing that actually settles nerves - none of this is
          required to send the application. */}
      <InfoNote icon="lock">
        These let the review team confirm your business is yours. They stay private to you and
        the Click review team - nothing here appears on your public host page. Every one is
        optional, so you can send your application now and add documents later.
      </InfoNote>

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

type UploadResponse = { error?: string; document?: { file_name: string } };

// "sending" = bytes on the wire · "finishing" = bytes delivered, server still
// writing to storage and the metadata row. The second phase is short on wifi and
// very much not short on 4G, and it is the reason the bar must never park at 100.
type UploadPhase = "idle" | "sending" | "finishing";

/**
 * POSTs one document and reports how much of it has gone.
 *
 * XMLHttpRequest, not fetch, for exactly one reason: fetch cannot report
 * request-body progress, and this is the slowest wait in the whole application.
 * Everything else about the contract is identical to the fetch call it replaced.
 * Resolves for any HTTP reply (`ok` says which); rejects only when the request
 * never completed, so a dropped connection is distinguishable from a rejection.
 */
function uploadDocument(
  documentType: DocumentType,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<{ ok: boolean; body: UploadResponse }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("document_type", documentType);
    form.set("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/merchant/documents");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    });
    xhr.addEventListener("load", () => {
      let body: UploadResponse = {};
      try {
        body = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        // A proxy error page rather than our JSON - the caller's fallback
        // message covers it.
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body });
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed to complete.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload was interrupted.")));
    xhr.send(form);
  });
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
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [sentFraction, setSentFraction] = useState(0);
  const [error, setError] = useState("");
  const existing = state.uploads[documentType];
  const busy = phase !== "idle";

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input straight away - before any early return - so re-picking
    // the same file fires onChange again, including after a rejection. The File
    // reference above survives it.
    event.target.value = "";
    if (!file) return;

    // The input stays focusable while busy (see aria-disabled below), so this is
    // where a second pick gets caught. Silence here would look like a dead
    // control.
    if (busy) {
      setError("One at a time - this row is still uploading.");
      return;
    }

    // Ahead of the network, not after it. The route cannot see the size until it
    // has buffered the whole body, so without this an oversized file spends its
    // entire upload earning a rejection we already knew about.
    const rejection = uploadRejection(file);
    if (rejection) {
      setError(rejection);
      return;
    }

    setError("");
    setSentFraction(0);
    setPhase("sending");
    try {
      const result = await uploadDocument(documentType, file, (fraction) => {
        setSentFraction(fraction);
        if (fraction >= 1) setPhase("finishing");
      });
      if (!result.ok) {
        setError(result.body.error ?? "That upload didn't go through. Pick the file again.");
        return;
      }
      dispatch({
        type: "upload",
        docType: documentType,
        info: { fileName: result.body.document?.file_name ?? file.name },
      });
      // The only message that can still be on screen here is the "one at a time"
      // note from a pick made mid-upload, and it is now stale.
      setError("");
    } catch {
      // A dropped connection used to land in a bare finally: busy cleared,
      // nothing said, and the row looked exactly as it had before the pick. A
      // failure must never be indistinguishable from nothing happening.
      setError("The upload stopped partway - check your connection and pick the file again.");
    } finally {
      setPhase("idle");
    }
  }

  // Endowed: 8% the instant the first byte moves so the bar is never empty, and
  // capped below 100 until the server has actually confirmed - 100 belongs to
  // the Uploaded badge, not to the last packet. EndowedProgress clamps to the
  // same 8..96 window; `step` is one under the percentage so aria-valuenow reads
  // as the true number out of 100.
  const shownPct = phase === "finishing" ? 96 : Math.max(8, Math.round(sentFraction * 100));

  // One phase-level announcement, not a percentage ticker - a live region firing
  // on every percent is noise, and the progressbar already carries the number.
  // The error line announces itself through role="alert".
  const liveStatus = busy
    ? phase === "finishing"
      ? "Almost done, finishing your upload."
      : "Uploading your document."
    : existing
      ? `Uploaded ${existing.fileName}.`
      : "";

  return (
    <div
      aria-busy={busy || undefined}
      className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        {existing ? (
          // The DS Badge, not a hand-rolled span: the raw --sage hue on its own
          // 14% tint is the contrast regression BADGE_TONE warns about, and Badge
          // carries the AA-safe --sage-ink instead. pop-in gives the settled
          // moment its weight without particles.
          <span className="pop-in inline-flex">
            <Badge tone="sage">Uploaded</Badge>
          </span>
        ) : null}
      </div>
      {existing ? (
        <p className="text-sm font-semibold text-[color:var(--ink)]">{existing.fileName}</p>
      ) : null}
      <input
        type="file"
        accept={UPLOAD_ACCEPT}
        onChange={onChange}
        // aria-disabled, not disabled: disabling a control the user just used
        // blurs it, and a keyboard user lands back at the top of the document.
        // The guard in onChange is what actually blocks the second pick.
        aria-disabled={busy || undefined}
        className="text-sm font-medium text-[color:var(--ink)] file:mr-3 file:rounded-xl file:border file:border-[color:var(--mist)] file:bg-[color:var(--paper)] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--ink)] hover:file:bg-[color:var(--lavender-100)]"
      />
      {/* The constraints live beside the input that enforces them, from the same
          constants the guard and the picker filter use. */}
      <p className="text-xs font-medium text-[color:var(--slate)]">
        PDF, JPG or PNG · up to {MAX_UPLOAD_MB} MB
      </p>
      {busy ? (
        <EndowedProgress
          step={shownPct - 1}
          total={100}
          pct={shownPct}
          label={phase === "finishing" ? "Finishing up…" : `Uploading… ${shownPct}%`}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-[color:var(--danger)]">
          {error}
        </p>
      ) : null}
      <p className="sr-only" role="status">
        {liveStatus}
      </p>
    </div>
  );
}
