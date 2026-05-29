"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  REPORT_REASONS,
  type ReportReason,
  blockUser,
  muteUser,
  reportUser,
  unblockUser,
  unmuteUser,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function targetFrom(formData: FormData): string | null {
  const id = formData.get("profile_id");
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

export async function blockUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = targetFrom(formData);
  if (!id) return;
  await blockUser(session, id);
  revalidatePath(`/profile/${id}`);
  revalidatePath("/people");
}

export async function unblockUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = targetFrom(formData);
  if (!id) return;
  await unblockUser(session, id);
  revalidatePath(`/profile/${id}`);
  revalidatePath("/people");
}

export async function muteUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = targetFrom(formData);
  if (!id) return;
  await muteUser(session, id);
  revalidatePath(`/profile/${id}`);
}

export async function unmuteUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = targetFrom(formData);
  if (!id) return;
  await unmuteUser(session, id);
  revalidatePath(`/profile/${id}`);
}

export async function reportUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = targetFrom(formData);
  if (!id) return;

  const reason = formData.get("reason");
  if (typeof reason !== "string" || !REPORT_REASONS.includes(reason as ReportReason)) return;
  const details = formData.get("details");

  await reportUser(session, {
    reportedProfileId: id,
    reason: reason as ReportReason,
    details: typeof details === "string" ? details : undefined,
  });
  revalidatePath(`/profile/${id}`);
}
