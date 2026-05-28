"use client";

import { useReducer, useState } from "react";
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
  validateOptionalAcn,
  validateRequiredAbn,
} from "@/lib/abn";

// Merchant signup wizard — spec §1, 4 steps:
//   1 · Business details
//   2 · Contact & address
//   3 · Documents
//   4 · Review & submit (single POST to /api/merchant)
// Step 0 (account / sign-in) is a precondition rendered when !isAuthed.
//
// Wizard state lives client-side; documents are uploaded immediately on
// file-pick to /api/merchant/documents so the review step has confirmed
// records. Everything else commits on Step 4.

// ---------- props + types ----------

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const;
type AuState = (typeof AU_STATES)[number];

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

export type MerchantSignupWizardProps = {
  isAuthed: boolean;
  sessionEmail: string;
  sessionName: string;
  categories: CategoryOption[];
  existingDocs: ExistingDoc[];
  googleConfigured: boolean;
  metaConfigured: boolean;
};

type State = {
  step: 1 | 2 | 3 | 4;
  // Step 1
  businessName: string;
  tradingName: string;
  abn: string;
  acn: string;
  businessType: BusinessType | "";
  eventCategoryIds: string[];
  // Step 2
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  addressStreet: string;
  addressSuburb: string;
  addressState: AuState | "";
  addressPostcode: string;
  // Step 3
  uploads: Record<DocumentType, { fileName: string } | null>;
  // Step 4 submission
  submitState: "idle" | "submitting" | "success" | "error";
  submitMessage: string;
};

type Action =
  | { type: "field"; key: keyof Omit<State, "step" | "uploads" | "submitState" | "submitMessage" | "eventCategoryIds">; value: string }
  | { type: "toggleCategory"; id: string }
  | { type: "upload"; docType: DocumentType; info: { fileName: string } | null }
  | { type: "step"; step: State["step"] }
  | { type: "submitStart" }
  | { type: "submitError"; message: string }
  | { type: "submitSuccess" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "field":
      return { ...state, [action.key]: action.value };
    case "toggleCategory": {
      const has = state.eventCategoryIds.includes(action.id);
      return {
        ...state,
        eventCategoryIds: has
          ? state.eventCategoryIds.filter((id) => id !== action.id)
          : [...state.eventCategoryIds, action.id],
      };
    }
    case "upload":
      return { ...state, uploads: { ...state.uploads, [action.docType]: action.info } };
    case "step":
      return { ...state, step: action.step, submitMessage: "" };
    case "submitStart":
      return { ...state, submitState: "submitting", submitMessage: "" };
    case "submitError":
      return { ...state, submitState: "error", submitMessage: action.message };
    case "submitSuccess":
      return { ...state, submitState: "success", submitMessage: "" };
  }
}

function initialState(props: MerchantSignupWizardProps): State {
  const existing: State["uploads"] = {
    abn_certificate: null,
    public_liability_insurance: null,
    liquor_licence: null,
  };
  for (const doc of props.existingDocs) {
    existing[doc.documentType] = { fileName: doc.fileName };
  }
  return {
    step: 1,
    businessName: props.sessionName ? `${props.sessionName}'s Events` : "",
    tradingName: "",
    abn: "",
    acn: "",
    businessType: "",
    eventCategoryIds: [],
    contactEmail: props.sessionEmail,
    phone: "",
    websiteUrl: "",
    addressStreet: "",
    addressSuburb: "",
    addressState: "",
    addressPostcode: "",
    uploads: existing,
    submitState: "idle",
    submitMessage: "",
  };
}

// ---------- component ----------

export function MerchantSignupWizard(props: MerchantSignupWizardProps) {
  if (!props.isAuthed) {
    return (
      <StepAuthCard
        googleConfigured={props.googleConfigured}
        metaConfigured={props.metaConfigured}
      />
    );
  }
  return <AuthedWizard {...props} />;
}

function AuthedWizard(props: MerchantSignupWizardProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, props, initialState);

  function validateStep(step: State["step"]): string | null {
    if (step === 1) {
      const name = state.businessName.trim();
      if (name.length < 2 || name.length > 100) return "Business name must be 2–100 characters.";
      const abnError = validateRequiredAbn(state.abn);
      if (abnError) return abnError;
      const acnError = validateOptionalAcn(state.acn);
      if (acnError) return acnError;
      if (!state.businessType) return "Pick a business type.";
      if (state.eventCategoryIds.length === 0) return "Pick at least one event category.";
    }
    if (step === 2) {
      if (!state.contactEmail.includes("@")) return "Enter a valid contact email.";
      if (!/^(?:\+?61|0)\d{9}$/.test(state.phone.replace(/\s+/g, ""))) {
        return "Phone must be a valid Australian number (e.g. 0412 345 678).";
      }
      if (!state.addressStreet.trim()) return "Street address is required.";
      if (!state.addressSuburb.trim()) return "Suburb is required.";
      if (!state.addressState) return "Pick a state.";
      if (!/^[0-9]{4}$/.test(state.addressPostcode.trim())) return "Postcode must be 4 digits.";
    }
    if (step === 3) {
      if (!state.uploads.abn_certificate) return "Upload your ABN certificate.";
      if (!state.uploads.public_liability_insurance) {
        return "Upload your public liability insurance certificate.";
      }
    }
    return null;
  }

  function goNext() {
    const error = validateStep(state.step);
    if (error) {
      dispatch({ type: "submitError", message: error });
      return;
    }
    dispatch({ type: "step", step: (state.step + 1) as State["step"] });
  }

  function goBack() {
    if (state.step > 1) {
      dispatch({ type: "step", step: (state.step - 1) as State["step"] });
    }
  }

  async function submit() {
    // Re-validate every step server-side via the API too, but cheap to gate here.
    for (const s of [1, 2, 3] as const) {
      const error = validateStep(s);
      if (error) {
        dispatch({ type: "submitError", message: `Step ${s}: ${error}` });
        dispatch({ type: "step", step: s });
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
      <Stepper step={state.step} />

      <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow sm:p-8">
        {state.step === 1 ? <Step1 state={state} dispatch={dispatch} categories={props.categories} /> : null}
        {state.step === 2 ? <Step2 state={state} dispatch={dispatch} /> : null}
        {state.step === 3 ? <Step3 state={state} dispatch={dispatch} /> : null}
        {state.step === 4 ? <Step4 state={state} categories={props.categories} /> : null}

        {state.submitMessage ? (
          <p
            role="alert"
            className="mt-6 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]"
          >
            {state.submitMessage}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={state.step === 1}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2.5 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Back
          </button>

          {state.step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
            >
              Next: {STEP_TITLES[state.step + 1] ?? ""} →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={state.submitState === "submitting"}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
            >
              {state.submitState === "submitting" ? "Submitting…" : "Submit application →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- step 0 (auth gate) ----------

function StepAuthCard({
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
          Step 0 · Sign in
        </p>
        <h2 className="mt-3 font-display text-3xl font-light leading-tight">
          One account for hosting and attending.
        </h2>
        <p className="mt-4 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          We use the same identity for your Click attendee profile and your merchant portal.
          Sign in with Google, Facebook, or email — we’ll bring you straight back to Step 1.
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
            Continue → Step 1
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- stepper ----------

const STEP_TITLES: Record<number, string> = {
  1: "Business",
  2: "Contact & Address",
  3: "Documents",
  4: "Review",
};

function Stepper({ step }: { step: State["step"] }) {
  return (
    <ol className="flex flex-wrap items-center gap-3">
      {([1, 2, 3, 4] as const).map((n) => {
        const isActive = n === step;
        const isDone = n < step;
        return (
          <li key={n} className="flex items-center gap-2">
            <span
              className={`grid size-8 place-items-center rounded-full border-2 border-[color:var(--line)] font-mono text-sm font-bold ${
                isActive
                  ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                  : isDone
                    ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                    : "bg-[color:var(--champagne)] text-[color:var(--mauve)]"
              }`}
            >
              {isDone ? "✓" : n}
            </span>
            <span
              className={`text-xs font-bold uppercase tracking-[0.12em] ${
                isActive ? "text-[color:var(--ink)]" : "text-[color:var(--mauve)]"
              }`}
            >
              {STEP_TITLES[n]}
            </span>
            {n < 4 ? <span aria-hidden className="text-[color:var(--mauve)]/50">→</span> : null}
          </li>
        );
      })}
    </ol>
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

// ---------- step 1 · business ----------

function Step1({
  state,
  dispatch,
  categories,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
  categories: CategoryOption[];
}) {
  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Step 1 · Business details</h3>

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
          <FieldLabel>ABN * (11 digits, checksum-validated)</FieldLabel>
          <TextInput
            value={state.abn}
            inputMode="numeric"
            onChange={(e) => dispatch({ type: "field", key: "abn", value: e.target.value })}
            onBlur={() =>
              dispatch({ type: "field", key: "abn", value: formatAbn(state.abn) })
            }
            placeholder="11 222 333 444"
            required
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

      <fieldset className="grid gap-3">
        <legend className="mb-1">
          <FieldLabel>Event categories you host * (pick at least one)</FieldLabel>
        </legend>
        {categories.length === 0 ? (
          <p className="text-sm font-medium text-[color:var(--mauve)]">
            No categories available — check your database connection.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const selected = state.eventCategoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => dispatch({ type: "toggleCategory", id: cat.id })}
                  className={`rounded-full border-2 border-[color:var(--line)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] ${
                    selected
                      ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                      : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                  }`}
                >
                  {selected ? "✓ " : ""}
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
    </div>
  );
}

// ---------- step 2 · contact & address ----------

function Step2({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Step 2 · Contact & address</h3>

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
        <FieldLabel>Street address *</FieldLabel>
        <TextInput
          value={state.addressStreet}
          onChange={(e) => dispatch({ type: "field", key: "addressStreet", value: e.target.value })}
          placeholder="42 Crown Street"
          required
        />
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
          <select
            value={state.addressState}
            onChange={(e) => dispatch({ type: "field", key: "addressState", value: e.target.value })}
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] outline-none focus:bg-[color:var(--cream)]"
            required
          >
            <option value="">—</option>
            {AU_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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

// ---------- step 3 · documents ----------

function Step3({
  state,
  dispatch,
}: {
  state: State;
  dispatch: React.Dispatch<Action>;
}) {
  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Step 3 · Documents</h3>
      <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Upload PDFs or images (max 5 MB each). Files land in a private Supabase Storage bucket;
        only admins and you can access them via signed URLs.
      </p>

      <DocumentUploadRow
        label="ABN certificate *"
        documentType="abn_certificate"
        state={state}
        dispatch={dispatch}
      />
      <DocumentUploadRow
        label="Public liability insurance *"
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
  dispatch: React.Dispatch<Action>;
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

// ---------- step 4 · review ----------

function Step4({
  state,
  categories,
}: {
  state: State;
  categories: CategoryOption[];
}) {
  const selectedCats = categories
    .filter((cat) => state.eventCategoryIds.includes(cat.id))
    .map((cat) => cat.name);

  return (
    <div className="grid gap-5">
      <h3 className="font-display text-3xl font-light leading-tight">Step 4 · Review & submit</h3>
      <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">
        Have one more look. On submit we create your merchant profile, send it to admin review, and
        you’ll land on the holding page until approval.
      </p>

      <ReviewBlock title="Business">
        <ReviewLine label="Business name" value={state.businessName} />
        <ReviewLine label="Trading name" value={state.tradingName || "—"} />
        <ReviewLine label="ABN" value={formatAbn(state.abn)} />
        <ReviewLine label="ACN" value={state.acn ? formatAcn(state.acn) : "—"} />
        <ReviewLine
          label="Business type"
          value={BUSINESS_TYPES.find((b) => b.value === state.businessType)?.label ?? "—"}
        />
        <ReviewLine
          label="Categories"
          value={selectedCats.length ? selectedCats.join(", ") : "—"}
        />
      </ReviewBlock>

      <ReviewBlock title="Contact & address">
        <ReviewLine label="Email" value={state.contactEmail} />
        <ReviewLine label="Phone" value={state.phone} />
        <ReviewLine label="Website" value={state.websiteUrl || "—"} />
        <ReviewLine
          label="Address"
          value={[state.addressStreet, state.addressSuburb, state.addressState, state.addressPostcode].filter(Boolean).join(", ")}
        />
      </ReviewBlock>

      <ReviewBlock title="Documents">
        <ReviewLine
          label="ABN certificate"
          value={state.uploads.abn_certificate?.fileName ?? "—"}
        />
        <ReviewLine
          label="Public liability insurance"
          value={state.uploads.public_liability_insurance?.fileName ?? "—"}
        />
        <ReviewLine
          label="Liquor licence"
          value={state.uploads.liquor_licence?.fileName ?? "(not provided)"}
        />
      </ReviewBlock>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
        {title}
      </p>
      <dl className="mt-3 grid gap-2">{children}</dl>
    </div>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 text-sm">
      <dt className="font-bold text-[color:var(--mauve)]">{label}</dt>
      <dd className="font-semibold text-[color:var(--ink)]">{value || "—"}</dd>
    </div>
  );
}
