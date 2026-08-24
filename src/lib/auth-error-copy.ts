// The one place a magic-link / OAuth error code becomes a sentence.
//
// This used to be two tables: one in src/app/login/actions.ts (module-local,
// because a "use server" file may only export async functions) and a second,
// shorter copy in /merchant/login. The short one was missing RateLimited and
// EmailUnavailable - exactly the two codes requestEmailSignIn returns most - so
// a host who tripped the 5-per-hour limit was told "Login failed." Keeping one
// table means a new code can't be handled on one surface and not another.
export const AUTH_ERROR_COPY: Record<string, string> = {
  CredentialsSignin: "Enter a valid email address to continue.",
  Configuration: "Authentication is missing provider or secret configuration.",
  InvalidEmail: "Enter a valid email address to continue.",
  EmailNotFound: "No account found for that email. Check the spelling, or sign up.",
  RateLimited: "Too many sign-in emails were requested. Try again in an hour.",
  EmailUnavailable:
    "We could not send a sign-in email right now. Try Google or try again later.",
  OAuthSignin: "The social login could not start. Check the provider configuration.",
  OAuthCallback: "The social login callback failed. Check the provider callback URL.",
};

export function authErrorMessage(code: string | undefined | null): string {
  if (!code) return "";
  return AUTH_ERROR_COPY[code] ?? "Login failed.";
}
