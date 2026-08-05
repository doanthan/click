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

  if (tags.length > 0) {
    await saveLifeQuizTags(session, tags);
  }

  revalidatePath("/profile");
  revalidatePath("/quiz");
  // Lands back on the quiz hub rather than /profile: the hub is the one page
  // that can say what just happened (it reads `from` and `saved`, and marks the
  // Life card done), and it is where the other quiz is offered next. `saved`
  // carries the count so a finish with nothing selected - which skips the write
  // above entirely - cannot look identical to a real save.
  redirect(`/quiz?from=life-quiz&saved=${tags.length}`);
}
