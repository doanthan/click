import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClickQuiz } from "@/components/click-quiz";
import { Logo } from "@/components/ds";
import { getClickQuizForSession } from "@/lib/event-repository";

export const metadata = {
  title: "The Click quiz",
};

// The Click quiz on its own page: what the modal's link opens in a new tab or
// on a modified click, and where the welcome email's quiz link lands. The
// modal is the main way in (LifeQuizModalLink); this is the same component as
// a card on the page. The old per-section URLs, /quiz and /quiz/personality all
// redirect here in next.config.ts.
export default async function ClickQuizPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/life");
  }

  // Throws into the route's error boundary rather than rendering a blank board
  // a Finish would save over - see getClickQuizForSession.
  const initial = await getClickQuizForSession(session);

  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] px-4 py-6 text-[color:var(--ink)] sm:py-10">
      <div className="mx-auto w-full max-w-[560px]">
        {/* A takeover, so the wordmark is the way back into the app. */}
        <Link href="/dashboard" aria-label="Click home" className="mb-4 inline-flex">
          <Logo size={26} />
        </Link>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[color:var(--paper)] shadow-[var(--shadow-lg)]">
          <ClickQuiz initial={initial} mode="page" />
        </div>
      </div>
    </main>
  );
}
