"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  signInWithEmailFromModal,
  signInWithGoogle,
  signInWithMeta,
  type EmailLoginFormState,
} from "@/app/login/actions";
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

const initialEmailState: EmailLoginFormState = { error: null };

// Attendee signups route through /post-login, which sends anyone with an
// incomplete profile to /onboarding (where the prefill below is read).
// Host signups land directly on the 4-step merchant wizard — it detects the
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
  const formCallbackUrl = isSignup
    ? isHostSignup
      ? HOST_SIGNUP_CALLBACK_URL
      : ATTENDEE_SIGNUP_CALLBACK_URL
    : callbackUrl;

  useEffect(() => {
    if (!open) return;

    setLastUsed(readLastLoginMethod());

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
      // sessionStorage can be unavailable in private mode — ignore.
    }
  }

  // Records the chosen method (for the "Last used" pill) and carries the
  // signup name prefill forward, on every sign-in form submit.
  function handleSubmit(method: LoginMethod) {
    rememberLoginMethod(method);
    stashSignupPrefill();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
    >
      <button
        type="button"
        aria-label="Close login"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[color:var(--ink)]/55 backdrop-blur-sm"
      />

      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow">
        <div className="flex items-center justify-between gap-3 border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)]" />
            <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--punch)]" />
            <span className="size-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)]" />
          </div>
          <span className="font-mono hidden text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] sm:block">
            ✷ secure sign-in
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
          >
            ✕
          </button>
        </div>

        <div className="p-7 sm:p-9">
          <div
            role="tablist"
            aria-label="Log in or sign up"
            className="grid grid-cols-2 gap-1 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-1"
          >
            {(["login", "signup"] as const).map((value) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(value)}
                  className={`rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide transition ${
                    active
                      ? "border-2 border-[color:var(--line)] bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
                      : "border-2 border-transparent text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
                  }`}
                >
                  {value === "login" ? "Log in" : "Sign up"}
                </button>
              );
            })}
          </div>

          {isSignup ? (
            <fieldset
              aria-label="What kind of account?"
              className="mt-5 grid grid-cols-2 gap-1 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-1"
            >
              {(
                [
                  { value: "attendee", title: "Attend", body: "RSVP & meet people" },
                  { value: "host", title: "Host", body: "List & run events" },
                ] as const
              ).map((option) => {
                const active = role === option.value;
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-xl px-3 py-2 text-left transition ${
                      active
                        ? "border-2 border-[color:var(--line)] bg-[color:var(--peach)] hard-shadow-sm"
                        : "border-2 border-transparent hover:bg-[color:var(--champagne)]"
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
                    <span className="block text-sm font-bold uppercase tracking-wide text-[color:var(--ink)]">
                      {option.title}
                    </span>
                    <span className="font-mono mt-0.5 block text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                      {option.body}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : null}

          <span className="sticker sticker--peach tilt-l-2 mt-5 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            {isSignup ? (isHostSignup ? "Host an event" : "New here") : "Welcome back"}
          </span>
          <h2
            id="login-modal-title"
            className="font-display mt-4 text-3xl font-light leading-[1] tracking-tight text-[color:var(--ink)] sm:text-4xl"
          >
            {isSignup ? (
              isHostSignup ? (
                <>
                  You run the room.{" "}
                  <span className="italic">
                    <span className="peach-highlight">We bring the people.</span>
                  </span>
                </>
              ) : (
                <>
                  Make your{" "}
                  <span className="italic">
                    <span className="peach-highlight">first Click</span>
                  </span>
                  .
                </>
              )
            ) : (
              <>
                Get into your{" "}
                <span className="italic">
                  <span className="peach-highlight">real-world</span>
                </span>{" "}
                plans.
              </>
            )}
          </h2>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
            {isSignup
              ? isHostSignup
                ? "After sign-in we'll take you to the 4-step host application: business details, address, documents, review."
                : "Create an account to RSVP, save events, and start private Clicks."
              : "One account for RSVPs, saved events, and private Clicks."}
          </p>

          {showDemoCredentials ? (
            <div className="mt-5 rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--peach)]/30 px-4 py-3 text-xs font-medium text-[color:var(--ink)]">
              <p className="font-mono font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                ✷ MVP preview · no password
              </p>
              <ul className="mt-2 grid gap-1.5 text-[color:var(--ink)]">
                <li>
                  <span className="font-bold">Attendee:</span> any email works
                  (e.g.{" "}
                  <span className="font-mono font-bold">
                    jane@example.com
                  </span>
                  )
                </li>
                <li>
                  <span className="font-bold">Event organiser:</span> any
                  email, then{" "}
                  <span className="font-mono font-bold">Become a host</span>{" "}
                  on your dashboard
                </li>
                <li>
                  <span className="font-bold">Admin:</span>{" "}
                  <span className="font-mono font-bold">
                    admin@click.local
                  </span>
                </li>
              </ul>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <form action={signInWithGoogle} onSubmit={() => handleSubmit("google")}>
              <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
              <button
                type="submit"
                disabled={!googleConfigured}
                className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 text-sm font-bold text-[color:var(--ink)] hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[color:var(--cream)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                <GoogleMark className="size-5 shrink-0" />
                <span>
                  {!googleConfigured
                    ? "Google · setup required"
                    : isSignup
                      ? isHostSignup
                        ? "Sign up as host with Google"
                        : "Sign up with Google"
                      : "Continue with Google"}
                </span>
                {!isSignup && lastUsed === "google" && googleConfigured ? (
                  <LastUsedBadge />
                ) : null}
              </button>
            </form>

            <form action={signInWithMeta} onSubmit={() => handleSubmit("facebook")}>
              <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
              <button
                type="submit"
                disabled={!metaConfigured}
                className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border-2 border-[color:var(--line)] bg-[#1877F2] px-5 text-sm font-bold text-white hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[#1566d6] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                <FacebookMark className="size-5 shrink-0" />
                <span>
                  {!metaConfigured
                    ? "Facebook · setup required"
                    : isSignup
                      ? isHostSignup
                        ? "Sign up as host with Facebook"
                        : "Sign up with Facebook"
                      : "Continue with Facebook"}
                </span>
                {!isSignup && lastUsed === "facebook" && metaConfigured ? (
                  <LastUsedBadge />
                ) : null}
              </button>
            </form>
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
            <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              or with email
            </span>
            <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
          </div>

          <form action={emailAction} onSubmit={() => handleSubmit("email")} className="grid gap-3">
            <input type="hidden" name="callbackUrl" value={formCallbackUrl} />

            {isSignup ? (
              <label className="grid gap-1.5 text-sm font-bold text-[color:var(--ink)]">
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Your name
                </span>
                <input
                  ref={firstFieldRef}
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--champagne)] focus:border-[color:var(--rose)]"
                  placeholder="Jordan Lee"
                />
              </label>
            ) : null}

            <label className="grid gap-1.5 text-sm font-bold text-[color:var(--ink)]">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                Email
              </span>
              <input
                ref={isSignup ? undefined : firstFieldRef}
                name="email"
                type="email"
                required
                autoComplete="email"
                className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--champagne)] focus:border-[color:var(--rose)]"
                placeholder="you@example.com"
              />
            </label>

            {emailState.error ? (
              <p
                role="alert"
                className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2.5 text-sm font-bold text-[color:var(--surface-deep)]"
              >
                {emailState.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={emailPending}
              className="mt-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              {emailPending
                ? isSignup
                  ? "Creating account..."
                  : "Signing in..."
                : isSignup
                  ? isHostSignup
                    ? "Create host account"
                    : "Create account"
                  : "Continue with email"}
              <span aria-hidden>→</span>
              {!isSignup && lastUsed === "email" ? <LastUsedBadge /> : null}
            </button>
          </form>

          <p className="mt-5 text-center text-sm font-medium text-[color:var(--mauve)]">
            {isSignup ? "Already have an account?" : "New to Click?"}{" "}
            <button
              type="button"
              onClick={() => setMode(isSignup ? "login" : "signup")}
              className="font-bold text-[color:var(--ink)] underline decoration-2 underline-offset-4 hover:text-[color:var(--rose)]"
            >
              {isSignup ? "Log in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LastUsedBadge() {
  return (
    <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase leading-none tracking-[0.1em] text-[color:var(--surface-deep)]">
      Last used
    </span>
  );
}

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.972 31.668 29.418 34 24 34c-5.523 0-10.5-4.477-10.5-10S18.477 14 24 14c2.504 0 4.789.945 6.523 2.488l5.657-5.657C32.945 7.582 28.713 6 24 6 14.059 6 6 14.059 6 24s8.059 18 18 18 18-8.059 18-18c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 19.001 14 24 14c2.504 0 4.789.945 6.523 2.488l5.657-5.657C32.945 7.582 28.713 6 24 6 16.318 6 9.656 10.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 42c4.626 0 8.882-1.578 12.247-4.275l-6.184-5.057C28.084 33.987 26.13 35 24 35c-5.4 0-9.94-3.317-11.273-8h-6.5C9.45 37.61 16.118 42 24 42z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.218-2.227 4.106-4.087 5.474l.005-.003 6.184 5.057C36.971 39.205 42 34.5 42 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function FacebookMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22 12.061C22 6.504 17.523 2 12 2S2 6.504 2 12.061C2 17.084 5.657 21.245 10.438 22v-7.03H7.898v-2.91h2.54v-2.213c0-2.523 1.493-3.917 3.776-3.917 1.094 0 2.238.196 2.238.196v2.476h-1.262c-1.243 0-1.63.775-1.63 1.57v1.888h2.773l-.443 2.91h-2.33V22C18.343 21.245 22 17.084 22 12.061Z"
      />
    </svg>
  );
}
