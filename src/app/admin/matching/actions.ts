"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSystemSettings, updateSystemSettingsAsAdmin } from "@/lib/event-repository";

/**
 * Coerce one weight, falling back to the CURRENTLY SAVED value.
 *
 * The old fallback was 0, and it never even ran: Number("") is 0 and
 * Number.isFinite(0) is true, so a field the operator cleared to retype
 * persisted as a real zero and silently switched that signal off for every
 * member's feed. An empty or unparseable field now means "leave this alone",
 * which is the only safe reading of a blank box on a live ranking form.
 */
function num(formData: FormData, key: string, current: number): number {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return current;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : current;
}

export async function updateMatchingWeightsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/matching");

  const current = (await getSystemSettings()).matchingWeights;

  await updateSystemSettingsAsAdmin(session, {
    matchingWeights: {
      tagOverlap: num(formData, "tagOverlap", current.tagOverlap),
      intentMatch: num(formData, "intentMatch", current.intentMatch),
      personaBoost: num(formData, "personaBoost", current.personaBoost),
      momentum: num(formData, "momentum", current.momentum),
      featured: num(formData, "featured", current.featured),
      readinessThreshold: num(formData, "readinessThreshold", current.readinessThreshold),
    },
  });

  revalidatePath("/admin/matching");
}
