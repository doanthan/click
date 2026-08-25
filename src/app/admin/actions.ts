"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  anonymiseMemberAsAdmin,
  banMemberAsAdmin,
  setMemberVerifiedAsAdmin,
  suspendMemberAsAdmin,
  unbanMemberAsAdmin,
  unsuspendMemberAsAdmin,
  updateSystemSettingsAsAdmin,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function suspendMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const id = formData.get("profile_id");
  const reason = formData.get("reason");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await suspendMemberAsAdmin(session, id, typeof reason === "string" ? reason : "");
  revalidatePath("/admin");
}

export async function unsuspendMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const id = formData.get("profile_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await unsuspendMemberAsAdmin(session, id);
  revalidatePath("/admin");
}

// SAFE-06 - permanent ban: flags the profile + tears down all clicks/mutuals/proposals.
export async function banMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const id = formData.get("profile_id");
  const reason = formData.get("reason");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await banMemberAsAdmin(session, id, typeof reason === "string" ? reason : "");
  revalidatePath("/admin");
}

export async function unbanMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const id = formData.get("profile_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await unbanMemberAsAdmin(session, id);
  revalidatePath("/admin");
}

/**
 * Honour a deletion request: de-identify the profile, keeping the financial and
 * booking records the law requires us to retain. One way, no undo - see
 * anonymiseMemberAsAdmin for exactly what is cleared and what is kept.
 *
 * Unlike the other actions here this one lets the error reach the caller. The
 * repository refuses several cases the operator needs to hear about (a merchant
 * account, an account already deleted, deleting yourself), and swallowing them
 * would render as a silent no-op on the most consequential button in the
 * console.
 */
export async function deleteMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const id = formData.get("profile_id");
  const reason = formData.get("reason");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    throw new Error("Unknown member.");
  }

  await anonymiseMemberAsAdmin(session, id, typeof reason === "string" ? reason : "");

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
}

// Grant/revoke the profile verification tick (profiles.photo_verified_at).
export async function setMemberVerifiedAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const id = formData.get("profile_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await setMemberVerifiedAsAdmin(session, id, formData.get("verified") === "true");
  revalidatePath("/admin");
  revalidatePath("/admin/members");
}

export async function updateSystemSettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  const maintenance = formData.get("maintenance_mode");
  const matchingV2 = formData.get("matching_v2_enabled");
  const commission = formData.get("commission_rate_bps");
  const bookingFee = formData.get("booking_fee_bps");
  const banner = formData.get("marketing_banner");

  await updateSystemSettingsAsAdmin(session, {
    maintenanceMode: maintenance === "on",
    // Same absent-means-off contract as maintenance mode: the form posts every
    // switch it owns on every save, so a missing key is a deliberate "off",
    // not a partial submission.
    matchingV2Enabled: matchingV2 === "on",
    // Omitted entirely when PLATFORM_FEE_BPS owns the rate - the form renders
    // it read-only then, and the repository refuses the write anyway.
    commissionRateBps:
      typeof commission === "string" && commission.trim() !== ""
        ? Number(commission)
        : undefined,
    bookingFeeBps:
      typeof bookingFee === "string" && bookingFee.trim() !== ""
        ? Number(bookingFee)
        : undefined,
    marketingBanner: typeof banner === "string" ? banner : undefined,
  });

  revalidatePath("/admin");
  // AdminSystemSettings is mounted at /admin/system, not /admin - without this
  // the form's own page kept serving pre-save values from the router cache, so
  // navigating away and back read as "my save did not take".
  revalidatePath("/admin/system");
  // The matching page reads matchingV2Enabled to say whether its own sliders
  // are in effect, so flipping the engine here has to invalidate that page too.
  revalidatePath("/admin/matching");
  // Maintenance mode and the marketing banner render in the ROOT layout, which
  // means every route in the app is serving a stale copy of them until the
  // layout itself is revalidated. Without the "layout" argument this only busts
  // the "/" page and the banner keeps its old text everywhere else.
  revalidatePath("/", "layout");
}
