import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client that uses the service role key. Used for
// privileged operations the public clients can't do - uploads to the private
// `merchant-documents` bucket and the public `avatars` bucket (the avatars
// bucket is public for reads, but writes still need credentials). Never
// expose this to the browser.
//
// If SUPABASE_SERVICE_ROLE_KEY is not set in the environment, callers get a
// typed StorageNotConfiguredError so the API can return a clean 503 instead
// of a stack trace.

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase Storage is not configured. Set SUPABASE_SECRET_KEY (sb_secret_…) " +
        "or the legacy SUPABASE_SERVICE_ROLE_KEY, and create the " +
        "'merchant-documents' (private) and 'avatars' (public) buckets.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New Supabase API keys expose a secret key (`sb_secret_…`); older projects
  // use the legacy `service_role` JWT. Accept either so the admin client works
  // regardless of which key the project was issued.
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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
