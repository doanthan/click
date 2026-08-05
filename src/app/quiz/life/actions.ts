"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { saveLifeQuizTags } from "@/lib/event-repository";

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

export async function submitLifeQuizAction(formData: FormData) {
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

  const cleared = tags.length === 0 && sections.length > 0 && hadAnswers;

  revalidatePath("/profile");
  revalidatePath("/quiz");
  // The wizard pre-populates from a server read in /quiz/life's LAYOUT, so a
  // cached copy of that segment would re-open the quiz on the answers the user
  // just changed. "layout" because that is the segment holding the read.
  revalidatePath("/quiz/life", "layout");
  // Lands back on the quiz hub rather than /profile: the hub is the one page
  // that can say what just happened (it reads `from`, `saved` and `cleared`, and
  // marks the Life card done), and it is where the other quiz is offered next.
  // Three endings reach it and all three have to look different: answers saved,
  // answers deliberately cleared, and a finish that wrote nothing at all.
  redirect(
    `/quiz?from=life-quiz&saved=${tags.length}${cleared ? "&cleared=1" : ""}`,
  );
}
