// The name we show before a member has chosen one.
//
// Magic-link sign-in gives us an address and nothing else, so the header needs
// *something* human to greet. We build it from the email local part - but a
// name we invented is not a name they picked, and the difference matters in
// two places: onboarding must not prefill it as though they had chosen it (they
// will accept the prefilled value without reading it, and it lands on their
// public profile and every event roster), and the welcome mail must not greet
// them by it. "Hi there" beats "Hi Willowthan1".
export function nameFromEmail(email: string) {
  const [local = ""] = email.split("@");
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isDerivedFromEmail(
  name: string | null | undefined,
  email: string | null | undefined,
) {
  if (!name || !email) return false;
  const trimmed = name.trim();
  // The raw address is the other machine-made value that reaches display_name -
  // getSessionName falls back to it when the session carries no name at all.
  return trimmed === email.trim() || trimmed === nameFromEmail(email);
}
