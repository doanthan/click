"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ClickResult } from "@/app/people/actions";
import { createUserClickForSession } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Click a co-attendee from the post-event prompt. The source event slug ties the
// click to the event you both attended (and unlocks the post-event window check
// in the repository).
//
// useActionState-compatible, matching clickPersonAction on /people. This used to
// catch every error and return nothing: a click rejected because the post-event
// window had closed, the per-event cap was spent, or the mechanic kill switch
// was off re-rendered the card unchanged with no message, so the button read as
// simply dead and people tapped it repeatedly. The repository already writes
// precise messages for each of those - the only bug was throwing them away.
export async function clickCoAttendeeAction(
  _prev: ClickResult | null,
  formData: FormData,
): Promise<ClickResult> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const id = formData.get("profile_id");
  const sourceEvent = formData.get("source_event");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return { ok: false, message: "That person could not be found." };
  }

  try {
    await createUserClickForSession(
      {
        clickedProfileId: id,
        sourceEventId: typeof sourceEvent === "string" ? sourceEvent : undefined,
      },
      session,
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not send your click. Try again.";
    return { ok: false, message };
  }

  // No revalidatePath here, for the same reason clickPersonAction skips it: the
  // click is already persisted, and re-rendering /dashboard mid-action unmounts
  // this card (the prompt filters out people you've clicked) before the
  // confirmation is ever read. The optimistic `sent` state below covers it.
  return {
    ok: true,
    message: "Sent privately. If they click you back, you'll both see it.",
  };
}
