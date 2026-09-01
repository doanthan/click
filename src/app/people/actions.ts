"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createUserClickForSession } from "@/lib/event-repository";
import { CLICK_SENT_LINE } from "@/lib/clicks/constants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClickResult = { ok: boolean; message: string };

// useActionState-compatible: receives the previous state + the form data, and
// returns a result the card renders. Previously this swallowed every error and
// returned nothing, so a click that failed the post-event eligibility gate
// looked like the button "did nothing". Now the outcome is always surfaced.
export async function clickPersonAction(
  _prev: ClickResult | null,
  formData: FormData,
): Promise<ClickResult> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/people");
  }

  const id = formData.get("profile_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return { ok: false, message: "That person could not be found." };
  }

  try {
    await createUserClickForSession({ clickedProfileId: id }, session);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not send your click. Try again.";
    return { ok: false, message };
  }

  // Deliberately DON'T revalidate here. The click is already persisted, so the
  // next natural load of /people or /dashboard reflects it (and the dashboard
  // drops the person from its "click with someone" rotation). Revalidating the
  // current page instead re-renders it mid-action and the dashboard's
  // already-clicked filter unmounts this very card before the user ever sees the
  // "Clicked privately — pending their Click" confirmation (bug board #188). The
  // optimistic state below keeps the card mounted so that pending state shows.
  return {
    ok: true,
    message: CLICK_SENT_LINE,
  };
}
