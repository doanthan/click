const UNAVAILABLE_AVATAR_HOSTS = new Set([
  // Legacy Supabase project currently returns HTTP 402 for every public object.
  // Keep the stored URL intact so the photo can be recovered if the project is
  // restored; readers fall back to the standard anonymous avatar meanwhile.
  "vkpwhxixnynfccfheuut.supabase.co",
]);

export function resolveAvatarImage(url?: string | null): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    return UNAVAILABLE_AVATAR_HOSTS.has(new URL(value).hostname.toLowerCase())
      ? null
      : value;
  } catch {
    return null;
  }
}
