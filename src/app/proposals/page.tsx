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
  description: "Coordinate a shared follow-up event with people you've matched with.",
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
  // actionable item on the page — both people still need to RSVP — so it stays
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
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <span className="sticker sticker--rose tilt-r-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--surface-deep)]" />
          Proposals
        </span>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[0.96] tracking-[-0.025em] sm:text-6xl">
          Your shared <span className="text-[color:var(--coral)]">plans</span>.
        </h1>
        <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          When you and someone else both click, we suggest a follow-up event. Either of you can
          confirm it in one tap, or suggest an alternative from the catalogue. No messaging — just a
          plan.
        </p>

        {active.length > 0 ? (
          <ul className="mt-10 grid gap-5">
            {active.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} catalogue={catalogue} />
            ))}
          </ul>
        ) : (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6">
            <p className="text-base font-bold">No active proposals yet.</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
              Attend an event, then click with someone afterwards. If they click you back, your first
              proposal opens here.
            </p>
            <Link
              href="/events"
              className="mt-4 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold text-[color:var(--surface-deep)]"
            >
              Find events
            </Link>
          </div>
        )}

        {past.length > 0 ? (
          <div className="mt-12">
            <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--mauve)]">
              Settled · {past.length}
            </h2>
            <ul className="mt-4 grid gap-4">
              {past.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} catalogue={catalogue} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
