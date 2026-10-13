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
  type RefObject,
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
import {
  auPhoneHint,
  auPhoneProgress,
  formatAuPhone,
  formatAuPhoneAsYouType,
  isValidAuPhone,
  normalizeAuPhone,
  validateAuPhone,
} from "@/lib/au-phone";
import { isWithinSydneyPilot } from "@/lib/geo";
import { validateWebsiteUrl } from "@/lib/website-url";
import { useFormDraft } from "@/lib/use-form-draft";
import { MapboxAutocomplete, type MapboxPlace } from "./mapbox-autocomplete";
import { Badge, Button, EndowedProgress, FormField } from "./ds";
import { SubmitButton } from "./ds-client";
import { InfoNote } from "./merchant-ds";
import { useDisclosure } from "./use-disclosure";

// Merchant signup - ONE page (spec §1, cut down for friction):
//   /merchant/signup · logged out: the OAuth/email auth gate (StepAuthCard)
//                      signed in: this form (MerchantSignupForm)
//
// It used to be a three-step wizard - business, contact, then a review page of
// optional uploads - with nine required answers. Now four things are asked for
// up front: a name, a contact email (pre-filled), a phone number and the venue
// address (one autocomplete fills suburb, state and postcode). Everything the
// platform can run without - trading name, ABN/ACN, website, socials, event
// categories, documents - sits folded in "More about the business". How the
// business is legally set up is asked at the payout step instead, the first
// time it matters (src/lib/business-type.ts). Inside the Sydney pilot the
// submit makes them a host on the spot (registerMerchantWizardSubmit).
//
// Form state lives in a React context provided by <MerchantSignupProvider>,
// mounted in the route's layout, and is mirrored to sessionStorage so a refresh
// keeps the answers. Documents upload immediately on file-pick to
// /api/merchant/documents; everything else commits on submit.

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

// Saved merchant-signup answers used to pre-fill the form when a rejected
// merchant re-opens it to edit + resubmit (bug board #203). Structural match for
// the repository's MerchantSignupPrefill - kept loose so the component doesn't
// import server code. (The repository also returns businessType, which this
// form no longer asks - the payout step does.)
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
  // Present only for a rejected merchant resubmitting - pre-fills every field.
  existingProfile?: MerchantSignupPrefill | null;
  children: React.ReactNode;
};

// Form state lives in a context mounted in the route LAYOUT. A refresh, or
// opening the page cold, used to reset every field to blank while the uploaded
// documents (which POST immediately) still showed as "Uploaded", so the form
// looked half-filled. Mirror the answers into sessionStorage the way the
// event-create wizard already does.
// Persistence now runs through the shared useFormDraft hook, which wraps the
// answers in a { v, values } envelope rather than the flat { v, ...fields } this
// file used to write. DRAFT_VERSION stays at 1 deliberately: the FIELD shape did
// not change in any way that matters - apply() below copies only the keys in
// DRAFT_FIELD_KEYS, so a draft saved before businessType moved to the payout
// step restores cleanly and the stale key is ignored. The hook already drops any
// stored draft whose `values` is missing, so a flat leftover is discarded rather
// than half-applied.
const STORAGE_KEY = "click:merchant-signup-draft";
const DRAFT_VERSION = 1;

/* One message per offending field, rather than one message per attempt. The old
   validator returned a single string and bailed on the FIRST failure, so a host
   with three missing fields learned one requirement per Next - from a strip down
   by the nav buttons that never said which field it meant. Same shape and same
   "focus the first offender" rule as the event-create wizard's FieldErrors, so
   the two forms behave identically.

   A const list rather than a union derived from State: State carries the error
   map itself, so deriving the keys from it would make the type circular, and the
   list doubles as the runtime guard on a server-supplied field name. DOM order,
   so "focus the first offender" lands on the topmost field. */
const ERROR_FIELDS = [
  "businessName",
  "contactEmail",
  "phone",
  "addressStreet",
  "addressSuburb",
  "addressState",
  "addressPostcode",
  "abn",
  "acn",
  "websiteUrl",
] as const;
type ErrorField = (typeof ERROR_FIELDS)[number];

type FieldErrors = Partial<Record<ErrorField, string>>;

/* The fields that live inside the folded "More about the business" section. A
   mark on one of them is invisible while the section is closed, so the form
   opens it before marking or focusing. */
const MORE_SECTION_FIELDS: ReadonlyArray<ErrorField> = ["abn", "acn", "websiteUrl"];

function isErrorField(value: unknown): value is ErrorField {
  return typeof value === "string" && (ERROR_FIELDS as readonly string[]).includes(value);
}

/** DOM id for a field's control, so validation can focus the one at fault.
    Composite controls (address, state) anchor their WRAPPER instead of an
    input - `focusFieldAnchor` reaches inside for the real control. */
function fieldAnchorId(field: ErrorField) {
  return `ms-field-${field}`;
}

/* Editing a field retires its error - leaving it up while the host fixes the
   value is how a form starts reading as broken rather than picky. Returns the
   SAME map when there was nothing to clear, so an ordinary keystroke doesn't
   allocate a new object per character. */
function withoutError(errors: FieldErrors, key: string): FieldErrors {
  if (!(key in errors)) return errors;
  const next = { ...errors };
  delete next[key as ErrorField];
  return next;
}

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
  // One handle per network - empty string means "not on it".
  socials: Record<SocialPlatform, string>;
  addressStreet: string;
  addressSuburb: string;
  addressState: AuState | "";
  addressPostcode: string;
  // Documents
  uploads: Record<DocumentType, { fileName: string } | null>;
  // Validation - one entry per offending field, keyed so each control can render
  // its own message. The strip above the button only carries the summary.
  fieldErrors: FieldErrors;
  // Submission
  submitState: "idle" | "submitting" | "success" | "error";
  submitMessage: string;
};

// The answer fields only - `uploads` is rebuilt server-side from
// listMerchantDocuments, submit status is per-attempt, and `fieldErrors` is a
// verdict on the answers rather than an answer (a restored draft re-validates
// on the next submit, so persisting stale marks would be noise).
type DraftFields = Omit<
  State,
  "uploads" | "fieldErrors" | "submitState" | "submitMessage"
>;

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
        | "uploads"
        | "fieldErrors"
        | "submitState"
        | "submitMessage"
        | "eventCategoryIds"
        | "socials"
      >;
      value: string;
    }
  | { type: "social"; platform: SocialPlatform; value: string }
  | { type: "toggleCategory"; id: string }
  | { type: "upload"; docType: DocumentType; info: { fileName: string } | null }
  | { type: "hydrate"; values: Partial<DraftFields> }
  /** Both halves of a validation verdict in one dispatch: the per-field marks and
      the summary strip. */
  | { type: "validation"; errors: FieldErrors; message: string }
  | { type: "submitStart" }
  | { type: "submitError"; message: string }
  /** A server rejection that named the field it is about, so the offending input
      gets marked the same way a client-side failure would. */
  | { type: "submitFieldError"; field: ErrorField; message: string }
  | { type: "submitSuccess" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "field":
      // Editing any field invalidates a stale submit error - and the mark on the
      // field being edited, which is now a verdict on a value that no longer
      // exists.
      return {
        ...state,
        [action.key]: action.value,
        fieldErrors: withoutError(state.fieldErrors, action.key),
        submitMessage: "",
      };
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
    case "validation":
      return { ...state, fieldErrors: action.errors, submitMessage: action.message };
    case "submitStart":
      return { ...state, submitState: "submitting", fieldErrors: {}, submitMessage: "" };
    case "submitError":
      return { ...state, submitState: "error", submitMessage: action.message };
    case "submitFieldError":
      return {
        ...state,
        submitState: "error",
        fieldErrors: { [action.field]: action.message },
        submitMessage: action.message,
      };
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
    fieldErrors: {},
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
  // or the server and first client render disagree), and clear() opens a narrow
  // window rather than a permanent latch. Inside that window the hook writes
  // nothing while the values stay byte-identical to the ones clear() saw, so the
  // re-renders that FOLLOW a submit can't resurrect the draft it just removed -
  // but the moment the host genuinely edits something again, drafting resumes.
  // That matters here because submit() can fail and leave the form open: from
  // the next keystroke on, the form is protected again.
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

// ---------- validation ----------

// normalizeAuPhone / formatAuPhone / auPhoneHint / isValidAuPhone now live in
// src/lib/au-phone.ts - the server validates the submitted number with the same
// module, so what the form calls valid can no longer be rejected on submit.

/* Every failure, not just the first. Insertion order below is DOM order, and
   Object.keys preserves it for string keys - that is what makes "focus the first
   offender" land on the topmost field rather than an arbitrary one. */
function validateApplication(state: State): FieldErrors {
  const errors: FieldErrors = {};

  const name = state.businessName.trim();
  if (name.length < 2 || name.length > 100) {
    errors.businessName = "Name must be 2-100 characters.";
  }
  if (!state.contactEmail.includes("@")) {
    errors.contactEmail = "Enter a valid contact email.";
  }
  const phoneError = validateAuPhone(state.phone);
  if (phoneError) errors.phone = phoneError;
  if (!state.addressStreet.trim()) errors.addressStreet = "Add the street address.";
  if (!state.addressSuburb.trim()) errors.addressSuburb = "Add the suburb.";
  if (!state.addressState) errors.addressState = "Pick a state.";
  if (!/^[0-9]{4}$/.test(state.addressPostcode.trim())) {
    errors.addressPostcode = "Postcode must be 4 digits.";
  }

  // The optional section: only the format is checked, and only when something
  // was actually typed (each validator passes an empty value). The server
  // normalises a website to https and refuses anything that isn't a domain, so
  // checking it here keeps that refusal on the field.
  const abnError = validateOptionalAbn(state.abn);
  if (abnError) errors.abn = abnError;
  const acnError = validateOptionalAcn(state.acn);
  if (acnError) errors.acn = acnError;
  const websiteError = validateWebsiteUrl(state.websiteUrl);
  if (websiteError) errors.websiteUrl = websiteError;

  // Categories and documents are optional - admins can ask for follow-ups.
  return errors;
}

/** Same predicate the server branches on (isWithinPilotArea is this function),
    so the notice, the button label and the outcome they're emailed agree. */
function isOutsidePilot(state: State): boolean {
  const postcode = state.addressPostcode.trim();
  return /^\d{4}$/.test(postcode) && !isWithinSydneyPilot(state.addressState || null, postcode);
}

/**
 * Move focus onto the control that failed, and bring it into view.
 *
 * Most fields anchor a real input, which is the easy case. The address
 * autocomplete and the state popover are composites whose control is owned by
 * a child component we don't pass ids through, so those anchor their WRAPPER
 * and we reach inside for the first focusable thing.
 */
function focusFieldAnchor(field: ErrorField) {
  const anchor = document.getElementById(fieldAnchorId(field));
  if (!anchor) return;
  const target = anchor.matches("input, select, textarea, button")
    ? anchor
    : anchor.querySelector<HTMLElement>("input, select, textarea, button");
  target?.focus();
  (target ?? anchor).scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- the form ----------

export function MerchantSignupForm() {
  const { state, dispatch, draftRestored, clearDraft, resubmitting } = useWizard();
  const router = useRouter();
  const submitting = state.submitState === "submitting";
  const moreRef = useRef<HTMLDetailsElement>(null);

  const submitLabel = resubmitting
    ? "Resubmit application →"
    : isOutsidePilot(state)
      ? "Join the host waitlist →"
      : "Start hosting →";

  /** Open the folded section when a mark lands inside it, then land the host
      ON the first offender. The strip by the button says something is wrong;
      only this says where. */
  function revealAndFocus(fields: ErrorField[]) {
    if (moreRef.current && fields.some((field) => MORE_SECTION_FIELDS.includes(field))) {
      moreRef.current.open = true;
    }
    requestAnimationFrame(() => focusFieldAnchor(fields[0]));
  }

  async function submit() {
    if (submitting) return;

    const errors = validateApplication(state);
    const offenders = Object.keys(errors) as ErrorField[];
    if (offenders.length > 0) {
      // One failure reads better as itself than as a count of one.
      const summary =
        offenders.length === 1
          ? (errors[offenders[0]] as string)
          : `${offenders.length} things still need a moment - they're marked below.`;
      dispatch({ type: "validation", errors, message: summary });
      revealAndFocus(offenders);
      return;
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

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        field?: string;
        merchant?: { verification_status?: string };
      };
      if (!response.ok) {
        const message = body.error ?? "Submission failed.";
        // A rejection has to land ON the field it is about, not as a bare
        // sentence by the button with nothing marked.
        if (isErrorField(body.field)) {
          dispatch({ type: "submitFieldError", field: body.field, message });
          revealAndFocus([body.field]);
          return;
        }
        dispatch({ type: "submitError", message });
        return;
      }

      dispatch({ type: "submitSuccess" });
      // Only now, on the success branch - clearing before the POST lands would
      // take the answers with it if the request failed.
      clearDraft();
      // Inside the pilot a new host is approved on the spot, so they go
      // straight into the host portal's first-run walkthrough, whose first
      // button builds an event. A waitlisted host, or a rejected one sending it
      // back, is 'pending' and belongs on the holding page that explains which.
      router.push(
        body.merchant?.verification_status === "approved" ? "/merchant/onboarding" : "/merchant-pending",
      );
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
      {/* At most ONE note here. A resubmitting host needs to know why the form is
          already full far more than they need to know a draft was restored, and
          two stacked lavender notes above the card is a wall, not reassurance.
          The rejection reason itself is not stored anywhere this form can read
          it - it travels by email - so the note points there rather than
          inventing a quote. */}
      {resubmitting ? (
        <div className="rise-soft">
          <InfoNote icon="info">
            This is your existing application, filled in as you left it. Update whatever the
            review team asked about in their email, then send it again - it goes back into the
            queue for another look.
          </InfoNote>
        </div>
      ) : draftRestored ? (
        <div className="rise-soft">
          <InfoNote icon="info">
            Picked up where you left off - the answers you had already typed are still here.
          </InfoNote>
        </div>
      ) : null}

      <SectionCard>
        <div className="grid gap-5">
          <FormField
            label="Business or host name"
            required
            hint="Shown on your events. Just you? Your own name works."
            error={state.fieldErrors.businessName}
            id={fieldAnchorId("businessName")}
            value={state.businessName}
            onChange={(e) => dispatch({ type: "field", key: "businessName", value: e.target.value })}
            placeholder="Sydney Table Friends"
          />
          <ContactSection />
          <MoreAboutBusiness detailsRef={moreRef} defaultOpen={resubmitting} />
        </div>
      </SectionCard>

      {state.submitMessage ? (
        <p
          role="alert"
          className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,var(--paper))] px-4 py-3 text-sm font-semibold text-[color:var(--danger)]"
        >
          {state.submitMessage}
        </p>
      ) : null}

      <div className="rise-soft rise-d3 grid gap-3 justify-items-start">
        <Button
          type="button"
          onClick={submit}
          loading={submitting}
          // The spinner hides the label, and a visibility:hidden label is gone
          // from the accessibility tree too - this keeps the button named while
          // it spins.
          aria-label={submitLabel.replace(" →", "")}
        >
          {submitLabel}
        </Button>
        {/* The submit action is the acceptance action. The repository stores its
            timestamp plus both legal versions, so the disclosure here and the
            audit record describe the same moment. */}
        <p className="text-xs leading-5 text-[color:var(--slate)]">
          By continuing you agree to the{" "}
          <Link
            href="/terms"
            className="font-semibold text-[color:var(--purple)] underline underline-offset-2"
          >
            Click Host Terms
          </Link>{" "}
          and the{" "}
          <Link
            href="/refund-policy"
            className="font-semibold text-[color:var(--purple)] underline underline-offset-2"
          >
            Refund &amp; Cancellation Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  // rise-soft is 240ms/8px with fill `both`, so it ENDS at opacity 1 and a
  // re-render can't restart it: the resting state is always visible and the
  // motion is purely additive. The global reduced-motion block collapses it;
  // never add a per-component media query for that.
  return (
    <div className="rise-soft rise-d2 rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
      {children}
    </div>
  );
}

// ---------- auth gate ----------

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
  errorMessage = "",
}: {
  googleConfigured: boolean;
  metaConfigured: boolean;
  emailSent?: boolean;
  // Rendered above the providers when a magic-link send failed. Empty string
  // when there's nothing to say.
  errorMessage?: string;
}) {
  // Use the same actions as /login / /merchant/login but route the callback
  // back to /merchant/signup, which renders the form once signed in.
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
        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-[color:var(--danger)] px-4 py-3 text-sm font-medium leading-6 text-[color:var(--danger)]"
          >
            {errorMessage}
          </p>
        ) : null}

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

/* Every labelled control below is the shared FormField from ds.tsx - the label,
   the "Required" marker, the .ck-input treatment, the hint line and the error
   slot all come from one place, so this form cannot drift from the event
   wizard or the profile forms. The composites that genuinely cannot be a
   FormField - the category fieldset and the document upload rows - copy its
   label treatment inline and say so at the site. */

// ---------- section · contact & address ----------

export function ContactSection() {
  const { state, dispatch } = useWizard();
  const { fieldErrors } = state;
  // Set once the phone field has been left - see phoneError below.
  const [phoneTouched, setPhoneTouched] = useState(false);

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
  const outsidePilot = isOutsidePilot(state);
  const areaLabel = state.addressSuburb.trim() || "That area";

  /* Two sources feed one error slot. The live check waits until the host has
     left the field once - a half-typed number is not a mistake, and flagging
     "Mobiles need 10 digits" at the second keystroke is what made a tester say
     it errored on a real number (bug board #144). Until then the hint counts
     them through it instead. validateApplication's mark arrives on submit - the
     only one that can speak for an EMPTY field - and clears on the next
     keystroke, so the live check takes back over while they fix it. */
  const phoneTyped = state.phone.trim() !== "";
  const phoneValid = isValidAuPhone(state.phone);
  const phoneError =
    fieldErrors.phone ??
    (phoneTouched && phoneTyped && !phoneValid ? auPhoneHint(state.phone) : undefined);
  const phoneId = fieldAnchorId("phone");

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Contact email"
          required
          type="email"
          error={fieldErrors.contactEmail}
          id={fieldAnchorId("contactEmail")}
          value={state.contactEmail}
          onChange={(e) => dispatch({ type: "field", key: "contactEmail", value: e.target.value })}
          placeholder="bookings@example.com"
        />
        {/* The +61 sits in its own fixed box so the field only asks for the
            national number, and the digits regroup as they're typed, so a
            number that is one short reads as one short (bug board #144). */}
        <FormField
          label="Phone (AU)"
          required
          htmlFor={phoneId}
          id={phoneId}
          error={phoneError}
          hint={
            phoneValid ? (
              <span className="font-semibold text-[color:var(--purple)]">✓ Looks good.</span>
            ) : (
              auPhoneProgress(state.phone)
            )
          }
        >
          <div className="flex gap-2">
            <span
              aria-hidden
              className="ck-input flex shrink-0 items-center bg-[color:var(--champagne-deep)] font-semibold text-[color:var(--ink-soft)]"
            >
              +61
            </span>
            <input
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              aria-invalid={phoneError ? true : undefined}
              aria-describedby={`${phoneId}-${phoneError ? "error" : "hint"}`}
              className={`ck-input w-full min-w-0${phoneError ? " ck-input--invalid" : ""}`}
              value={state.phone}
              onChange={(e) => {
                // Regroup only while typing at the end - reformatting an edit in
                // the middle would throw the caret to the end of the field.
                const { value, selectionStart } = e.target;
                dispatch({
                  type: "field",
                  key: "phone",
                  value: selectionStart === value.length ? formatAuPhoneAsYouType(value) : value,
                });
              }}
              onBlur={() => {
                setPhoneTouched(true);
                dispatch({ type: "field", key: "phone", value: formatAuPhone(state.phone) });
              }}
              placeholder="0412 345 678"
            />
          </div>
        </FormField>
      </div>

      <FormField
        label="Venue or business address"
        required
        hint="Pick a suggestion and we'll fill in suburb, state and postcode."
        error={fieldErrors.addressStreet}
      >
        {/* The autocomplete owns its own input, so the anchor for "focus the
            first offender" sits on this wrapper and focusFieldAnchor reaches
            inside for the control. */}
        <div id={fieldAnchorId("addressStreet")}>
          <MapboxAutocomplete
            value={state.addressStreet}
            onValueChange={(v) => dispatch({ type: "field", key: "addressStreet", value: v })}
            onSelect={handlePick}
            ariaLabel="Street address"
            placeholder="Start typing - e.g. 42 Crown Street, Surry Hills"
          />
        </div>
      </FormField>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
        <FormField
          label="Suburb"
          required
          error={fieldErrors.addressSuburb}
          id={fieldAnchorId("addressSuburb")}
          value={state.addressSuburb}
          onChange={(e) => dispatch({ type: "field", key: "addressSuburb", value: e.target.value })}
          placeholder="Surry Hills"
        />
        <FormField label="State" required error={fieldErrors.addressState}>
          {/* Same wrapper-anchor arrangement as the street field: the popover's
              trigger button is StateSelect's, not ours. */}
          <div id={fieldAnchorId("addressState")}>
            <StateSelect
              value={state.addressState}
              invalid={Boolean(fieldErrors.addressState)}
              onChange={(value) => dispatch({ type: "field", key: "addressState", value })}
            />
          </div>
        </FormField>
        <FormField
          label="Postcode"
          required
          error={fieldErrors.addressPostcode}
          id={fieldAnchorId("addressPostcode")}
          value={state.addressPostcode}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => handlePostcodeChange(e.target.value)}
          placeholder="2010"
        />
      </div>

      {outsidePilot ? (
        <p
          role="status"
          className="rounded-xl bg-[color:var(--lavender-100)] px-4 py-3 text-sm leading-6 text-[color:var(--ink)]"
        >
          <span className="font-semibold">{areaLabel} is outside our Sydney pilot.</span>{" "}
          You can still sign up - we&apos;ll add you to the waitlist and email you the moment we launch in your area.
        </p>
      ) : null}
    </div>
  );
}

// Custom State picker - replaces the native <select> so the dropdown surface
// can actually be styled on-brand (the OS-rendered popup ignores CSS). Mirrors
// the chip-button vocabulary used elsewhere in the form, but as a popover so it
// stays compact inside the narrow Suburb / State / Postcode row.
function StateSelect({
  value,
  invalid,
  onChange,
}: {
  value: AuState | "";
  // The wrapping FormField owns the label and the message; the trigger is ours,
  // so the --danger hairline and aria-invalid have to be passed down.
  invalid?: boolean;
  onChange: (value: AuState) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside-click or Escape. Both listeners are only attached while
  // the popover is open so we don't leak globals across the whole form.
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
        aria-label={value ? `State: ${value}` : "Select state"}
        // No aria-invalid: role="button" does not support it, and asserting it
        // anyway is a lie to a screen reader rather than a hint. The wrapping
        // FormField's message already carries role="alert", which is what
        // actually announces the failure.
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-[color:var(--paper)] px-4 py-3 text-base text-[color:var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--purple)] ${
          open
            ? "border-[color:var(--purple)]"
            : invalid
              ? "border-[color:var(--danger)]"
              : "border-[color:var(--mist)] hover:border-[color:var(--slate)]"
        }`}
      >
        <span className={value ? "" : "text-[color:var(--slate)]"}>
          {value || "Select"}
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

// ---------- section · more about the business (optional) ----------

/**
 * Everything the platform can run without, folded away so the form reads as the
 * four answers it actually needs.
 *
 * A native <details>: keyboard, screen-reader and open/closed state all come
 * with the element, and unlike the shared useDisclosure it never folds itself
 * up because a tap landed outside it - this panel is full of inputs. React only
 * sets `open` on the first render (the prop never changes after), so the host's
 * own open/close is left alone; the form opens it through the ref when a mark
 * lands inside, because a mark in a closed section is a mark nobody can see.
 */
function MoreAboutBusiness({
  detailsRef,
  defaultOpen,
}: {
  detailsRef: RefObject<HTMLDetailsElement | null>;
  // Open from the start for a resubmitting host: whatever the review team
  // flagged may well be in here.
  defaultOpen: boolean;
}) {
  const { state, dispatch, categories } = useWizard();
  const { fieldErrors } = state;

  // The five handles start folded inside this panel too - five optional inputs
  // sitting open is most of what made the old contact step look long. Shared
  // useDisclosure, so Escape closes it and returns focus to the trigger (which
  // has to stay the FIRST button inside the ref for that to land). It also
  // closes on an outside press, so the count on the trigger is what makes that
  // safe: nothing typed here can vanish quietly, and every handle still submits.
  // Destructured, like every other useDisclosure call site: the react-hooks/refs
  // rule flags any `x.something` read during render on an object that also
  // carries a ref.
  const {
    open: socialsOpen,
    setOpen: setSocialsOpen,
    ref: socialsRef,
  } = useDisclosure<HTMLDivElement>();
  const socialCount = SOCIAL_PLATFORMS.filter((p) => state.socials[p.value].trim()).length;
  const socialsPanelId = "ms-socials-panel";

  // Said on the summary, so answers inside never look lost while it's closed.
  const addedCount =
    [state.tradingName, state.abn, state.acn, state.websiteUrl].filter((v) => v.trim()).length +
    socialCount +
    (state.eventCategoryIds.length > 0 ? 1 : 0) +
    Object.values(state.uploads).filter(Boolean).length;

  return (
    <details
      ref={detailsRef}
      open={defaultOpen || undefined}
      className="group rounded-xl border-[1.5px] border-[color:var(--mist)] bg-[color:var(--paper)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-[color:var(--lavender-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)] [&::-webkit-details-marker]:hidden">
        <span className="grid min-w-0 gap-0.5">
          <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">
            More about the business
          </span>
          <span className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
            {addedCount > 0 ? `${addedCount} added · ` : ""}Optional - ABN, website, socials,
            documents. Handy when we look over your first event.
          </span>
        </span>
        <svg
          viewBox="0 0 12 8"
          width="12"
          height="8"
          aria-hidden="true"
          className="flex-none text-[color:var(--slate)] transition-transform group-open:rotate-180"
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
      </summary>

      <div className="grid gap-5 border-t border-[color:var(--mist)] px-4 pb-5 pt-4">
        <FormField
          label="Trading name"
          hint="Only if you trade under a different name."
          value={state.tradingName}
          onChange={(e) => dispatch({ type: "field", key: "tradingName", value: e.target.value })}
          placeholder="STF Events"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="ABN"
            hint="The 11-digit ABN on your ATO registration. Spaces are fine."
            error={fieldErrors.abn}
            id={fieldAnchorId("abn")}
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
            onBlur={() => dispatch({ type: "field", key: "abn", value: formatAbn(state.abn) })}
            placeholder="11 222 333 444"
          />

          <FormField
            label="ACN"
            hint="9 digits."
            error={fieldErrors.acn}
            id={fieldAnchorId("acn")}
            value={state.acn}
            inputMode="numeric"
            onChange={(e) => dispatch({ type: "field", key: "acn", value: e.target.value })}
            onBlur={() => dispatch({ type: "field", key: "acn", value: formatAcn(state.acn) })}
            placeholder="000 000 000"
          />
        </div>

        <FormField
          label="Website"
          hint="We'll save it as https://."
          type="url"
          error={fieldErrors.websiteUrl}
          id={fieldAnchorId("websiteUrl")}
          value={state.websiteUrl}
          onChange={(e) => dispatch({ type: "field", key: "websiteUrl", value: e.target.value })}
          placeholder="https://www.yourbusiness.com.au"
        />

        <div ref={socialsRef} className="grid gap-2.5">
          <button
            type="button"
            onClick={() => setSocialsOpen((o) => !o)}
            aria-expanded={socialsOpen}
            aria-controls={socialsPanelId}
            className="flex w-full items-center justify-between gap-3 rounded-xl border-[1.5px] border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-3 text-left hover:border-[color:var(--slate)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">
                Social profiles
              </span>
              <span className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
                {socialCount > 0
                  ? `${socialCount} added - handy for verifying hosts without formal documents yet.`
                  : "Handy for verifying hosts without formal documents yet."}
              </span>
            </span>
            <svg
              viewBox="0 0 12 8"
              width="12"
              height="8"
              aria-hidden="true"
              className={`flex-none text-[color:var(--slate)] transition-transform ${socialsOpen ? "rotate-180" : ""}`}
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
          {socialsOpen ? (
            <div id={socialsPanelId} className="rise-soft grid gap-4 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((opt) => (
                <FormField
                  key={opt.value}
                  label={opt.label}
                  value={state.socials[opt.value]}
                  onChange={(e) =>
                    dispatch({ type: "social", platform: opt.value, value: e.target.value })
                  }
                  placeholder={opt.placeholder}
                />
              ))}
            </div>
          ) : null}
        </div>

        <CategoryPicker
          categories={categories}
          selectedIds={state.eventCategoryIds}
          onToggle={(id) => dispatch({ type: "toggleCategory", id })}
        />

        {/* Written for a restaurant owner, not an engineer. There is no later for
            uploads: once the form is sent a merchant_profile exists, and
            /merchant/signup/layout.tsx redirects any host holding one to
            /merchant unless they were rejected - so this panel is the ONLY
            screen that takes a document. The repository says the same thing
            from the other side ("already approved - email hello@letsclick.app to
            change a document on file", deleteMerchantDocument). So: name the
            window, and name the address for anything after it. */}
        <div className="grid gap-3">
          <InfoNote icon="lock">
            Documents stay private to you and the Click team. This is the only place to upload
            them, so anything you want to add later goes to{" "}
            <a
              href="mailto:hello@letsclick.app?subject=Document%20for%20my%20host%20account"
              className="font-semibold text-[color:var(--purple-700)] underline underline-offset-2"
            >
              hello@letsclick.app
            </a>
            .
          </InfoNote>
          <DocumentUploadRow
            label="ABN certificate"
            documentType="abn_certificate"
            state={state}
            dispatch={dispatch}
          />
          <DocumentUploadRow
            label="Public liability insurance"
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
      </div>
    </details>
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

  // Nothing to choose from: optional now, so say nothing rather than raise a
  // problem the host cannot fix and does not need to.
  if (categories.length === 0) return null;

  // A group of toggles needs a <fieldset>/<legend>, so this cannot be a
  // FormField (which renders a <label> that would claim the search box).
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 flex w-full flex-wrap items-baseline justify-between gap-2">
        {/* Label treatment copied verbatim from FormField (13.5px Ink semibold)
            so the picker reads as the same species of field as the ones above. */}
        <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">
          Event categories you host
        </span>
        <span className="text-[12.5px] font-medium text-[color:var(--slate)]">
          {selectedIds.length} selected
        </span>
      </legend>

      <span className="text-[12.5px] leading-[1.5] text-[color:var(--slate)]">
        Pick any that fit - it tells us what kind of host you are.
      </span>

      {/* ck-tag--tap, not the bare 24px ck-tag, on BOTH grids: a near-miss on the
          selected row REMOVES a category, so these are 44px thumb targets - the
          same class the create wizard's pickers use. */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggle(cat.id)}
              className="ck-tag ck-tag--select ck-tag--selected ck-tag--tap touch-manipulation"
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
              className="ck-tag ck-tag--select ck-tag--tap touch-manipulation"
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </fieldset>
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
  const [removing, setRemoving] = useState(false);
  const existing = state.uploads[documentType];
  const busy = phase !== "idle" || removing;

  /* A wrong file used to be permanent: picking another one over the top was the
     only control on the page, which still left a document on file the host never
     meant to send, and no way back to none. All three are optional, so none is a
     state the form has to be able to reach. */
  async function onRemove() {
    if (busy) return;
    setError("");
    setRemoving(true);
    try {
      const response = await fetch(
        `/api/merchant/documents?document_type=${encodeURIComponent(documentType)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as UploadResponse;
        setError(body.error ?? "We couldn't remove that just now - try again.");
        return;
      }
      dispatch({ type: "upload", docType: documentType, info: null });
    } catch {
      setError("We couldn't reach Click just then - check your connection and try again.");
    } finally {
      setRemoving(false);
    }
  }

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
      setError(
        removing
          ? "Hang on - we're still removing the last one."
          : "One at a time - this row is still uploading.",
      );
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
  const liveStatus = removing
    ? "Removing your document."
    : busy
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
        {/* Not a FormField: the row is a file input plus a badge, a progress bar
            and a live region, and FormField renders a <label> around its child -
            which would make a click anywhere in the row (including on the bar,
            mid-upload) re-open the file picker. Only the LABEL treatment is
            borrowed, verbatim, so it still reads as the same field vocabulary. */}
        <span className="text-[13.5px] font-semibold text-[color:var(--ink)]">{label}</span>
        {existing ? (
          // The DS Badge, not a hand-rolled span: the raw --sage hue on its own
          // 14% tint is the contrast regression BADGE_TONE warns about, and Badge
          // carries the AA-safe --sage-ink instead. pop-in gives the settled
          // moment its weight without particles.
          <span className="flex items-center gap-3">
            <span className="pop-in inline-flex">
              <Badge tone="sage">Uploaded</Badge>
            </span>
            <button
              type="button"
              onClick={onRemove}
              // aria-disabled, not disabled, for the same reason as the file
              // input below - onRemove's own guard is what blocks the second press.
              aria-disabled={busy || undefined}
              className="text-[12.5px] font-semibold text-[color:var(--danger)] underline underline-offset-4"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
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
        // The heading above is a plain span (see the note there), so it names
        // nothing - without this the row announces as an unlabelled file input.
        aria-label={label}
        // aria-disabled, not disabled: disabling a control the user just used
        // blurs it, and a keyboard user lands back at the top of the document.
        // The guard in onChange is what actually blocks the second pick.
        aria-disabled={busy || undefined}
        // w-full min-w-0: a file input is ~304px wide on its own, and that
        // intrinsic width pushed the whole form card past a 375px phone (html
        // clips overflow-x, so the right edge of every field was simply cut
        // off). Sized to its row, it truncates "No file chosen" instead.
        className="w-full min-w-0 text-sm font-medium text-[color:var(--ink)] file:mr-3 file:rounded-xl file:border file:border-[color:var(--mist)] file:bg-[color:var(--paper)] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--ink)] hover:file:bg-[color:var(--lavender-100)]"
      />
      {/* The constraints live beside the input that enforces them, from the same
          constants the guard and the picker filter use. */}
      <p className="text-xs font-medium text-[color:var(--slate)]">
        PDF, JPG or PNG · up to {MAX_UPLOAD_MB} MB
      </p>
      {phase !== "idle" ? (
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
