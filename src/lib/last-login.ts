// Remembers which sign-in method was last used so the login UI can surface a
// "Last used" pill for returning visitors. Stored in localStorage (client-only)
// so it persists across sign-out, which a session/cookie would not.

export type LoginMethod = "google" | "facebook" | "email";

const STORAGE_KEY = "click:last-login-method";
const VALID_METHODS: readonly LoginMethod[] = ["google", "facebook", "email"];

export function readLastLoginMethod(): LoginMethod | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return VALID_METHODS.includes(value as LoginMethod)
      ? (value as LoginMethod)
      : null;
  } catch {
    // localStorage can be unavailable (private mode, blocked cookies) — ignore.
    return null;
  }
}

export function rememberLoginMethod(method: LoginMethod): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // localStorage can be unavailable — ignore.
  }
}
