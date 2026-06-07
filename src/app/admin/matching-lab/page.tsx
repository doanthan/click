import { auth } from "@/auth";
import {
  getCuratedPairToLabel,
  getMatchingLabStats,
  type LabelMember,
} from "@/lib/event-repository";
import { submitLabelAction } from "./actions";

export const metadata = {
  title: "Matching Lab | Admin",
};

const PRETTY: Record<string, string> = {
  interest_overlap: "interest",
  sub_tag_overlap: "sub-tags",
  life_tag_overlap: "life tags",
  intent_overlap: "intent",
  energy_match: "energy",
  attended_same_events: "co-attended",
  age_closeness: "age",
  same_suburb: "suburb",
};

function pct(n: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((n / total) * 100)) : 0;
}

export default async function MatchingLabPage() {
  const session = await auth();
  const [pair, stats] = await Promise.all([
    getCuratedPairToLabel(session).catch(() => null),
    getMatchingLabStats(),
  ]);

  return (
    <div className="space-y-8 py-6">
      <header>
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          Matching v2 · Stage 6
        </span>
        <h1 className="font-display mt-2 text-4xl font-light leading-tight tracking-tight sm:text-5xl">
          Matching Lab
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
          Cold-start curation + the training/eval loop. Human judgments here keep matching active at
          zero behavioural data and become the training set that replaces the hand-curated cohort
          weights. The inspector lives at{" "}
          <a href="/algo" className="text-[color:var(--rose)] underline">
            /algo
          </a>
          .
        </p>
      </header>

      {/* Eval snapshot */}
      {stats && (
        <section>
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Eval snapshot
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Mutual-click rate" value={`${(stats.mutualRate * 100).toFixed(0)}%`} sub={`${stats.mutualClicks} / ${stats.clicksMade} clicks`} />
            <Stat label="Clicks made" value={stats.clicksMade} sub="one-way clicks" />
            <Stat label="Impressions" value={stats.impressions} sub="surfaced candidates (labels)" />
            <Stat label="Curated labels" value={stats.totalLabels} sub={`${stats.strongFit} fit · ${stats.maybe} maybe · ${stats.notFit} no`} />
          </div>
        </section>
      )}

      {/* Training readiness */}
      {stats && (
        <section className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Training readiness
          </h2>
          <p className="mt-1 text-xs font-medium text-[color:var(--mauve)]">
            A cohort can fit learned weights once it has ≥ {stats.labelThreshold} curated labels{" "}
            <em>and</em> ≥ {stats.mutualThreshold} mutual clicks (spec §4.3). Until then it uses the
            hand-curated prior.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Progress label="Curated labels" have={stats.totalLabels} need={stats.labelThreshold} />
            <Progress label="Mutual clicks" have={stats.mutualClicks} need={stats.mutualThreshold} />
          </div>
          <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-3 text-[0.78rem] font-medium leading-5 text-[color:var(--ink)]">
            The fitting job itself (L2 logistic regression per cohort, AUC gate ≥ 0.60, versioned
            rows into <code className="font-mono">cohort_weights</code>) is an external Python worker —
            not built. This page collects and gates its inputs.
          </p>
        </section>
      )}

      {/* Curated labeling tool */}
      <section>
        <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
          Curate a pair
        </h2>
        <p className="mt-1 max-w-2xl text-xs font-medium text-[color:var(--mauve)]">
          &ldquo;Would you introduce these two?&rdquo; Your call is stored with the feature vector at
          label time. The viewer&apos;s cohort drives the predicted score.
        </p>

        {pair ? (
          <form
            action={submitLabelAction}
            className="mt-4 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
          >
            <input type="hidden" name="profileA" value={pair.a.id} />
            <input type="hidden" name="profileB" value={pair.b.id} />
            <input type="hidden" name="features" value={JSON.stringify(pair.features)} />
            <input type="hidden" name="score" value={pair.score} />

            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <MemberCard member={pair.a} tag="viewer" />
              <div className="flex flex-col items-center justify-center">
                <span className="font-mono text-[0.6rem] uppercase tracking-wide text-[color:var(--mauve)]">
                  predicted
                </span>
                <span className="font-display text-4xl font-light text-[color:var(--rose)]">
                  {pair.score.toFixed(0)}
                </span>
              </div>
              <MemberCard member={pair.b} tag="candidate" />
            </div>

            {/* Feature vector */}
            <div className="mt-4 flex flex-wrap gap-1.5 border-t-2 border-[color:var(--line)] pt-4">
              {Object.entries(pair.features)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded-full border border-[color:var(--line)] bg-[color:var(--cream)] px-2 py-0.5 font-mono text-[0.6rem] font-bold text-[color:var(--ink)]"
                    style={{ opacity: v > 0 ? 1 : 0.4 }}
                  >
                    {PRETTY[k] ?? k} {v.toFixed(2)}
                  </span>
                ))}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-[color:var(--ink)]">Why? (optional)</span>
              <input
                name="reason"
                type="text"
                placeholder="e.g. both new to town, strong shared interests"
                className="mt-1 w-full rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]"
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                name="judgment"
                value="strong_fit"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
              >
                Strong fit
              </button>
              <button
                type="submit"
                name="judgment"
                value="maybe"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
              >
                Maybe
              </button>
              <button
                type="submit"
                name="judgment"
                value="not_a_fit"
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--mauve)] hard-shadow-sm hover:text-[color:var(--ink)]"
              >
                Not a fit
              </button>
              <span className="ml-auto self-center font-mono text-[0.6rem] uppercase tracking-wide text-[color:var(--mauve)]">
                saves → next pair
              </span>
            </div>
          </form>
        ) : (
          <p className="mt-4 rounded-3xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-6 text-sm font-medium text-[color:var(--mauve)]">
            No unlabeled pairs available right now — either everything reachable has been judged, or
            the feature store is too sparse to generate candidates. Run{" "}
            <code className="font-mono text-[color:var(--ink)]">/api/cron/refresh-matching-features</code>{" "}
            and reload.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm">
      <p className="font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">{label}</p>
      <p className="mt-1 font-display text-3xl font-light text-[color:var(--ink)]">{value}</p>
      <p className="mt-0.5 text-[0.68rem] font-medium text-[color:var(--mauve)]">{sub}</p>
    </div>
  );
}

function Progress({ label, have, need }: { label: string; have: number; need: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold text-[color:var(--ink)]">{label}</span>
        <span className="font-mono text-[0.68rem] font-bold text-[color:var(--ink)]">
          {have} / {need}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)]">
        <div className="h-full bg-[color:var(--rose)]" style={{ width: `${pct(have, need)}%` }} />
      </div>
    </div>
  );
}

function MemberCard({ member, tag }: { member: LabelMember; tag: string }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-wide text-[color:var(--mauve)]">
          {tag}
        </span>
        <span className="rounded-full bg-[color:var(--ink)] px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-[color:var(--on-deep)]">
          {member.cohort ?? "—"}
        </span>
      </div>
      <p className="mt-1 text-lg font-bold text-[color:var(--ink)]">{member.displayName}</p>
      <p className="text-[0.72rem] font-medium text-[color:var(--mauve)]">
        {[member.age ? `${member.age}` : null, member.suburb, member.socialEnergy]
          .filter(Boolean)
          .join(" · ") || "sparse profile"}
      </p>
      <p className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-wide text-[color:var(--mauve)]">
        {member.interests} interests · {member.intents.join("/") || "no intent"}
      </p>
      {member.lifeTags.length > 0 && (
        <p className="mt-1 line-clamp-2 text-[0.64rem] font-medium text-[color:var(--ink)]">
          {member.lifeTags.slice(0, 6).join(", ")}
        </p>
      )}
    </div>
  );
}
