"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { toggleAttendeeCheckIn } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function toggleAttendeeCheckInAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant?tab=attendees");
  }

  const id = formData.get("attendee_id");
  const next = formData.get("next") === "true";

  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await toggleAttendeeCheckIn(session, id, next);
  revalidatePath("/merchant");
}
