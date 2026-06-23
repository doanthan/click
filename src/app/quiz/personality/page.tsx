import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PersonalityQuizWizard } from "./wizard";

export const metadata = {
  title: "Personality Quiz | Click",
};

type PersonalityQuizPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function PersonalityQuizPage({
  searchParams,
}: PersonalityQuizPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/personality");
  }
  const params = await searchParams;
  const initialError = params?.error === "incomplete";

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Personality Quiz
        </span>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
          One question at a time. <span className="text-[color:var(--coral)]">One persona.</span>
        </h1>
        <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
          Pick what feels true — we’ll write a Click Persona we use to surface compatible plans.
        </p>

        <PersonalityQuizWizard initialError={initialError} />
      </section>
    </main>
  );
}
