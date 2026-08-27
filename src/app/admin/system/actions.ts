"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  TEST_SWITCHER_COOKIE,
  mintAdminUnlockCookie,
  testSwitcherCookieOptions,
} from "@/lib/test-switcher";

export type AdminQaAccessState = {
  ok: boolean;
  enabled: boolean;
  message: string;
} | null;

/**
 * Enable or disable this browser's QA persona switcher without navigating away
 * from /admin/system. The System page also contains a settings draft, so the
 * old /qa-unlock Link collided with its unsaved-work guard even though these
 * two controls do not share data.
 *
 * The grant remains bound to a live, non-QA ADMIN_EMAILS session. This is the
 * same signed value and cookie contract as /qa-unlock; changing the transport
 * from a redirect to a server action does not weaken the gate.
 */
export async function setAdminQaAccessAction(
  _previous: AdminQaAccessState,
  formData: FormData,
): Promise<AdminQaAccessState> {
  const enabled = formData.get("enabled") === "true";
  const session = await auth();
  const email = session?.user?.email ?? "";

  if (!email) {
    return {
      ok: false,
      enabled: !enabled,
      message: "Sign in as an admin to change test-account access.",
    };
  }

  const jar = await cookies();

  if (enabled) {
    const grant = mintAdminUnlockCookie(email);
    if (!grant) {
      return {
        ok: false,
        enabled: false,
        message: "A configured real admin account is required to turn on test accounts.",
      };
    }
    jar.set(TEST_SWITCHER_COOKIE, grant, testSwitcherCookieOptions());
  } else {
    jar.delete(TEST_SWITCHER_COOKIE);
  }

  // Refresh the card, header and account menu against the new cookie. App
  // Router merges this payload without discarding client state, so an unsaved
  // fee or banner draft on this page stays exactly as the operator left it.
  revalidatePath("/admin/system");

  return {
    ok: true,
    enabled,
    message: enabled
      ? "Test accounts are available from your avatar menu for 12 hours."
      : "Test accounts are hidden on this browser.",
  };
}
