"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteLastCuratedMatchLabel, saveCuratedMatchLabel } from "@/lib/event-repository";

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

// Undo: drop the calling admin's own most recent judgment.
//
// Its own form and its own action, deliberately - an undo must never be able to
// ride along on a judgment submit, and a separate <form> keeps it working with
// scripting off like the rest of this page.
//
// deleteLastCuratedMatchLabel distinguishes "deleted a row" from "you had no
// labels to delete", so the three outcomes stay three outcomes here rather than
// collapsing into one cheerful "done" - a no-op that reads as a success is the
// same lie the save path was fixed for.
export async function undoLastLabelAction() {
  const session = await auth();

  let outcome: "done" | "empty" | "failed" = "failed";
  try {
    outcome = (await deleteLastCuratedMatchLabel(session)) ? "done" : "empty";
  } catch (error) {
    console.warn("[matching-lab] undo of the last curated label failed", error);
  }

  revalidatePath("/admin/matching-lab");
  // Outside the try: redirect() signals by throwing. The param also clears any
  // stale ?save=failed left over from an earlier attempt.
  redirect(`/admin/matching-lab?undo=${outcome}`);
}
