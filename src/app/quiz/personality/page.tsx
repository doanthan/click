import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Icon, Logo } from "@/components/ds";
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

  // Same chrome as the Life quiz: wordmark, one quiet back link, a narrow
  // centred column. The step counter, endowed progress bar and footer nav live
  // in the wizard, which knows the step.
  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] px-5 py-6 text-[color:var(--ink)] sm:py-8">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="flex items-center justify-between gap-4">
          <Logo size={26} />
          <Link
            href="/quiz"
            className="flex items-center gap-1 text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            <Icon name="chevL" size={15} stroke={2.2} />
            Quizzes
          </Link>
        </div>

        <PersonalityQuizWizard initialError={initialError} />
      </div>
    </main>
  );
}
