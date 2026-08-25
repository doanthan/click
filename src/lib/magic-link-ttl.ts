// Lives on its own so both sides of the client boundary can quote the same
// number. `auth-magic-link.ts` is "server-only" (it holds the token hashing and
// the rate limiter), but the "check your inbox" note renders inside the login
// modal, which is a client component - and a sign-in note that states a
// different expiry than the one the server enforces is worse than no note.
export const TOKEN_TTL_MINUTES = 15;
