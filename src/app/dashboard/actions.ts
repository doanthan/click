"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ClickResult } from "@/app/people/actions";
import { createUserClickForSession } from "@/lib/event-repository";
import { CLICK_SENT_LINE } from "@/lib/clicks/constants";

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

  // §6.9 swap: present only from the spent state, where the picker asks which of the
  // viewer's own pending clicks to release. Absent on every ordinary send, and the
  // repository refuses it outright on the discovery surface, so a forged field can
  // only ever spend the sender's own one swap on their own click.
  const release = formData.get("release_profile_id");
  const releaseReceiverId =
    typeof release === "string" && UUID_RE.test(release) ? release : undefined;

  try {
    await createUserClickForSession(
      {
        clickedProfileId: id,
        sourceEventId: typeof sourceEvent === "string" ? sourceEvent : undefined,
        releaseReceiverId,
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
    message: CLICK_SENT_LINE,
  };
}
