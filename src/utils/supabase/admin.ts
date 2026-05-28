import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client that uses the service role key. Used for
// privileged operations the public clients can't do — currently just signed
// uploads to private Storage buckets. Never expose this to the browser.
//
// If SUPABASE_SERVICE_ROLE_KEY is not set in the environment, callers get a
// typed StorageNotConfiguredError so the API can return a clean 503 instead
// of a stack trace.

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase Storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY and " +
        "create the 'merchant-documents' private bucket.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new StorageNotConfiguredError();
  }

  cached = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
