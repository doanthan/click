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
  MagicLinkSentNote,
  HOST_SIGNUP_CALLBACK_URL,
  SignupRoleChoice,
  SsoButton,
  type SignupRole,
} from "@/components/auth-ui";
import { Icon, Logo, ckBtn } from "@/components/ds";
import { ModalShell } from "@/components/modal-shell";
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

const initialEmailState: EmailLoginFormState = { error: null, sent: false };

// Attendee signups route through /post-login, which sends anyone with an
// incomplete profile to /onboarding. Host signups aim at the merchant wizard -
// /post-login carries it through onboarding as ?next= for a brand-new account.
// (HOST_SIGNUP_CALLBACK_URL is shared with the /register form via auth-ui.)
const ATTENDEE_SIGNUP_CALLBACK_URL = "/post-login";

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
  const [lastUsed, setLastUsed] = useState<LoginMethod | null>(null);
  // What is in the field vs what the last send actually went to. Without the
  // pair, editing a mistyped address left "Email sent" sitting under the new
  // one, so the state on screen described a mail that went somewhere else.
  const [emailValue, setEmailValue] = useState("");
  const [sentTo, setSentTo] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const addressEdited = emailValue.trim().toLowerCase() !== sentTo;
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

    return () => {
      window.cancelAnimationFrame(readFrame);
    };
  }, [open]);

  // Records the chosen method for the "Last used" pill.
  //
  // This used to also stash the typed name in sessionStorage for /onboarding to
  // read. It only worked on the OAuth path: a magic link opens in a NEW tab,
  // which gets empty sessionStorage, so the emailed path threw the name away.
  // The name field is gone from signup entirely - onboarding asks for it, and
  // asks once. See the note in register-form.tsx.
  function handleSubmit(method: LoginMethod) {
    rememberLoginMethod(method);
    if (method === "email") setSentTo(emailValue.trim().toLowerCase());
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
    <ModalShell
      onClose={onClose}
      labelledBy="login-modal-title"
      zIndex={200}
      initialFocusRef={firstFieldRef}
      className="px-4 py-8"
      scrimClassName="bg-[rgba(28,24,48,0.5)]"
    >
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

        {/* Mode toggle - segmented, morphs in place.
            Described as a plain group of pressed/unpressed buttons, not as
            tabs. It looked like a tablist, but there is no tabpanel behind it
            and no arrow-key handler in front of it - these two buttons swap one
            form in place. Claiming role="tab" promised a screen-reader user
            "tab 1 of 2, use the arrow keys", and the arrow keys did nothing. */}
        <div
          role="group"
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
                aria-pressed={active}
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
          <SignupRoleChoice value={role} onChange={setRole} className="mt-3" />
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
          {/* Carries the intent only. Login mode does NOT reject an unknown
              address any more - answering "no account found" was a
              user-enumeration oracle, so both modes issue a token and only the
              template that lands in the inbox differs. See requestEmailSignIn. */}
          <input type="hidden" name="mode" value={isSignup ? "signup" : "login"} />

          <Field
            label="Email"
            icon="mail"
            ref={firstFieldRef}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
          />

          {emailState.error ? <AuthError>{emailState.error}</AuthError> : null}
          {emailState.sent && !addressEdited ? (
            <MagicLinkSentNote email={sentTo || undefined} mode={isSignup ? "signup" : "signin"} />
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
              {emailState.sent && !addressEdited
                ? "Resend link"
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
    </ModalShell>
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
