"use client";

import { useState } from "react";
import { signInWithEmail, signInWithGoogle, signInWithMeta } from "@/app/login/actions";
import {
  AuthDivider,
  AuthError,
  Field,
  AuthNote,
  HOST_SIGNUP_CALLBACK_URL,
  SignupRoleChoice,
  SsoButton,
  type SignupRole,
} from "@/components/auth-ui";
import { SubmitButton } from "@/components/ds-client";

// Signup used to open with "What should we call you?" and stash the answer in
// sessionStorage for the onboarding form to pick up. It only ever worked on the
// OAuth path (same-tab round trip) - a magic link opens in a NEW tab, which
// gets empty sessionStorage, so the emailed path silently threw the name away
// and onboarding showed a name derived from the email local part instead.
//
// Rather than plumb the name through the magic-link record, the field is gone:
// onboarding's very first question is "First name", it's required there, and on
// the OAuth path the provider gives us a name anyway. Asking twice and honouring
// it once was the actual bug.

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
  // Attend or Host, same fork the login modal offers. Seeded from the incoming
  // callbackUrl because the email path bounces back HERE with
  // ?emailSent=1&callbackUrl=… - without the seed, "check your inbox" would
  // silently flip a host applicant back to the attendee card.
  const [role, setRole] = useState<SignupRole>(
    callbackUrl === HOST_SIGNUP_CALLBACK_URL ? "host" : "attendee",
  );
  const isHost = role === "host";
  const formCallbackUrl = isHost ? HOST_SIGNUP_CALLBACK_URL : callbackUrl;

  return (
    <div className="grid gap-5">
      <SignupRoleChoice value={role} onChange={setRole} />

      <div className="grid gap-2.5">
        <form action={signInWithGoogle}>
          <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
          <SsoButton
            provider="google"
            disabled={!googleConfigured}
            label={googleConfigured ? "Sign up with Google" : "Google · setup required"}
          />
        </form>

        {metaConfigured ? (
          <form action={signInWithMeta}>
            <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
            <SsoButton provider="facebook" label="Sign up with Facebook" />
          </form>
        ) : null}
      </div>

      <AuthDivider />

      <form action={signInWithEmail} className="grid gap-4">
        <input type="hidden" name="callbackUrl" value={formCallbackUrl} />
        {/* Tells the action this is a signup and that the "check your inbox"
            answer belongs back here, not on the login page. */}
        <input type="hidden" name="mode" value="signup" />
        <input type="hidden" name="formPath" value="/register" />

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

        <SubmitButton size="lg" full pendingLabel="Creating your account…">
          {isHost ? "Create host account" : "Create account"}
        </SubmitButton>
      </form>

      {isHost ? (
        <AuthNote icon="info">
          Next up is the host application: business details, address, documents, review. Free events
          cost nothing to host.
        </AuthNote>
      ) : (
        <AuthNote>
          Click is piloting in inner Sydney. Somewhere else? Sign up anyway - we&apos;ll tell you the
          moment Click reaches you.
        </AuthNote>
      )}
    </div>
  );
}
