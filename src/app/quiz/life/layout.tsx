import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LifeQuizProvider } from "@/components/life-quiz-wizard";
import { Icon, Logo } from "@/components/ds";

export const metadata = {
  title: "Life Quiz",
};

// Shared chrome + state provider for the whole /quiz/life flow. The provider is
// mounted here (not in each step page) so selected tags survive client-side
// navigation between the sibling step pages - App Router keeps layouts mounted
// across child page transitions, so the useReducer inside the provider doesn't
// unmount/reset when you go Life stage → Availability → Event style → Energy.
//
// The layout also handles the auth redirect once, instead of repeating it in
// every step page.
//
// Chrome mirrors the DS quiz takeover (`click-app-v2/quiz.jsx`): wordmark, one
// quiet back link, and a narrow centred column. The step counter, the endowed
// progress bar and the footer nav live in <LifeQuizStep>, which knows the step.
export default async function LifeQuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/life");
  }

  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] px-5 py-6 text-[color:var(--ink)] sm:py-8">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="flex items-center justify-between gap-4">
          {/* Takeover chrome, so the wordmark is the way back into the app. */}
          <Link href="/dashboard" aria-label="Click home" className="inline-flex">
            <Logo size={26} />
          </Link>
          <Link
            href="/quiz"
            className="flex items-center gap-1 text-[13px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
          >
            <Icon name="chevL" size={15} stroke={2.2} />
            Quizzes
          </Link>
        </div>

        <LifeQuizProvider>{children}</LifeQuizProvider>
      </div>
    </main>
  );
}
