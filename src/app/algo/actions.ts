"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { updateSystemSettingsAsAdmin } from "@/lib/event-repository";

export type ToggleState = { ok: boolean; message: string } | null;

// Flip the Matching v2 kill-switch (system_settings.matching_v2_enabled). Admin
// only - the people + discovery surfaces start re-ranking with v2 the moment
// this is on. Surfaces a message via useActionState rather than throwing.
export async function setMatchingV2EnabledAction(
  _prev: ToggleState,
  formData: FormData,
): Promise<ToggleState> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "Sign in as an admin to change the live matching engine." };
  }

  const enabled = formData.get("enabled") === "true";

  try {
    await updateSystemSettingsAsAdmin(session, { matchingV2Enabled: enabled });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AuthRequiredError"
        ? "Admin access is required to change the live matching engine."
        : "Couldn't save - the live engine is unchanged.";
    return { ok: false, message };
  }

  revalidatePath("/algo");
  return {
    ok: true,
    message: enabled
      ? "v2 is now LIVE - people + discovery re-rank with the cohort model."
      : "Reverted to v1 - production serves the legacy engine.",
  };
}
