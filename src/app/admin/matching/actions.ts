"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateSystemSettingsAsAdmin } from "@/lib/event-repository";

function num(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const parsed = typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function updateMatchingWeightsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/matching");

  await updateSystemSettingsAsAdmin(session, {
    matchingWeights: {
      tagOverlap: num(formData, "tagOverlap"),
      intentMatch: num(formData, "intentMatch"),
      personaBoost: num(formData, "personaBoost"),
      momentum: num(formData, "momentum"),
      featured: num(formData, "featured"),
      readinessThreshold: num(formData, "readinessThreshold"),
    },
  });

  revalidatePath("/admin/matching");
}
