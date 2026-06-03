"use client";

import { useState } from "react";
import { signInWithEmail, signInWithGoogle, signInWithMeta } from "@/app/login/actions";

type Intent =
  | "dating"
  | "friendship"
  | "networking"
  | "exploring"
  | "hobbies"
  | "wellness"
  | "community"
  | "new_in_town";
export const REGISTER_PREFILL_KEY = "click:register-prefill";

export type RegisterPrefill = {
  displayName: string;
  // Register now only captures the name — intent + location are collected once on
  // onboarding (the next page) instead of being asked twice. Kept optional so any
  // older prefill stash still parses cleanly.
  intent?: Intent;
  latitude?: number | null;
  longitude?: number | null;
  capturedAt: string;
};

type RegisterFormProps = {
  callbackUrl: string;
  errorMessage: string;
  googleConfigured: boolean;
  metaConfigured: boolean;
};

export function RegisterForm({
  callbackUrl,
  errorMessage,
  googleConfigured,
  metaConfigured,
}: RegisterFormProps) {
  const [displayName, setDisplayName] = useState("");

  function stashPrefill() {
    if (typeof window === "undefined") return;
    const prefill: RegisterPrefill = {
      displayName: displayName.trim(),
      capturedAt: new Date().toISOString(),
    };
    try {
      window.sessionStorage.setItem(REGISTER_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      // sessionStorage can be unavailable in private mode — ignore.
    }
  }

  return (
    <div className="grid gap-6 p-6 sm:p-7">
      <div className="grid gap-3">
        <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            What should we call you?
          </span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            required
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
            placeholder="Jordan Lee"
          />
        </label>
      </div>

      <div className="grid gap-3">
        <form action={signInWithGoogle} onSubmit={stashPrefill}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={!googleConfigured}
            aria-label="Continue with Google"
            className="group/btn flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 text-base font-bold text-[color:var(--ink)] hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[color:var(--cream)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            <GoogleMark className="size-6 shrink-0" />
            <span>
              {googleConfigured ? "Sign up with Google" : "Google · setup required"}
            </span>
          </button>
        </form>

        <form action={signInWithMeta} onSubmit={stashPrefill}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            disabled={!metaConfigured}
            aria-label="Continue with Facebook"
            className="group/btn flex min-h-[58px] w-full items-center justify-center gap-3 rounded-full border-2 border-[color:var(--line)] bg-[#1877F2] px-5 text-base font-bold text-white hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[#1566d6] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            <FacebookMark className="size-6 shrink-0" />
            <span>
              {metaConfigured ? "Sign up with Facebook" : "Facebook · setup required"}
            </span>
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3">
        <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          or with email
        </span>
        <span className="h-[2px] flex-1 bg-[color:var(--line-soft)]" />
      </div>

      <form action={signInWithEmail} onSubmit={stashPrefill} className="grid gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <label className="grid gap-2 text-sm font-bold text-[color:var(--ink)]">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-3 text-base font-semibold text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/55 outline-none focus:bg-[color:var(--cream)]"
            placeholder="you@example.com"
          />
        </label>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-3 text-sm font-bold text-[color:var(--surface-deep)]"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!displayName.trim()}
          className="group/cta inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:5px_5px_0_0_var(--shadow-ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          Create my account
          <span aria-hidden className="transition-transform group-hover/cta:translate-x-1">→</span>
        </button>
      </form>
    </div>
  );
}

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="currentColor"
        d="M22 12.061C22 6.504 17.523 2 12 2S2 6.504 2 12.061C2 17.084 5.657 21.245 10.438 22v-7.03H7.898v-2.91h2.54v-2.213c0-2.523 1.493-3.917 3.776-3.917 1.094 0 2.238.196 2.238.196v2.476h-1.262c-1.243 0-1.63.775-1.63 1.57v1.888h2.773l-.443 2.91h-2.33V22C18.343 21.245 22 17.084 22 12.061Z"
      />
    </svg>
  );
}
