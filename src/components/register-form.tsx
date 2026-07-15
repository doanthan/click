"use client";

import { useRef, useState } from "react";
import { signInWithEmail, signInWithGoogle, signInWithMeta } from "@/app/login/actions";
import {
  AuthDivider,
  AuthError,
  Field,
  AuthNote,
  SsoButton,
} from "@/components/auth-ui";
import { ckBtn } from "@/components/ds";

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
  // Register now only captures the name - intent + location are collected once on
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
  // The name lives OUTSIDE the email <form> (it's shared with the OAuth
  // buttons), so native `required` validation never fires for it. Without an
  // explicit check the submit button used to be silently disabled - reported
  // as "why can't I create an account". Validate on submit instead and say why.
  const [nameError, setNameError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!displayName.trim()) {
      event.preventDefault();
      setNameError("Tell us your name first - the field is at the top.");
      nameInputRef.current?.focus();
      return;
    }
    setNameError("");
    stashPrefill();
  }

  function stashPrefill() {
    if (typeof window === "undefined") return;
    const prefill: RegisterPrefill = {
      displayName: displayName.trim(),
      capturedAt: new Date().toISOString(),
    };
    try {
      window.sessionStorage.setItem(REGISTER_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      // sessionStorage can be unavailable in private mode - ignore.
    }
  }

  return (
    <div className="grid gap-5">
      <Field
        label="What should we call you?"
        icon="user"
        ref={nameInputRef}
        value={displayName}
        onChange={(event) => {
          setDisplayName(event.target.value);
          if (event.target.value.trim()) setNameError("");
        }}
        autoComplete="name"
        required
        error={nameError || undefined}
        placeholder="Jordan Lee"
      />

      <div className="grid gap-2.5">
        <form action={signInWithGoogle} onSubmit={stashPrefill}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <SsoButton
            provider="google"
            disabled={!googleConfigured}
            label={googleConfigured ? "Sign up with Google" : "Google · setup required"}
          />
        </form>

        <form action={signInWithMeta} onSubmit={stashPrefill}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <SsoButton
            provider="facebook"
            disabled={!metaConfigured}
            label={metaConfigured ? "Sign up with Facebook" : "Facebook · setup required"}
          />
        </form>
      </div>

      <AuthDivider />

      <form action={signInWithEmail} onSubmit={handleEmailSubmit} className="grid gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {errorMessage ? <AuthError>{errorMessage}</AuthError> : null}

        <Field
          label="Email"
          icon="mail"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <button type="submit" className={ckBtn("primary", "lg", { full: true })}>
          <span className="ck-btn__label">Create account</span>
        </button>
      </form>

      <AuthNote>
        Click is piloting in inner Sydney. Somewhere else? Sign up anyway - we&apos;ll tell you the
        moment Click reaches you.
      </AuthNote>
    </div>
  );
}
