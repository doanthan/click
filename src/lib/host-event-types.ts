import { CATEGORIES } from "@/components/ds";

/**
 * "What would you host?" on the homepage host waitlist: the canonical
 * categories (DS README section 4, never an ad-hoc list), less Dating, which is
 * gated to dating-intent members and is not something we ask a stranger to
 * pick. Shared by the form and by src/lib/host-waitlist.ts, which drops any
 * key not in here.
 */
export const HOST_EVENT_TYPES = CATEGORIES.filter((category) => !category.gated).map(({ key, label }) => ({
  key,
  label,
}));
