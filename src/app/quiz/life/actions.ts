"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeQuizSelections, saveLifeQuizTags } from "@/lib/event-repository";

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

// The one save behind both ways into the quiz: the /quiz/life route, which lands
// on the hub afterwards, and the modal on /dashboard and /profile/edit, which
// stays where it was opened.
async function saveLifeQuizFromForm(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/life");
  }

  const tags = formData
    .getAll("tag")
    .filter((v): v is string => typeof v === "string")
    .filter((v) => SAFE_SLUG.test(v));

  // The sections the wizard actually rendered this sitting. saveLifeQuizTags
  // deletes ONLY within these, so this list is the whole blast radius of the
  // retake: a section that was never on screen keeps whatever it had, even if
  // the user deep-linked straight to the last step. Unknown slugs are dropped
  // server-side by the repository's own section map.
  const sections = formData
    .getAll("section")
    .filter((v): v is string => typeof v === "string")
    .filter((v) => SAFE_SLUG.test(v));

  // Set by the wizard when the sitting opened with answers already selected -
  // the only place that fact exists, and what lets the hub tell a deliberate
  // clear apart from a skip. Display only: it changes no write.
  const hadAnswers = formData.get("had") === "1";

  // An empty tag list is no longer a no-op. The retake is authoritative within
  // the sections that were shown, so submitting nothing for a visited section is
  // exactly how a user takes an answer back off their profile.
  if (tags.length > 0 || sections.length > 0) {
    await saveLifeQuizTags(session, tags, sections);
  }

  revalidatePath("/profile");
  revalidatePath("/quiz");
  // The wizard pre-populates from a server read in /quiz/life's LAYOUT, so a
  // cached copy of that segment would re-open the quiz on the answers the user
  // just changed. "layout" because that is the segment holding the read.
  revalidatePath("/quiz/life", "layout");
  // The two pages the modal opens over. Both read quiz completion - the
  // dashboard's "Finish setting up" card and the edit page's quiz row - and a
  // server function's revalidate re-renders the page it was called from, so
  // the modal closes onto the ticked-off item without losing the page's state.
  revalidatePath("/dashboard");
  revalidatePath("/profile/edit");

  return {
    saved: tags.length,
    cleared: tags.length === 0 && sections.length > 0 && hadAnswers,
  };
}

export async function submitLifeQuizAction(formData: FormData) {
  const { saved, cleared } = await saveLifeQuizFromForm(formData);
  // Lands back on the quiz hub rather than /profile: the hub is the one page
  // that can say what just happened (it reads `from`, `saved` and `cleared`, and
  // marks the Life card done), and it is where the other quiz is offered next.
  // Three endings reach it and all three have to look different: answers saved,
  // answers deliberately cleared, and a finish that wrote nothing at all.
  redirect(`/quiz?from=life-quiz&saved=${saved}${cleared ? "&cleared=1" : ""}`);
}

// The modal's Finish (bug board #253, #287): the same save, no redirect - the
// member goes back to exactly where they opened it, unsaved profile edits and all.
export async function saveLifeQuizInPlaceAction(formData: FormData) {
  return saveLifeQuizFromForm(formData);
}

// The answers the modal opens on - the read /quiz/life's layout does for the
// route. Asked for on open rather than on every dashboard render, which would
// pay for it whether or not anyone takes the quiz.
export async function loadLifeQuizSelectionsAction(): Promise<string[]> {
  const session = await auth();
  if (!session?.user) return [];
  return getLifeQuizSelections(session);
}
