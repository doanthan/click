"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/notifications");
  }

  const id = formData.get("notification_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return;
  }

  await markNotificationRead(session, id);
  revalidatePath("/notifications");
}

export async function markAllReadAction() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/notifications");
  }
  await markAllNotificationsRead(session);
  revalidatePath("/notifications");
}
