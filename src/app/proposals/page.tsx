import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClicksList } from "@/components/clicks-list";
import { getProposalCatalogue, getProposalsForSession } from "@/lib/event-repository";

export const metadata = {
  title: "Your clicks",
  description: "Coordinate a shared plan with people you've clicked with.",
};

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/proposals");
  }

  const [{ open }, entries, catalogue] = await Promise.all([
    searchParams,
    getProposalsForSession(session),
    getProposalCatalogue(),
  ]);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        <h1 className="font-display text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
          Your clicks
        </h1>
        <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-[color:var(--slate)]">
          When you and someone else both click, we suggest a plan. Open one to confirm it, suggest
          another, or say it&apos;s not the one - all in one place. No messaging - just a plan.
        </p>

        {/* The coordination itself lives in the drawer ClicksList opens (§1); this page
            is only the durable list. `open` deep-links a mutual straight to its step. */}
        <ClicksList entries={entries} catalogue={catalogue} initialOpenId={open} />
      </div>
    </main>
  );
}
