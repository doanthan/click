import { auth } from "@/auth";
import {
  getCuratedPairToLabel,
  getMatchingLabStats,
  type LabelMember,
} from "@/lib/event-repository";
import { SubmitButton } from "@/components/ds-client";
import { submitLabelAction, undoLastLabelAction } from "./actions";
import { JudgmentShortcuts } from "./judgment-shortcuts";

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

export default async function MatchingLabPage({
  searchParams,
}: {
  searchParams?: Promise<{ save?: string; undo?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  // A failed judgment redirects here with ?save=failed - see actions.ts. The
  // action used to swallow the error and revalidate, which made a dropped label
  // indistinguishable from a saved one.
  const saveFailed = params?.save === "failed";
  // Undo reports three distinct outcomes so "nothing was there to undo" never
  // reads as "your mistake is gone".
  const undoResult = params?.undo === "done" || params?.undo === "empty" || params?.undo === "failed"
    ? params.undo
    : null;
  const [pairResult, stats] = await Promise.all([
    // Resolve the failure into a FLAG rather than into null: a permissions or
    // query error used to collapse into the "no unlabeled pairs" empty state,
    // whose advice (run the feature-refresh cron) cannot fix either of those.
    getCuratedPairToLabel(session).then(
      (value) => ({ pair: value, failed: false }),
      (error: unknown) => {
        console.warn("[matching-lab] could not load a pair to label", error);
        return { pair: null, failed: true };
      },
    ),
    getMatchingLabStats(),
  ]);
  const pair = pairResult.pair;

  return (
    <div className="space-y-8 py-6">
      <header>
        <span className="eyebrow">Matching v2 · Stage 6</span>
        <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)] sm:text-5xl">
          Matching Lab
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--slate)]">
          Cold-start curation + the training/eval loop. Human judgments here keep matching active at
          zero behavioural data and become the training set that replaces the hand-curated cohort
          weights. The inspector lives at{" "}
          <a href="/algo" className="text-[color:var(--purple)] underline">
            /algo
          </a>
          .
        </p>
      </header>

      {/* Eval snapshot */}
      {stats && (
        <section>
          <h2 className="eyebrow">Eval snapshot</h2>
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
        <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6">
          <h2 className="eyebrow">Training readiness</h2>
          <p className="mt-1 text-xs font-medium text-[color:var(--slate)]">
            A cohort can fit learned weights once it has ≥ {stats.labelThreshold} curated labels{" "}
            <em>and</em> ≥ {stats.mutualThreshold} mutual clicks (spec §4.3). Until then it uses the
            hand-curated prior.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Progress label="Curated labels" have={stats.totalLabels} need={stats.labelThreshold} />
            <Progress label="Mutual clicks" have={stats.mutualClicks} need={stats.mutualThreshold} />
          </div>
          <p className="mt-4 rounded-xl bg-[color:var(--champagne)] p-3 text-[0.78rem] font-medium leading-5 text-[color:var(--ink)]">
            The fitting job itself (L2 logistic regression per cohort, AUC gate ≥ 0.60, versioned
            rows into <code>cohort_weights</code>) is an external Python worker -
            not built. This page collects and gates its inputs.
          </p>
        </section>
      )}

      {/* Curated labeling tool */}
      <section>
        <h2 className="eyebrow">Curate a pair</h2>
        <p className="mt-1 max-w-2xl text-xs font-medium text-[color:var(--slate)]">
          &ldquo;Would you introduce these two?&rdquo; Your call is stored with the feature vector at
          label time. The viewer&apos;s cohort drives the predicted score. Each judgment writes a row
          into the training set, so read the pair before you decide - Undo below takes back your own
          most recent one.
        </p>

        {saveFailed ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-[color:var(--danger)] bg-[color:var(--paper)] p-4 text-sm font-semibold text-[color:var(--danger)]"
          >
            That judgment was NOT saved - the write was rejected. Check you are still signed in as
            an admin, then judge the pair again.
          </p>
        ) : null}

        {undoResult === "failed" ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-[color:var(--danger)] bg-[color:var(--paper)] p-4 text-sm font-semibold text-[color:var(--danger)]"
          >
            Nothing was undone - the delete was rejected, so your last judgment is still in the
            training set. Check you are still signed in as an admin and try again. The server log
            has the detail.
          </p>
        ) : undoResult === "empty" ? (
          <p
            role="status"
            className="mt-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium text-[color:var(--ink)]"
          >
            Nothing to undo - you have no curated judgments on record. Undo only ever reaches your
            own labels, never another operator&apos;s.
          </p>
        ) : undoResult === "done" ? (
          <p
            role="status"
            className="mt-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm font-medium text-[color:var(--ink)]"
          >
            Your most recent judgment is gone from the training set. That pair is unlabeled again,
            so it can come back around below.
          </p>
        ) : null}

        {pair ? (
          <form
            action={submitLabelAction}
            className="mt-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-6"
          >
            <input type="hidden" name="profileA" value={pair.a.id} />
            <input type="hidden" name="profileB" value={pair.b.id} />
            <input type="hidden" name="features" value={JSON.stringify(pair.features)} />
            <input type="hidden" name="score" value={pair.score} />

            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <MemberCard member={pair.a} tag="viewer" />
              <div className="flex flex-col items-center justify-center">
                <span className="text-[11px] font-semibold text-[color:var(--slate)]">
                  predicted
                </span>
                <span className="font-display text-4xl font-semibold text-[color:var(--purple)]">
                  {pair.score.toFixed(0)}
                </span>
              </div>
              <MemberCard member={pair.b} tag="candidate" />
            </div>

            {/* Feature vector */}
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[color:var(--line)] pt-4">
              {Object.entries(pair.features)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="ck-tag ck-tag--dense tabular-nums"
                    style={{ opacity: v > 0 ? 1 : 0.4 }}
                  >
                    {PRETTY[k] ?? k} {v.toFixed(2)}
                  </span>
                ))}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[color:var(--ink)]">Why? (optional)</span>
              <input
                name="reason"
                type="text"
                placeholder="e.g. both new to town, strong shared interests"
                className="mt-1 w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-3 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
              />
            </label>

            {/* data-judgment is how JudgmentShortcuts finds the submitter for a
                keystroke. Keep the three values in sync with KEY_TO_JUDGMENT. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                name="judgment"
                value="strong_fit"
                data-judgment="strong_fit"
                className="ck-btn ck-btn--primary ck-btn--sm"
              >
                Strong fit
              </button>
              <button
                type="submit"
                name="judgment"
                value="maybe"
                data-judgment="maybe"
                className="ck-btn ck-btn--secondary ck-btn--sm"
              >
                Maybe
              </button>
              <button
                type="submit"
                name="judgment"
                value="not_a_fit"
                data-judgment="not_a_fit"
                className="ck-btn ck-btn--ghost ck-btn--sm text-[color:var(--slate)]"
              >
                Not a fit
              </button>
              <span className="ml-auto self-center text-[11px] font-medium text-[color:var(--slate)]">
                saves → next pair
              </span>
            </div>

            {/* Keyed on the pair so the component remounts when a new pair
                arrives - that reset is what re-arms its one-judgment latch. */}
            <JudgmentShortcuts key={`${pair.a.id}:${pair.b.id}`} />
          </form>
        ) : pairResult.failed ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-[color:var(--danger)] bg-[color:var(--paper)] p-6 text-sm font-semibold text-[color:var(--danger)]"
          >
            Could not load a pair to label - the query failed rather than coming back empty. This is
            usually the admin gate or the database, not the feature store, so refreshing features
            will not help. The server log has the detail.
          </p>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--paper)] p-6 text-sm font-medium text-[color:var(--slate)]">
            No unlabeled pairs available right now - either everything reachable has been judged, or
            the feature store is too sparse to generate candidates. Run{" "}
            <code className="text-[color:var(--ink)]">/api/cron/refresh-matching-features</code>{" "}
            and reload.
          </p>
        )}

        {/* Undo sits OUTSIDE the judgment form - nested forms are invalid, and
            an undo must never be able to ride along on a judgment submit. It
            also stays reachable when there is no pair on screen, which is
            exactly when you notice the last call was wrong.

            No confirm step on purpose: this IS the confirm-step alternative. A
            dialog in front of the one control that repairs a mistake would just
            add a second thing to get wrong, and the action can only ever reach
            one row - your own latest. */}
        <form action={undoLastLabelAction} className="mt-4 flex flex-wrap items-center gap-3">
          <SubmitButton variant="secondary" size="sm" pendingLabel="Undoing…">
            Undo last label
          </SubmitButton>
          <span className="text-[11px] font-medium text-[color:var(--slate)]">
            Removes your own most recent judgment, and only that one. Another operator&apos;s labels
            are never touched.
          </span>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-4">
      <p className="text-[11px] font-semibold text-[color:var(--slate)]">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-[color:var(--ink)]">{value}</p>
      <p className="mt-0.5 text-[0.68rem] font-medium text-[color:var(--slate)]">{sub}</p>
    </div>
  );
}

function Progress({ label, have, need }: { label: string; have: number; need: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-[color:var(--ink)]">{label}</span>
        <span className="text-[0.68rem] font-semibold tabular-nums text-[color:var(--ink)]">
          {have} / {need}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[color:var(--mist)]">
        <div className="h-full rounded-full bg-[color:var(--purple)]" style={{ width: `${pct(have, need)}%` }} />
      </div>
    </div>
  );
}

function MemberCard({ member, tag }: { member: LabelMember; tag: string }) {
  return (
    <div className="rounded-xl bg-[color:var(--champagne)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[color:var(--slate)]">
          {tag}
        </span>
        <span className="rounded-full bg-[color:var(--lavender-100)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--purple-700)]">
          {member.cohort ?? "—"}
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold text-[color:var(--ink)]">{member.displayName}</p>
      <p className="text-[0.72rem] font-medium text-[color:var(--slate)]">
        {[member.age ? `${member.age}` : null, member.suburb, member.socialEnergy]
          .filter(Boolean)
          .join(" · ") || "sparse profile"}
      </p>
      <p className="mt-1.5 text-[11px] font-medium text-[color:var(--slate)]">
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
