import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostgresPool } from "@/lib/postgres";
import { getSystemSettings } from "@/lib/event-repository";
import {
  generateEventCandidates,
  generatePeopleCandidates,
  loadUserFeatures,
} from "@/lib/matching/candidates";
import { DEFAULT_COHORT_WEIGHTS, MODEL_VERSION } from "@/lib/matching/weights";
import { SUB_TAG_PATTERNS } from "@/lib/matching/sub-tags";
import { COHORTS, type CohortId, type FeatureName } from "@/lib/matching/types";
import { Badge } from "@/components/ds";
import V2Toggle from "@/components/algo/v2-toggle";
import { isProductionDeployment } from "@/lib/runtime-mode";

export const metadata = {
  title: "Matching engine v2 - inspector",
};

// Internal inspector for the v2 matching engine (context/04_MATCHING_ALGORITHM_V2.md).
// Server-rendered so it runs the *real* engine on live data: pick a member, see
// their cohort + feature vector, the active cohort weights, and the actual
// people/event candidates the engine would surface, with per-feature score
// breakdowns. v1 is still what production serves - this shows v2 before it's wired.

// User↔user feature columns shown in the per-cohort weight matrix.
const PAIR_FEATURES: FeatureName[] = [
  "interest_overlap",
  "sub_tag_overlap",
  "life_tag_overlap",
  "intent_overlap",
  "energy_match",
  "attended_same_events",
  "age_closeness",
  "same_suburb",
];

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

const PRETTY: Partial<Record<FeatureName, string>> = {
  interest_overlap: "interest",
  sub_tag_overlap: "sub-tags",
  life_tag_overlap: "life tags",
  intent_overlap: "intent",
  energy_match: "energy",
  attended_same_events: "co-attended",
  age_closeness: "age",
  same_suburb: "suburb",
  interest_match: "interest",
  sub_tag_match: "sub-tags",
  life_tag_target_match: "life fit",
  category_history: "category",
  momentum: "momentum",
};

function Chips({ contributions }: { contributions: Partial<Record<FeatureName, number>> }) {
  const top = (Object.entries(contributions) as [FeatureName, number][])
    .filter(([, v]) => v > 0.001)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  if (top.length === 0) {
    return (
      <span className="font-mono text-[0.6rem] uppercase tracking-wide text-[color:var(--mauve)]">
        intercept only
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {top.map(([name, v]) => (
        <span
          key={name}
          className="rounded-full border border-[color:var(--line)] bg-[color:var(--cream)] px-1.5 py-0.5 font-mono text-[0.58rem] font-bold tracking-wide text-[color:var(--ink)]"
        >
          {PRETTY[name] ?? name} {v.toFixed(2)}
        </span>
      ))}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)]">
        <div
          className="h-full bg-[color:var(--rose)]"
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <span className="font-mono text-sm font-black tabular-nums text-[color:var(--rose)]">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default async function AlgoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isProductionDeployment()) notFound();
  const params = await searchParams;
  const pool = getPostgresPool();
  const { matchingV2Enabled } = await getSystemSettings();

  if (!pool) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-3xl">Matching engine v2</h1>
        <p className="mt-3 text-[color:var(--mauve)]">
          Database unavailable - the inspector needs the feature store. Run the migration and the
          feature-refresh cron, then reload.
        </p>
      </main>
    );
  }

  // Inspectable members - richest profiles first so the demo lands on someone
  // with signal.
  const memberList = await pool.query<{
    profile_id: string;
    display_name: string;
    cohort_id: string | null;
    ni: number;
    attendance_count: number;
  }>(`
    select uf.profile_id::text, p.display_name, uf.cohort_id,
      coalesce(array_length(uf.interest_tag_ids, 1), 0) as ni, uf.attendance_count
    from user_features uf
    join profiles p on p.id = uf.profile_id
    order by ni desc, uf.rsvp_count desc, p.display_name
    limit 24
  `);
  const members = memberList.rows;

  // Feature-store health - the "all the data" view. Cheap aggregate scan.
  const statsRow = await pool.query<{
    profiles: number;
    with_interests: number;
    with_energy: number;
    with_attendance: number;
    with_subtags: number;
    events: number;
    events_tagged: number;
    distinct_subtags: number;
    impressions: number;
    trained_weight_rows: number;
    mutual_clicks: number;
  }>(`
    select
      (select count(*) from user_features)::int as profiles,
      (select count(*) from user_features where array_length(interest_tag_ids,1) > 0)::int as with_interests,
      (select count(*) from user_features where social_energy is not null)::int as with_energy,
      (select count(*) from user_features where attendance_count > 0)::int as with_attendance,
      (select count(*) from user_features where behavioural_sub_tags <> '{}'::jsonb)::int as with_subtags,
      (select count(*) from events)::int as events,
      (select count(*) from events where array_length(sub_tags,1) > 0)::int as events_tagged,
      (select count(distinct st) from events, unnest(sub_tags) st)::int as distinct_subtags,
      (select count(*) from match_impressions)::int as impressions,
      (select count(*) from cohort_weights)::int as trained_weight_rows,
      (select count(*) from mutual_clicks)::int as mutual_clicks
  `);
  const stats = statsRow.rows[0];

  const cohortDistRows = await pool.query<{ cohort_id: string | null; n: number }>(
    `select cohort_id, count(*)::int as n from user_features group by cohort_id order by n desc`,
  );
  const cohortDist = cohortDistRows.rows;
  const recommendations = buildRecommendations(stats, cohortDist);

  const requested = typeof params.member === "string" ? params.member : undefined;
  const selectedId = requested ?? members[0]?.profile_id;

  const viewer = selectedId ? await loadUserFeatures(pool, selectedId) : null;
  const cohort: CohortId = viewer?.cohortId ?? "new_local";
  const weights = DEFAULT_COHORT_WEIGHTS[cohort];

  const [people, events, selfRow] = selectedId
    ? await Promise.all([
        generatePeopleCandidates(pool, selectedId, 5),
        generateEventCandidates(pool, selectedId, 6),
        pool.query<{ display_name: string }>(
          `select display_name from profiles where id = $1::uuid`,
          [selectedId],
        ),
      ])
    : [[], [], { rows: [] as { display_name: string }[] }];

  const nameRows = people.length
    ? await pool.query<{ id: string; display_name: string }>(
        `select id::text, display_name from profiles where id = any($1::uuid[])`,
        [people.map((p) => p.profileId)],
      )
    : { rows: [] as { id: string; display_name: string }[] };
  const names = new Map(nameRows.rows.map((r) => [r.id, r.display_name]));
  const selfName = selfRow.rows[0]?.display_name ?? "member";

  const weightEntries = (Object.entries(weights) as [string, number][])
    .filter(([k]) => k !== "intercept")
    .sort((a, b) => b[1] - a[1]);
  const maxWeight = Math.max(...weightEntries.map(([, v]) => v), 1);

  const subTagParents = Object.keys(SUB_TAG_PATTERNS).length;
  const subTagCount = Object.values(SUB_TAG_PATTERNS).reduce((n, list) => n + list.length, 0);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <header className="max-w-3xl">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          Under the hood · v2
        </span>
        <h1 className="font-display mt-2 text-4xl font-bold leading-tight tracking-[-0.025em] sm:text-5xl">
          The matching engine
        </h1>
        <p className="mt-4 text-base font-medium leading-7 text-[color:var(--mauve)]">
          v2 is a cohort-aware logistic-regression model: features from the store, dotted with{" "}
          <em>per-cohort</em> weights, squashed to 0–100. This inspector runs the real engine on a
          live member - their cohort, feature vector, and the actual candidates it would surface.
        </p>
      </header>

      {/* Live status - reflects the real system_settings.matching_v2_enabled flag */}
      <section
        className={`mt-6 rounded-3xl border-2 p-5 hard-shadow-sm ${
          matchingV2Enabled
            ? "border-[color:var(--line)] bg-[color:var(--rose)]/15"
            : "border-dashed border-[color:var(--line)] bg-[color:var(--champagne)]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            {/* Live/off state rides on a Badge, never on a coloured dot. The
                dot here was --rose, and --rose RESOLVES to Deep Purple - the
                one primary-action colour - so a passive status indicator was
                painted as though it were a CTA. Status colours belong on badges
                only: sage is the DS success/live tone, neutral carries "off". */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={matchingV2Enabled ? "sage" : "neutral"}>
                {matchingV2Enabled ? "v2 is LIVE" : "v2 is OFF - production serves v1"}
              </Badge>
              <span className="rounded-full bg-[color:var(--ink)] px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-[color:var(--on-deep)]">
                {MODEL_VERSION}
              </span>
            </div>
            <p className="mt-2 text-[0.8rem] font-medium leading-5 text-[color:var(--ink)]">
              {matchingV2Enabled ? (
                <>
                  The <strong>People</strong> (<code className="font-mono">/people</code>,{" "}
                  <code className="font-mono">getSuggestedPeople</code>) and{" "}
                  <strong>Discovery</strong> (<code className="font-mono">getPersonalizedDiscovery</code>)
                  surfaces re-rank their existing candidate pool with the v2 cohort model right now.
                  A member with no feature-store row falls back to v1 automatically.
                </>
              ) : (
                <>
                  The engine below is fully built and verified, but the live{" "}
                  <strong>People</strong> + <strong>Discovery</strong> surfaces still rank with v1
                  (and the weights at{" "}
                  {/* Deep Purple is right for a link - a link IS an action - but
                      say so with the intent-named token. --rose is the historic
                      accent alias that happens to resolve to the same hex, and
                      leaning on it is how status indicators nearby ended up
                      wearing the primary-action colour in the first place. */}
                  <Link href="/admin/matching" className="text-[color:var(--purple)] underline">
                    /admin/matching
                  </Link>
                  ). Flip the switch to send real traffic through v2.
                </>
              )}
            </p>
          </div>
          <V2Toggle enabled={matchingV2Enabled} />
        </div>
        <p className="mt-3 border-t-2 border-[color:var(--line)]/40 pt-2 font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
          Flag: system_settings.matching_v2_enabled · admin-flippable · default ON (v2)
        </p>
      </section>

      {/* Feature-store health - the data the engine runs on */}
      <section className="mt-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight">The data it runs on</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium text-[color:var(--mauve)]">
          Live coverage of the <code className="font-mono text-[color:var(--ink)]">user_features</code> store
          and <code className="font-mono text-[color:var(--ink)]">events.sub_tags</code>. Matching quality
          is bounded by these - thin coverage means the model leans on whatever signal it has.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Members profiled" value={stats.profiles} sub="in the feature store" />
          <StatCard
            label="With interest tags"
            value={`${stats.with_interests}/${stats.profiles}`}
            sub="primary matching signal"
            pct={pct(stats.with_interests, stats.profiles)}
          />
          <StatCard
            label="With a persona"
            value={`${stats.with_energy}/${stats.profiles}`}
            sub="drives energy_match"
            pct={pct(stats.with_energy, stats.profiles)}
          />
          <StatCard
            label="With attendance"
            value={`${stats.with_attendance}/${stats.profiles}`}
            sub="behavioural signal"
            pct={pct(stats.with_attendance, stats.profiles)}
          />
          <StatCard
            label="Events sub-tagged"
            value={`${stats.events_tagged}/${stats.events}`}
            sub={`${stats.distinct_subtags} distinct sub-tags`}
            pct={pct(stats.events_tagged, stats.events)}
          />
          <StatCard label="Members w/ sub-tags" value={stats.with_subtags} sub="behavioural refinement" />
          <StatCard label="Mutual clicks" value={stats.mutual_clicks} sub="training labels (need ≥50/cohort)" />
          <StatCard
            label="Trained weights"
            value={stats.trained_weight_rows}
            sub={stats.trained_weight_rows === 0 ? "using hand-curated priors" : "learned rows"}
          />
        </div>

        {/* Cohort distribution */}
        <div className="mt-4 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
          <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Cohort distribution
          </h3>
          <ul className="mt-3 space-y-2">
            {cohortDist.map((c) => (
              <li key={c.cohort_id ?? "none"} className="flex items-center gap-3">
                <span className="w-32 shrink-0 font-mono text-[0.64rem] uppercase tracking-wide text-[color:var(--ink)]">
                  {c.cohort_id ?? "unassigned"}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)]">
                  <div
                    className="h-full bg-[color:var(--rose)]"
                    style={{ width: `${pct(c.n, stats.profiles)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[0.7rem] font-bold tabular-nums text-[color:var(--ink)]">
                  {c.n}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Member picker */}
      <section className="mt-10">
        <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
          Inspect a member
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((m) => {
            const active = m.profile_id === selectedId;
            return (
              <Link
                key={m.profile_id}
                href={`/algo?member=${m.profile_id}`}
                className={`rounded-full border-2 px-3 py-1.5 text-[0.78rem] font-bold transition ${
                  active
                    ? "border-[color:var(--line)] bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : "border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
                }`}
              >
                {m.display_name}
                <span className="ml-1.5 font-mono text-[0.58rem] uppercase opacity-70">
                  {m.cohort_id ?? "-"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {viewer ? (
        <>
          {/* Member features + cohort weights */}
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold">{selfName}</h3>
                <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-3 py-1 font-mono text-[0.62rem] font-black uppercase tracking-wide text-[color:var(--on-deep)]">
                  {cohort}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Feat label="Interest tags" value={viewer.interestTagIds.length} />
                <Feat label="Life tags" value={viewer.lifeTags.length} />
                <Feat label="Intents" value={viewer.intents.join(", ") || "-"} />
                <Feat label="Social energy" value={viewer.socialEnergy ?? "unknown"} />
                <Feat label="Age" value={viewer.age ?? "-"} />
                <Feat label="Suburb" value={viewer.suburb ?? "-"} />
                <Feat label="Attended (ended)" value={viewer.attendanceCount} />
                <Feat label="RSVPs" value={viewer.rsvpCount} />
                <Feat label="Sub-tags" value={Object.keys(viewer.behaviouralSubTags).length} />
                <Feat
                  label="Clicks made / mutual"
                  value={`${viewer.clicksMadeCount} / ${viewer.mutualClickCount}`}
                />
              </dl>
              {Object.keys(viewer.behaviouralSubTags).length > 0 && (
                <p className="mt-3 border-t-2 border-dashed border-[color:var(--line)] pt-3 font-mono text-[0.62rem] uppercase tracking-wide text-[color:var(--mauve)]">
                  {Object.entries(viewer.behaviouralSubTags)
                    .map(([k, v]) => `${k}·${v}`)
                    .join("  ")}
                </p>
              )}
            </div>

            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
              <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
                Active weights · cohort {cohort}
              </h3>
              <p className="mt-1 text-[0.7rem] font-medium text-[color:var(--mauve)]">
                Hand-curated Phase-0 prior (intercept {weights.intercept}). The Month-2 training
                pipeline replaces these with learned coefficients.
              </p>
              <ul className="mt-4 space-y-2">
                {weightEntries.map(([name, value]) => (
                  <li key={name} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 font-mono text-[0.64rem] uppercase tracking-wide text-[color:var(--ink)]">
                      {PRETTY[name as FeatureName] ?? name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--champagne)]">
                      <div
                        className="h-full bg-[color:var(--ink)]"
                        style={{ width: `${(value / maxWeight) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-[0.7rem] font-bold tabular-nums text-[color:var(--rose)]">
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Candidates */}
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <CandidateCard title={`People for ${selfName}`} subtitle="scorePair · top 5" empty={people.length === 0}>
              {people.map((p, i) => (
                <li key={p.profileId} className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3">
                  <div className="flex items-center gap-3">
                    <Rank n={i + 1} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--ink)]">
                      {names.get(p.profileId) ?? p.profileId.slice(0, 8)}
                    </span>
                    <ScoreBar score={p.score} />
                  </div>
                  <div className="mt-2 pl-10">
                    <Chips contributions={p.contributions} />
                  </div>
                </li>
              ))}
            </CandidateCard>

            <CandidateCard title={`Events for ${selfName}`} subtitle="scoreUserEvent · top 6" empty={events.length === 0}>
              {events.map((e, i) => (
                <li key={e.eventId} className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3">
                  <div className="flex items-center gap-3">
                    <Rank n={i + 1} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--ink)]">
                      {e.title}
                    </span>
                    <ScoreBar score={e.score} />
                  </div>
                  <div className="mt-2 pl-10">
                    <Chips contributions={e.contributions} />
                  </div>
                </li>
              ))}
            </CandidateCard>
          </section>
          <p className="mt-3 max-w-3xl text-[0.72rem] font-medium leading-5 text-[color:var(--mauve)]">
            This inspector runs the pure §5 generators (<code className="font-mono">generatePeopleCandidates</code>{" "}
            / <code className="font-mono">generateEventCandidates</code>). The live surfaces score with the
            same model but over their own pools:{" "}
            <code className="font-mono">/people</code> re-ranks its complete-profile pool with{" "}
            <code className="font-mono">scorePair</code>, and Discovery re-ranks{" "}
            <code className="font-mono">getPersonalizedDiscovery</code>&apos;s pool with{" "}
            <code className="font-mono">scoreUserEvent</code> - only when the flag above is on.
          </p>
        </>
      ) : (
        <p className="mt-8 text-sm font-medium text-[color:var(--mauve)]">
          No members in the feature store yet. Run{" "}
          <code className="font-mono text-[color:var(--ink)]">/api/cron/refresh-matching-features</code>.
        </p>
      )}

      {/* All cohort weights - see how the levers differ per cohort */}
      <section className="mt-12">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Per-cohort weights</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium text-[color:var(--mauve)]">
          The core of v2: each cohort gets its own weight vector (user↔user features shown). This is
          why a new-to-Sydney member and a habitual local rank the same candidate differently.
          Hand-curated today; learned monthly once data supports it.
        </p>
        <div className="mt-5 overflow-x-auto rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] hard-shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-[color:var(--line)]">
                <th className="p-3 font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
                  cohort
                </th>
                {PAIR_FEATURES.map((f) => (
                  <th
                    key={f}
                    className="p-3 text-center font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]"
                  >
                    {PRETTY[f] ?? f}
                  </th>
                ))}
                <th className="p-3 text-center font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
                  intercept
                </th>
              </tr>
            </thead>
            <tbody>
              {COHORTS.map((cid) => {
                const w = DEFAULT_COHORT_WEIGHTS[cid];
                return (
                  <tr key={cid} className="border-b border-[color:var(--line)]/40">
                    <td className="p-3 font-mono text-[0.64rem] font-bold text-[color:var(--ink)]">
                      {cid}
                    </td>
                    {PAIR_FEATURES.map((f) => {
                      const v = w[f] ?? 0;
                      return (
                        <td key={f} className="p-2 text-center">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 font-mono text-[0.66rem] font-bold tabular-nums text-[color:var(--ink)]"
                            style={{ background: `color-mix(in oklab, var(--rose) ${Math.min(100, v * 22)}%, transparent)` }}
                          >
                            {v.toFixed(1)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-mono text-[0.64rem] tabular-nums text-[color:var(--mauve)]">
                      {w.intercept}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cohort rules + sub-tag taxonomy */}
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm">
          <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Cohort assignment rules
          </h3>
          <p className="mt-1 text-[0.72rem] font-medium text-[color:var(--mauve)]">
            First match wins (intent leads - the single biggest splitter). Recomputed each batch.
          </p>
          <ol className="mt-3 space-y-2 text-[0.8rem] font-medium text-[color:var(--ink)]">
            {[
              "dating intent + age ≥ 38 → dating_38plus",
              "dating intent + age < 38 → dating_under_38",
              "“new to town” life tag → new_to_sydney",
              "attended ≥ 3 → active_local",
              "attended ≥ 1 → engaged_local",
              "otherwise → new_local (signed up, hasn’t attended)",
            ].map((r, i) => (
              <li key={r} className="flex gap-2">
                <span className="font-mono text-[color:var(--rose)]">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
          <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Sub-tag taxonomy · {subTagParents} parents · {subTagCount} sub-tags
          </h3>
          <p className="mt-1 text-[0.72rem] font-medium text-[color:var(--mauve)]">
            Refines coarse interests from event text at publish. Add a category → add its sub-tags.
          </p>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {Object.entries(SUB_TAG_PATTERNS).map(([parent, list]) => (
              <div key={parent} className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-mono text-[0.66rem] font-bold uppercase tracking-wide text-[color:var(--ink)]">
                  {parent}
                </span>
                {list.map((s) => (
                  <span
                    key={s.subTag}
                    className="rounded-full border border-[color:var(--line)] bg-[color:var(--champagne)] px-1.5 py-0.5 font-mono text-[0.56rem] text-[color:var(--mauve)]"
                  >
                    {s.subTag}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Levers */}
      <section className="mt-12">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Levers we can pull</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium text-[color:var(--mauve)]">
          v2&apos;s control points and where they live. Most are code-level today; the weights become
          data-driven once the training pipeline ships (Month 2+).
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Lever
            name="Cohorts"
            value={`${COHORTS.length} segments`}
            body="Intent-first, then age 38 split / new-to-town / attendance tiers."
            file="matching/cohorts.ts"
          />
          <Lever
            name="Cohort weights"
            value="hand-curated → learned"
            body="One logistic weight vector per cohort. Trained monthly once data supports it."
            file="matching/weights.ts"
          />
          <Lever
            name="Candidate filters"
            value="200 people / 100 events"
            body="Active 30d · shared intent · not blocked · not shown 14d."
            file="matching/candidates.ts"
          />
          <Lever
            name="Anti-repeat window"
            value="14 days"
            body="match_impressions stops re-showing the same person/event."
            file="match_impressions"
          />
          <Lever
            name="Sub-tag taxonomy"
            value={`${subTagParents} parents · ${subTagCount} sub-tags`}
            body="Refines coarse interests from event text at publish."
            file="matching/sub-tags.ts"
          />
          <Lever
            name="Model version"
            value={MODEL_VERSION}
            body="Stamped on every impression so outcomes attribute to a model."
            file="matching/weights.ts"
          />
        </div>
      </section>

      {/* Recommendations - computed from the live feature-store coverage above */}
      <section className="mt-12">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          How to improve it
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium text-[color:var(--mauve)]">
          Generated from the live coverage numbers - ordered by impact. These are the levers that
          actually move match quality right now.
        </p>
        <div className="mt-5 space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.title}
              className="flex gap-4 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
            >
              <span
                className={`mt-0.5 h-fit shrink-0 rounded-full border-2 border-[color:var(--line)] px-2.5 py-1 font-mono text-[0.56rem] font-black uppercase tracking-wide ${
                  rec.severity === "high"
                    ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    : rec.severity === "med"
                      ? "bg-[color:var(--champagne)] text-[color:var(--ink)]"
                      : "bg-[color:var(--cream)] text-[color:var(--mauve)]"
                }`}
              >
                {rec.severity === "high" ? "high impact" : rec.severity === "med" ? "medium" : "next"}
              </span>
              <div>
                <h3 className="text-sm font-bold text-[color:var(--ink)]">{rec.title}</h3>
                <p className="mt-1 text-[0.82rem] font-medium leading-5 text-[color:var(--ink)]">
                  {rec.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="mt-12">
        <h2 className="font-display text-3xl font-semibold tracking-tight">How it runs</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { n: "1", t: "Feature store", b: "Nightly batch turns RSVPs, clicks, tags + quiz into user_features + events.sub_tags, and assigns each member a cohort." },
            { n: "2", t: "Candidate gen", b: "Cheap SQL pre-filter cuts the pool; the logistic model scores survivors with the viewer's cohort weights." },
            { n: "3", t: "Serve + learn", b: "Top candidates surface; impressions log for anti-repeat and as future training labels. The flywheel feeds the monthly retrain." },
          ].map((s) => (
            <li key={s.n} className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5">
              <span className="font-mono text-[0.65rem] font-black uppercase tracking-[0.2em] text-[color:var(--rose)]">
                Stage {s.n}
              </span>
              <h3 className="mt-1 text-lg font-bold text-[color:var(--ink)]">{s.t}</h3>
              <p className="mt-1 text-[0.8rem] font-medium leading-5 text-[color:var(--mauve)]">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  pct: percent,
}: {
  label: string;
  value: string | number;
  sub: string;
  pct?: number;
}) {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm">
      <p className="font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-semibold text-[color:var(--ink)]">{value}</p>
      <p className="mt-0.5 text-[0.68rem] font-medium text-[color:var(--mauve)]">{sub}</p>
      {percent !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--champagne)]">
          <div className="h-full bg-[color:var(--rose)]" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

type Severity = "high" | "med" | "low";
type Recommendation = { title: string; body: string; severity: Severity };

// Turns the live coverage numbers into ranked, concrete improvement actions. The
// whole point: the page tells you what to fix, not just what exists.
function buildRecommendations(
  s: {
    profiles: number;
    with_interests: number;
    with_energy: number;
    with_attendance: number;
    events: number;
    events_tagged: number;
    impressions: number;
    trained_weight_rows: number;
    mutual_clicks: number;
  },
  cohortDist: { cohort_id: string | null; n: number }[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  const interestPct = pct(s.with_interests, s.profiles);
  const taggedPct = pct(s.events_tagged, s.events);
  const energyPct = pct(s.with_energy, s.profiles);
  const top = cohortDist[0];
  const topPct = top ? pct(top.n, s.profiles) : 0;

  if (interestPct < 70) {
    recs.push({
      severity: "high",
      title: `Interest coverage is ${interestPct}% (${s.with_interests}/${s.profiles} members)`,
      body: "interest_overlap is the heaviest weight in every cohort, but most members carry no interest tags - so the model falls back to weaker signals. Make interest selection a required, low-friction onboarding step and re-prompt untagged members.",
    });
  }
  if (taggedPct < 75) {
    recs.push({
      severity: "high",
      title: `Only ${taggedPct}% of events are sub-tagged (${s.events_tagged}/${s.events})`,
      body: "Sub-tags come from event title + description; junk copy (“get smashed”) yields nothing (spec §7.4). Add a description min-length + title-format hints to the merchant event wizard so behavioural sub-tags can actually form.",
    });
  }
  if (s.trained_weight_rows === 0) {
    recs.push({
      severity: "med",
      title: "Weights are hand-curated, not learned",
      body: `No trained rows in cohort_weights yet. Fitting needs ≥ 50 mutual clicks + ≥ 50 curated labels per cohort (you have ${s.mutual_clicks} mutual clicks total). Build the curated-labels admin tool (Stage 6) and start the monthly training job once data clears the bar.`,
    });
  }
  if (s.impressions === 0) {
    recs.push({
      severity: "med",
      title: "No impressions logged - the flywheel isn't turning",
      body: "Every shown candidate + mutual click is a future training label. Flip v2 on (toggle at the top) and call recordImpressions on the serving surfaces so the model has something to learn from.",
    });
  }
  if (energyPct < 50) {
    recs.push({
      severity: "low",
      title: `Persona coverage is ${energyPct}%`,
      body: "energy_match defaults to neutral (0.5) without a Click Persona, so it can't differentiate. Nudge quiz completion - it's a cheap signal that helps the dating cohorts most.",
    });
  }
  if (topPct >= 60 && top) {
    recs.push({
      severity: "low",
      title: `${topPct}% of members are in one cohort (${top.cohort_id})`,
      body: "Per-cohort training needs ~200 examples each; sparse cohorts will borrow a parent prior. Expect most early signal to come from the dominant cohort until the base grows.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      severity: "low",
      title: "Coverage looks healthy",
      body: "Declared + behavioural signals are well populated. Next lever is learned weights - stand up the training pipeline and A/B it against the hand-curated prior.",
    });
  }
  return recs;
}

function Feat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="font-bold text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}

function Rank({ n }: { n: number }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--ink)] text-xs font-black text-[color:var(--champagne)]">
      {n}
    </span>
  );
}

function CandidateCard({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
          {title}
        </h3>
        <span className="font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
          {subtitle}
        </span>
      </div>
      {empty ? (
        <p className="mt-4 text-sm font-medium text-[color:var(--mauve)]">
          No candidates clear the filters for this member (sparse profile or everything already
          seen / joined).
        </p>
      ) : (
        <ol className="mt-4 space-y-2">{children}</ol>
      )}
    </div>
  );
}

function Lever({
  name,
  value,
  body,
  file,
}: {
  name: string;
  value: string;
  body: string;
  file: string;
}) {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm">
      <h3 className="text-sm font-bold text-[color:var(--ink)]">{name}</h3>
      <p className="mt-0.5 font-mono text-[0.62rem] font-black uppercase tracking-wide text-[color:var(--rose)]">
        {value}
      </p>
      <p className="mt-2 text-[0.78rem] font-medium leading-5 text-[color:var(--ink)]">{body}</p>
      <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-wide text-[color:var(--mauve)]">
        {file}
      </p>
    </div>
  );
}
