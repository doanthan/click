import { unavailableHosts } from "@/lib/unavailable-hosts";

// Avatar hosts known to be dead. Empty today - see the note in event-images.ts:
// this listed the live Supabase Storage host, so every uploaded avatar rendered
// as initials AND dropped that profile out of people discovery.
const UNAVAILABLE_AVATAR_HOSTS = unavailableHosts([]);

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
