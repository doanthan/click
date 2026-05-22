import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SectionIntro } from "@/components/click-ui";
import { ClickRadar } from "@/components/click-radar";
import { getPeopleSuggestions } from "@/lib/event-repository";

export const metadata = {
  title: "People | Click",
  description: "People you've shared rooms with and could Click with next.",
};

export default async function PeoplePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/people");
  }

  const people = await getPeopleSuggestions(session);

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <SectionIntro
          eyebrow="Click radar"
          title={<>People you&apos;ve <span className="italic">shared rooms</span> with.</>}
          body="Anonymous Clicks only. If they Click back, we will suggest an event for you both. No chat, no swipe-decks, no pressure."
        />
      </section>

      <section className="mx-auto mt-10 max-w-5xl">
        <ClickRadar initial={people} />
      </section>
    </main>
  );
}
