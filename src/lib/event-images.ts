import { unavailableHosts } from "@/lib/unavailable-hosts";

// Event-image hosts known to be dead. Empty today: this used to list
// vkpwhxixnynfccfheuut.supabase.co on the belief that the project returned HTTP
// 402 for every object, but that is the CURRENT storage host and it serves
// normally (a missing key returns NoSuchKey/404). Every merchant photo uploaded
// in production was being thrown away on read as a result.
const UNAVAILABLE_EVENT_IMAGE_HOSTS = unavailableHosts([]);

export function fallbackEventImage(
  category?: string | null,
  title?: string | null,
): string {
  const normalizedTitle = (title ?? "").trim().toLowerCase();
  if (/fight|boxing|martial|pickleball|tennis|sport/.test(normalizedTitle)) {
    return "/home/hero-pickleball.jpg";
  }
  if (/floral|flower|paint|pottery|craft|clay/.test(normalizedTitle)) {
    return "/home/wall-pottery.jpg";
  }
  if (/mum|mom|baby|babies|parent|family/.test(normalizedTitle)) {
    return "/home/wall-picnic.jpg";
  }
  if (/bbq|barbecue|dinner|food|tasting|cheese|hot pot/.test(normalizedTitle)) {
    return "/home/hero-dinner.jpg";
  }
  if (/jazz|music|karaoke|concert|gig/.test(normalizedTitle)) {
    return "/home/wall-karaoke.jpg";
  }
  if (/trivia|lan party|games? night/.test(normalizedTitle)) {
    return "/home/wall-trivia.jpg";
  }

  switch ((category ?? "").trim().toLowerCase()) {
    case "food":
      return "/home/hero-dinner.jpg";
    case "fitness":
    case "outdoors":
    case "sports":
    case "wellness":
      return "/home/hero-run.jpg";
    case "creative":
    case "learning":
      return "/home/wall-pottery.jpg";
    case "games":
      return "/home/wall-trivia.jpg";
    case "nightlife":
      return "/home/wall-karaoke.jpg";
    case "family":
    case "community":
      return "/home/wall-picnic.jpg";
    case "career":
    case "relationships":
      return "/media/networking.jpg";
    default:
      return "/home/hero-rooftop.jpg";
  }
}

export function isUnavailableEventImage(url?: string | null): boolean {
  const value = url?.trim();
  if (!value) return true;
  if (value.startsWith("/")) return false;

  try {
    return UNAVAILABLE_EVENT_IMAGE_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return true;
  }
}

export function resolveEventImage(
  url: string | null | undefined,
  category?: string | null,
  title?: string | null,
): string {
  return isUnavailableEventImage(url) ? fallbackEventImage(category, title) : url!.trim();
}

export function resolveEventImages(
  urls: ReadonlyArray<string | null | undefined>,
  category?: string | null,
  title?: string | null,
): string[] {
  const resolved = urls
    .filter((url): url is string => !isUnavailableEventImage(url))
    .map((url) => url.trim());
  return [...new Set(resolved.length > 0 ? resolved : [fallbackEventImage(category, title)])];
}
