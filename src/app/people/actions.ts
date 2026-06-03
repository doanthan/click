"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createUserClickForSession } from "@/lib/event-repository";

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
        : "Could not send your Click. Try again.";
    return { ok: false, message };
  }

  // The card appears on both /people and /dashboard — refresh both so the state
  // is consistent wherever it was clicked from.
  revalidatePath("/people");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: "Click sent privately. If they Click you back, you'll both see it.",
  };
}
