"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  signInWithEmailFromModal,
  signInWithGoogle,
  signInWithMeta,
  type EmailLoginFormState,
} from "@/app/login/actions";
import {
  AuthDivider,
  AuthError,
  Field,
  AuthNote,
  SsoButton,
} from "@/components/auth-ui";
import { Icon, Logo, ckBtn } from "@/components/ds";
import { REGISTER_PREFILL_KEY, type RegisterPrefill } from "@/components/register-form";
import {
  type LoginMethod,
  readLastLoginMethod,
  rememberLoginMethod,
} from "@/lib/last-login";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  callbackUrl: string;
  googleConfigured: boolean;
  metaConfigured: boolean;
  showDemoCredentials: boolean;
};

type Mode = "login" | "signup";
type SignupRole = "attendee" | "host";

const initialEmailState: EmailLoginFormState = { error: null, sent: false };

// Attendee signups route through /post-login, which sends anyone with an
// incomplete profile to /onboarding (where the prefill below is read).
// Host signups land directly on the 4-step merchant wizard - it detects the
// fresh session and skips its own inline auth step.
const ATTENDEE_SIGNUP_CALLBACK_URL = "/post-login";
const HOST_SIGNUP_CALLBACK_URL = "/merchant/signup";

export function LoginModal({
  open,
  onClose,
  callbackUrl,
  googleConfigured,
  metaConfigured,
  showDemoCredentials,
}: LoginModalProps) {
  const [emailState, emailAction, emailPending] = useActionState(
    signInWithEmailFromModal,
    initialEmailState,
  );
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<SignupRole>("attendee");
  const [name, setName] = useState("");
  const [lastUsed, setLastUsed] = useState<LoginMethod | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const isSignup = mode === "signup";
  const isHostSignup = isSignup && role === "host";
  // Attendee signups route via /post-login so onboarding runs first, but the
  // page they came from rides along as ?next= - signing up from an event and
  // then losing the event was the most common way an intended RSVP evaporated.
  // /post-login re-validates with safeNext, so an unusable value is dropped there.
  const attendeeSignupCallbackUrl = callbackUrl?.startsWith("/")
    ? `${ATTENDEE_SIGNUP_CALLBACK_URL}?next=${encodeURIComponent(callbackUrl)}`
    : ATTENDEE_SIGNUP_CALLBACK_URL;
  const formCallbackUrl = isSignup
    ? isHostSignup
      ? HOST_SIGNUP_CALLBACK_URL
      : attendeeSignupCallbackUrl
    : callbackUrl;

  useEffect(() => {
    if (!open) return;

    const readFrame = window.requestAnimationFrame(() => {
      setLastUsed(readLastLoginMethod());
    });

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    const timeout = window.setTimeout(() => firstFieldRef.current?.focus(), 100);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(readFrame);
    };
  }, [open, onClose]);

  // For sign-ups, hand the typed name to /onboarding via the same
  // sessionStorage prefill that the full /register flow uses.
  function stashSignupPrefill() {
    if (!isSignup || typeof window === "undefined") return;
    const prefill: RegisterPrefill = {
      displayName: name.trim(),
      intent: "friendship",
      latitude: null,
      longitude: null,
      capturedAt: new Date().toISOString(),
    };
    try {
      window.sessionStorage.setItem(REGISTER_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      // sessionStorage can be unavailable in private mode - ignore.
    }
  }

  // Records the chosen method (for the "Last used" pill) and carries the
  // signup name prefill forward, on every sign-in form submit.
  function handleSubmit(method: LoginMethod) {
    rememberLoginMethod(method);
    stashSignupPrefill();
  }

  if (!open) return null;

  const title = isSignup
    ? isHostSignup
      ? "Host on Click"
      : "Create your account"
    : "Welcome back";
  const sub = isSignup
    ? isHostSignup
      ? "Next up is the host application: business details, address, documents, review."
      : "One step to real-life events near you."
    : "Sign in to pick up where you left off.";

  // z-[200] sits above every other modal (event quick-view, checkout, etc. all
  // use z-[100]). The login gate is opened FROM those modals on a 401, so it must
  // stack on top - otherwise it renders hidden behind the event popup that
  // triggered it (reported on /discover RSVP while signed out).
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8"
    >
      {/* A definite Ink scrim - the card must clearly separate from the cream page. */}
      <button
        type="button"
        aria-label="Close login"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(28,24,48,0.5)]"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-[452px] overflow-y-auto rounded-[20px] bg-[color:var(--paper)] p-6 shadow-[0_12px_32px_rgba(28,24,48,.14),0_2px_6px_rgba(28,24,48,.08)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <Logo size={26} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 flex size-8 items-center justify-center rounded-lg text-[color:var(--slate)] hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
          >
            <Icon name="x" size={18} stroke={2.2} />
          </button>
        </div>

        {/* Mode toggle - segmented, morphs in place */}
        <div
          role="tablist"
          aria-label="Log in or sign up"
          className="mt-5 flex gap-1 rounded-full bg-[color:var(--lav-bg)] p-1"
        >
          {(
            [
              ["login", "Log in"],
              ["signup", "Sign up"],
            ] as const
          ).map(([value, label]) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(value)}
                className={`font-display h-9 flex-1 rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[color:var(--paper)] text-[color:var(--purple-700)] shadow-[var(--shadow-xs)]"
                    : "text-[color:var(--slate)] hover:text-[color:var(--ink)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {isSignup ? (
          <fieldset aria-label="What kind of account?" className="mt-3 grid grid-cols-2 gap-2.5">
            {(
              [
                { value: "attendee", title: "Attend", body: "RSVP and meet people" },
                { value: "host", title: "Host", body: "List and run events" },
              ] as const
            ).map((option) => {
              const active = role === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-colors ${
                    active
                      ? "border-[color:var(--purple-500)] bg-[color:var(--lavender-100)]"
                      : "border-[color:var(--mist-strong)] bg-[color:var(--paper)] hover:bg-[color:var(--lavender-100)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="signup-role"
                    value={option.value}
                    checked={active}
                    onChange={() => setRole(option.value)}
                    className="sr-only"
                  />
                  <span className="block text-[15px] font-semibold text-[color:var(--ink)]">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-[color:var(--slate)]">
                    {option.body}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : null}

        <h2
          id="login-modal-title"
          className="font-display mt-5 text-[24px] font-semibold leading-[1.15] tracking-[-0.01em] text-[color:var(--ink)]"
        >
          {title}
        </h2>
        <p className="mt-1.5 text-[14.5px] leading-[1.5] text-[color:var(--slate)]">{sub}</p>

        {showDemoCredentials ? (
          <div className="mt-4">
            <AuthNote icon="info">
              <b className="font-semibold">Preview build - no password yet.</b> Any email signs in
              as an attendee; admin@click.local is the admin.
            </AuthNote>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2.5">
          <form action={signInWithGoogle} onSubmit={() => handleSubmit("google")}>
            <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
            <SsoButton
              provider="google"
              disabled={!googleConfigured}
              label={
                !googleConfigured
                  ? "Google · setup required"
                  : isSignup
                    ? "Sign up with Google"
                    : "Continue with Google"
              }
              trailing={
                !isSignup && lastUsed === "google" && googleConfigured ? <LastUsedBadge /> : null
              }
            />
          </form>

          {metaConfigured ? (
            <form action={signInWithMeta} onSubmit={() => handleSubmit("facebook")}>
              <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
              <SsoButton
                provider="facebook"
                label={isSignup ? "Sign up with Facebook" : "Continue with Facebook"}
                trailing={
                  !isSignup && lastUsed === "facebook" ? <LastUsedBadge /> : null
                }
              />
            </form>
          ) : null}
        </div>

        <div className="my-4">
          <AuthDivider />
        </div>

        <form action={emailAction} onSubmit={() => handleSubmit("email")} className="grid gap-3.5">
          <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
          {/* Login mode rejects an unknown email ("no account found") instead
              of passwordless-creating a junk profile; signup still creates. (#181) */}
          <input type="hidden" name="mode" value={isSignup ? "signup" : "login"} />

          {isSignup ? (
            <Field
              label="Your name"
              icon="user"
              ref={firstFieldRef}
              name="displayName"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jordan Lee"
            />
          ) : null}

          <Field
            label="Email"
            icon="mail"
            ref={isSignup ? undefined : firstFieldRef}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          {emailState.error ? <AuthError>{emailState.error}</AuthError> : null}
          {emailState.sent ? (
            <AuthNote icon="mail">Check your inbox for a secure, one-time sign-in link.</AuthNote>
          ) : null}

          <button
            type="submit"
            disabled={emailPending}
            className={ckBtn("primary", "lg", {
              full: true,
              className: emailPending ? "ck-btn--loading" : "",
            })}
            aria-busy={emailPending || undefined}
          >
            <span className="ck-btn__label">
              {emailState.sent
                ? "Email sent"
                : isSignup
                ? isHostSignup
                  ? "Create host account"
                  : "Create account"
                : "Continue with email"}
              {!isSignup && lastUsed === "email" ? <LastUsedBadge /> : null}
            </span>
            {emailPending ? <span className="ck-btn__spinner" aria-hidden /> : null}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[color:var(--slate)]">
          {isSignup ? "Already on Click?" : "New to Click?"}{" "}
          <button
            type="button"
            onClick={() => setMode(isSignup ? "login" : "signup")}
            className="font-semibold text-[color:var(--purple)] hover:underline"
          >
            {isSignup ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* A quiet neutral marker, not a status badge - it carries no colour meaning. */
function LastUsedBadge() {
  return (
    <span className="rounded-md bg-[color:var(--lavender-100)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-[color:var(--purple-700)]">
      Last used
    </span>
  );
}
