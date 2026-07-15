"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
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

// SAFE-06 — permanent ban: flags the profile + tears down all clicks/mutuals/proposals.
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
  const commission = formData.get("commission_rate_bps");
  const bookingFee = formData.get("booking_fee_bps");
  const banner = formData.get("marketing_banner");

  await updateSystemSettingsAsAdmin(session, {
    maintenanceMode: maintenance === "on",
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
}
