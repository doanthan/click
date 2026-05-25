"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createUserClickForSession } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function clickPersonAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/people");
  }

  const id = formData.get("profile_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return;
  }

  try {
    await createUserClickForSession({ clickedProfileId: id }, session);
  } catch {
    // Swallow; the page rerender will reflect current state.
  }

  revalidatePath("/people");
}
