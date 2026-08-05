// Hosts whose stored media URLs we bypass because the object endpoint is known
// to be dead. Readers fall back to stock art / initials instead of rendering a
// broken image, while the original URL stays intact in Postgres so it can be
// recovered if the host comes back.
//
// This exists as a shared helper for ONE reason: the list once contained the
// project's own live Supabase Storage host. Every event photo and avatar
// uploaded in production was therefore written to storage, then silently
// discarded on read and replaced with stock art - invisible, because the upload
// itself succeeded. The guard below makes that specific mistake unrepresentable.

function liveStorageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Build a bypass set that can never contain the storage host we currently
 * upload to. A host that IS the live bucket is dropped with a warning rather
 * than honoured - blocking our own uploads is always a bug, never intent.
 */
export function unavailableHosts(hosts: readonly string[]): ReadonlySet<string> {
  const live = liveStorageHost();
  const kept = hosts.filter((host) => {
    if (live && host === live) {
      console.warn(
        `[unavailable-hosts] Ignoring "${host}" - it is the live NEXT_PUBLIC_SUPABASE_URL ` +
          "host, so blocklisting it would discard every new upload.",
      );
      return false;
    }
    return true;
  });
  return new Set(kept);
}
