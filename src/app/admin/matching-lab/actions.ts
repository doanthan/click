"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveCuratedMatchLabel } from "@/lib/event-repository";

// Save one curated judgment, then revalidate so the next unlabeled pair loads.
// Plain form action - the judgment comes from the submit button's name/value,
// so this keeps working with scripting off.
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

  let saved = false;
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
      saved = true;
    } catch (error) {
      // Log, then TELL THE OPERATOR via the redirect below. This used to be a
      // bare `catch {}` followed by a revalidate, so an admin-gate or DB failure
      // looked exactly like a successful save - twenty minutes of labelling
      // could produce zero rows with nothing on screen to say so.
      console.warn("[matching-lab] curated label save failed", error);
    }
  }

  revalidatePath("/admin/matching-lab");
  // redirect() works by throwing, so it has to sit outside the try above.
  // Redirecting on BOTH outcomes also clears a stale ?save=failed from the URL
  // once the next judgment lands.
  redirect(saved ? "/admin/matching-lab" : "/admin/matching-lab?save=failed");
}
