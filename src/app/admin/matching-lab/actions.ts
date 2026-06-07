"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { saveCuratedMatchLabel } from "@/lib/event-repository";

// Save one curated judgment, then revalidate so the next unlabeled pair loads.
// Plain form action — the judgment comes from the submit button's name/value.
export async function submitLabelAction(formData: FormData) {
  const session = await auth();

  const profileA = String(formData.get("profileA") ?? "");
  const profileB = String(formData.get("profileB") ?? "");
  const judgment = String(formData.get("judgment") ?? "maybe");
  const reason = String(formData.get("reason") ?? "");
  const score = Number(formData.get("score") ?? 0);

  let featuresSnapshot: unknown = {};
  try {
    featuresSnapshot = JSON.parse(String(formData.get("features") ?? "{}"));
  } catch {
    featuresSnapshot = {};
  }

  if (profileA && profileB) {
    try {
      await saveCuratedMatchLabel(session, {
        profileA,
        profileB,
        judgment,
        reason,
        featuresSnapshot,
        score,
      });
    } catch {
      // swallow — admin gate / DB issues shouldn't crash the queue
    }
  }

  revalidatePath("/admin/matching-lab");
}
