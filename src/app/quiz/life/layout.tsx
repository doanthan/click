import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LifeQuizProvider } from "@/components/life-quiz-wizard";

export const metadata = {
  title: "Life Quiz | Click",
};

// Shared chrome + state provider for the whole /quiz/life flow. The provider is
// mounted here (not in each step page) so selected tags survive client-side
// navigation between the sibling step pages — App Router keeps layouts mounted
// across child page transitions, so the useReducer inside the provider doesn't
// unmount/reset when you go Life stage → Availability → Event style → Energy.
//
// The layout also handles the auth redirect once, instead of repeating it in
// every step page.
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
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Life Quiz
        </span>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
          Tap what fits. <span className="text-[color:var(--coral)]">Skip what doesn’t.</span>
        </h1>
        <p className="mt-3 text-base font-medium leading-7 text-[color:var(--mauve)]">
          Your answers become tags on your profile. We use them to surface
          events with overlap.
        </p>

        <LifeQuizProvider>{children}</LifeQuizProvider>
      </section>
    </main>
  );
}
