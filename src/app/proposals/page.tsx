import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProposalCard } from "@/components/proposal-card";
import {
  getProposalCatalogue,
  getProposalsForSession,
  type ProposalEntry,
} from "@/lib/event-repository";

export const metadata = {
  title: "Proposals | Click",
  description: "Coordinate a shared follow-up event with people you've clicked with.",
};

export default async function ProposalsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/proposals");
  }

  const [proposals, catalogue] = await Promise.all([
    getProposalsForSession(session),
    getProposalCatalogue(),
  ]);

  // A confirmed plan whose event is still upcoming + bookable is the most
  // actionable item on the page - both people still need to RSVP - so it stays
  // in the live list rather than getting buried under "Settled" (bug #199).
  // Only genuinely-done proposals (expired, or confirmed with no live event
  // left) drop to the settled list.
  const isLivePlan = (p: ProposalEntry) =>
    p.status === "confirmed" && Boolean(p.suggestedEventSlug);
  const isActive = (p: ProposalEntry) =>
    (p.status === "pending" && !p.isExpired) || isLivePlan(p);
  const active = proposals.filter(isActive);
  const past = proposals.filter((p) => !isActive(p));
  // Confirmed-but-unRSVP'd plans first (they need a tap); then open proposals.
  active.sort((a, b) => Number(isLivePlan(b)) - Number(isLivePlan(a)));

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
          Your shared plans
        </h1>
        <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-[color:var(--slate)]">
          When you and someone else both click, we suggest a follow-up event. Either of you can confirm it in one tap, or
          suggest another. No messaging - just a plan.
        </p>

        {active.length > 0 ? (
          <ul className="mt-7 grid gap-4">
            {active.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} catalogue={catalogue} />
            ))}
          </ul>
        ) : (
          <div className="mt-7 rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
            <p className="font-display text-[1.05rem] font-semibold text-[color:var(--ink)]">No live plans yet.</p>
            <p className="mx-auto mt-2 max-w-[380px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
              Show up to an event, then click with someone afterwards. If they click you back, your first plan opens here.
            </p>
            <div className="mt-4 flex justify-center">
              <Link href="/discover" className="ck-btn ck-btn--sm ck-btn--primary">
                <span className="ck-btn__label">Find events</span>
              </Link>
            </div>
          </div>
        )}

        {past.length > 0 ? (
          <div className="mt-10">
            <p className="mb-3 text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
              Past clicks · {past.length}
            </p>
            <ul className="grid gap-4">
              {past.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} catalogue={catalogue} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  );
}
