"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { toggleAttendeeCheckIn, toggleGuestCheckIn } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function toggleAttendeeCheckInAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant?tab=bookings");
  }

  const id = formData.get("attendee_id");
  const next = formData.get("next") === "true";

  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await toggleAttendeeCheckIn(session, id, next);
  revalidatePath("/merchant");
}

// Day-of check-in for a named +1 guest from the door list (spec 19 §11). Revalidates
// the specific event page so the toggle reflects immediately. event_slug is a plain
// slug, not a UUID — used only for the revalidate path, never as a query identifier.
export async function toggleGuestCheckInAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/merchant/login?callbackUrl=/merchant");
  }

  const id = formData.get("guest_id");
  const slug = formData.get("event_slug");
  const next = formData.get("next") === "true";

  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  await toggleGuestCheckIn(session, id, next);
  if (typeof slug === "string" && slug) {
    revalidatePath(`/merchant/events/${slug}`);
  }
}
