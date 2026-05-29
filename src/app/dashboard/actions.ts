"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createUserClickForSession } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Click a co-attendee from the post-event dashboard prompt. The source event
// slug ties the click to the event you both attended (and unlocks the
// 12-hours-after window check in the repository).
export async function clickCoAttendeeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const id = formData.get("profile_id");
  const sourceEvent = formData.get("source_event");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  try {
    await createUserClickForSession(
      {
        clickedProfileId: id,
        sourceEventId: typeof sourceEvent === "string" ? sourceEvent : undefined,
      },
      session,
    );
  } catch {
    // Swallow; the dashboard rerender reflects current state.
  }

  revalidatePath("/dashboard");
}
