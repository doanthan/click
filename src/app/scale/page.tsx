import { LinkButton, MetricCard, Pill, SectionIntro } from "@/components/click-ui";

export const metadata = {
  title: "Scale | Click",
  description:
    "How Click's architecture behaves at 100 merchants and 2000 browsers, the bottlenecks in the order they hit, and the road to running in Saigon, Sydney, and London.",
};

// ---------------------------------------------------------------------------
// Static capacity-planning content. No DB reads — numbers and diagrams live
// here and are updated by editing this file. Mirrors the page conventions in
// src/app/categories/page.tsx.
// ---------------------------------------------------------------------------

const todaySnapshot = [
  { label: "Regions", value: "1", tone: "ink" as const },
  { label: "DB pool / instance", value: "5", tone: "rose" as const },
  { label: "Primaries", value: "1", tone: "peach" as const },
  { label: "Target regions", value: "3", tone: "cream" as const },
];

// The flow diagram: each hop with what it does today and its ceiling.
const stack = [
  {
    step: "Browser",
    detail: "Visitor / attendee sessions",
    limit: "~2000 of these, bursty",
  },
  {
    step: "Vercel (Next 16)",
    detail: "Serverless fns + App Router pages",
    limit: "Single region today",
  },
  {
    step: "pg pool",
    detail: "Raw node-postgres, src/lib/postgres.ts",
    limit: "max: 5 per instance",
  },
  {
    step: "Supabase Postgres",
    detail: "16 tables, JWT auth (no session table)",
    limit: "1 primary, 1 region",
  },
];

// Rough back-of-envelope load at the asked-for scale.
const workload = [
  { metric: "Merchants (event hosts)", value: "100", note: "5–20 live events each → ~1k events" },
  { metric: "Browsers (visitor sessions)", value: "2,000", note: "peak concurrent, not total" },
  { metric: "Peak requests/sec", value: "~30–60", note: "reads dominate (explore, detail)" },
  { metric: "Click writes/sec", value: "~5–15", note: "1–3 rows per click txn" },
  { metric: "Largest table", value: "user_clicks", note: "100k–10M rows as it matures" },
  { metric: "Verdict", value: "Reachable", note: "config + caching, not a rewrite" },
];

// Bottlenecks ranked by the order they actually bite.
const walls = [
  {
    eyebrow: "Wall #1 · hits first",
    title: "Serverless connection fan-out",
    body:
      "We already point DATABASE_URL at Supabase's transaction-mode pooler (PgBouncer, port 6543), so the Postgres-side connections are multiplexed. The remaining limit is the client side: src/lib/postgres.ts opens max: 5 per serverless instance, and Vercel fans out to many instances — enough cold instances and you still saturate the pooler's client slots.",
    fix: "Cap serverless concurrency and right-size the per-instance max against the pooler's client limit. The pooler itself is already in place — this is tuning, not a rearchitecture.",
    accent: "rose" as const,
  },
  {
    eyebrow: "Wall #2",
    title: "No read caching",
    body:
      "getEventsForExplore and getEventCategories re-aggregate every request — count + array_agg over events × tags, with an unfiltered tags join. Every page view pays full freight.",
    fix: "Cache the explore/categories aggregations (unstable_cache or Vercel KV, ~5–10 min TTL), or build a materialized view refreshed by the hourly cron.",
    accent: "peach" as const,
  },
  {
    eyebrow: "Wall #3",
    title: "Synchronous click writes",
    body:
      "POST /api/clicks runs one transaction per click; on a mutual it joins events × event_tags × user_tags to suggest an event, filtered only by status and start time.",
    fix: "Add a composite index covering the suggestion query. If click rate spikes past the pool, move writes to a queue with a batch writer.",
    accent: "ink" as const,
  },
  {
    eyebrow: "Wall #4",
    title: "Unbounded result sets",
    body:
      "Admin and list queries pull fixed top-N rows with no cursor. Fine at 1k events, painful as tables grow into the millions.",
    fix: "Add cursor-based pagination to the admin and listing read paths.",
    accent: "cream" as const,
  },
  {
    eyebrow: "Wall #5",
    title: "Capacity lock contention",
    body:
      "Event registration takes a `for update` row lock to enforce capacity, so concurrent RSVPs to a hot event serialize.",
    fix: "Track a counter column or use advisory locks so registrations don't queue behind one exclusive lock.",
    accent: "rose" as const,
  },
  {
    eyebrow: "Wall #6 · scales with content, not load",
    title: "Double-metered image pipeline",
    body:
      "Every event + avatar is an image, served Supabase Storage → Vercel Image Optimization → browser. That's two metered layers: Supabase egress (~$0.09/GB past the cap) and Vercel per-transform billing ($5/1k source images). The optimizer is largely redundant — avatar-storage.ts and event-image-storage.ts already pre-size with sharp (512² / 1600²), so we pay to re-optimize what's already optimized.",
    fix: "Move public media to Cloudflare R2 (zero egress) behind the Cloudflare CDN, serve the pre-sized objects directly, and set unoptimized on those <Image>s to drop the Vercel transform bill to ~$0. The helpers already hide the backend, so the swap is contained.",
    accent: "peach" as const,
  },
];

// Tiered roadmap.
const tiers = [
  {
    tier: "Tier 0",
    when: "Today",
    headline: "Single region, pool of 5",
    moves: [
      "Works for a demo / early beta",
      "Falls over under concurrent load",
      "Every read re-aggregates",
    ],
  },
  {
    tier: "Tier 1",
    when: "100 merchants · 2000 browsers",
    headline: "Pooler + read cache",
    moves: [
      "Tune serverless concurrency against the pooler",
      "Cache explore/categories aggregations",
      "Add the click-suggestion index",
      "Move public media to R2 + bypass Vercel optimization",
    ],
  },
  {
    tier: "Tier 2",
    when: "~10× from there",
    headline: "Queue writes, paginate, replicate",
    moves: [
      "Queue + batch the click write path",
      "Cursor pagination everywhere",
      "Add the first read replica (see below)",
    ],
  },
];

// Per-tier load — the numbers each tier carries. Columns mirror the cost
// tiers (Tier 0 / Tier 1 / Tier 2+) so the two tables read as a pair.
const tierNumbers = [
  { metric: "Merchants (event hosts)", t0: "1–10", t1: "100", t2: "~1,000" },
  { metric: "Live events", t0: "10–50", t1: "~1,000", t2: "~10,000" },
  { metric: "Peak concurrent browsers", t0: "~50", t1: "2,000", t2: "~20,000" },
  { metric: "Peak requests/sec", t0: "~2–5", t1: "~30–60", t2: "~300–600" },
  { metric: "Click writes/sec", t0: "<1", t1: "~5–15", t2: "~50–150" },
  { metric: "user_clicks rows", t0: "<100k", t1: "100k–1M", t2: "10M+" },
  { metric: "DB topology", t0: "Pool of 5", t1: "Pooler (PgBouncer)", t2: "Primary + 2 replicas" },
  { metric: "Regions", t0: "1", t1: "1", t2: "3" },
];

// Multi-region rollout.
const regions = [
  { city: "Sydney", role: "Write primary", code: "ap-southeast-2 · syd1", note: "Product is Sydney-first — home the primary here" },
  { city: "Saigon", role: "Read replica", code: "ap-southeast-1 (Singapore)", note: "Nearest low-latency region to Vietnam" },
  { city: "London", role: "Read replica", code: "eu-west-2 · lhr1", note: "Serves European reads" },
];

const phases = [
  {
    phase: "Phase 1",
    title: "Stay single-region, get fast",
    body: "Ship the pooler and read cache. This alone covers the 100 / 2000 target — no replicas yet.",
  },
  {
    phase: "Phase 2",
    title: "One read replica + region-aware reads",
    body: "Add a Supabase read replica; route reads to the nearest replica, writes to the Sydney primary. Handle replica lag with read-after-write stickiness (serve a user their own recent writes from the primary).",
  },
  {
    phase: "Phase 3",
    title: "Full three-region with failover",
    body: "Replicas live in Saigon and London; Vercel functions deploy multi-region and route to the closest healthy replica, with health-checked failover.",
  },
];

// Monthly infra cost per tier (USD, early 2026 — planning ranges, not quotes).
// Stripe is excluded here: it's per-transaction, modelled as a take-rate below.
const costTiers = [
  {
    tier: "Tier 0",
    when: "Today · beta",
    total: "~$0–20",
    lines: [
      { svc: "Vercel", plan: "Hobby / Pro", cost: "$0–20" },
      { svc: "Supabase", plan: "Free", cost: "$0" },
      { svc: "Media", plan: "Supabase Storage (free tier)", cost: "$0" },
      { svc: "Mapbox", plan: "Free tier", cost: "$0" },
      { svc: "Stripe", plan: "Pay-as-you-go", cost: "per-txn" },
    ],
    caveat: "Free Supabase pauses after 7 days idle, no daily backups. Vercel Hobby bans commercial use — you're off it the moment you take real payments.",
    accent: "mauve" as const,
  },
  {
    tier: "Tier 1",
    when: "100 merchants · 2000 browsers",
    total: "~$140–400",
    lines: [
      { svc: "Vercel", plan: "Pro + usage", cost: "$20–60" },
      { svc: "Supabase", plan: "Pro base", cost: "$25" },
      { svc: "Supabase", plan: "Small/Medium compute", cost: "$15–60" },
      { svc: "Media", plan: "Storage egress + Vercel image transforms", cost: "$20–150" },
      { svc: "Mapbox", plan: "Pay-as-you-go", cost: "$0–250" },
    ],
    caveat: "The pooler is already on Pro (Wall #1). Two swing factors: Mapbox (map loads + search sessions), and the double-metered image pipeline (Wall #6) — moving public media to R2 + bypassing Vercel optimization collapses that media line to ~$1–10.",
    accent: "rose" as const,
  },
  {
    tier: "Tier 2+",
    when: "Three regions",
    total: "~$420–1,500",
    lines: [
      { svc: "Vercel", plan: "Pro (Enterprise for multi-region fns)", cost: "$20–60+" },
      { svc: "Supabase", plan: "Pro + Medium/Large primary", cost: "$85–135" },
      { svc: "Supabase", plan: "2× read replicas", cost: "$30–220" },
      { svc: "Media", plan: "R2 (zero egress) + Cloudflare CDN", cost: "$5–30" },
      { svc: "Mapbox", plan: "Scaled traffic", cost: "$250–1k+" },
    ],
    caveat: "Each read replica is billed as its own compute instance, sized to the primary. The costly jump is Vercel Enterprise for multi-region functions — not the replicas. Note media barely moves once it's on R2: zero egress means image bandwidth no longer scales the bill.",
    accent: "peach" as const,
  },
];

// The two cost axes that don't behave like fixed infra.
const costAxes = [
  {
    title: "Mapbox — your biggest variable",
    body:
      "Two metered APIs: map loads (GL JS) free to 50k/mo then ~$5/1k, and search sessions free to ~100k/mo. 2,000 daily sessions each loading the /discover map = ~60k loads/mo — already over the free tier. Mitigate: lazy-mount the map, use static map images on cards, and debounce autocomplete to consolidate sessions.",
  },
  {
    title: "Stripe — scales with GMV, not load",
    body:
      "No base fee. ~1.75% + A$0.30 domestic (2.9%+ international cards). Connect adds ~0.25% + payout fees and ~$2/active connected account. Model it as a ~2–3.5% take-rate out of transaction revenue, not fixed overhead.",
  },
  {
    title: "Images — the double-metered line (fixable)",
    body:
      "Public media is served Supabase Storage → Vercel Image Optimization → browser, so it's billed twice: Supabase egress (~$0.09/GB past the cap) and Vercel per-transform ($5/1k source images). For an all-unique-images marketplace this grows with content, not traffic, and can rival the DB bill. We already pre-size with sharp, so the fix is cheap: move media to Cloudflare R2 (storage $0.015/GB, zero egress) behind the Cloudflare CDN and serve pre-sized objects directly — the helpers already abstract the backend. The app was on R2 before, so the surface is known.",
  },
];

const suggestions = [
  "Tune serverless concurrency against the Supabase pooler",
  "Cache explore + categories reads (5–10 min)",
  "Index the click-suggestion join",
  "Move public media to Cloudflare R2 + serve pre-sized (bypass Vercel image optimization)",
  "Add read-after-write stickiness before any replica",
  "Cursor-paginate admin & list queries",
  "Queue + batch click writes when they outpace the pool",
  "Add Sydney-primary read replicas region by region",
];

export default function ScalePage() {
  return (
    <main className="paper-noise min-h-screen overflow-hidden text-[color:var(--ink)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[color:var(--champagne)] px-4 pb-12 pt-16 sm:px-6 lg:pt-20">
        <div className="relative z-10 mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            Architecture · capacity plan
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-bold leading-[0.94] tracking-[-0.025em] sm:text-7xl">
            How Click{" "}
            <span className="text-[color:var(--coral)]">scales</span>
            .
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            A look at the real stack at <strong>100 merchants</strong> and{" "}
            <strong>2000 browsers</strong> — where it bends, what to fix in which
            order, and the road to running in Saigon, Sydney, and London. Merchant ={" "}
            event host. Browser = a visitor session generating clicks.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {todaySnapshot.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} tone={m.tone} />
            ))}
          </div>
        </div>
      </section>

      {/* What runs today */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="What runs today"
            title="One region, one primary."
            body="Next.js 16 on Vercel serverless talks to a single Supabase Postgres through a raw node-postgres pool. NextAuth runs JWT sessions, so there's no session table to scale. An hourly Vercel cron does cleanup."
          />

          {/* Flow diagram */}
          <div className="mt-10 grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {stack.map((node, i) => (
              <div key={node.step} className="contents">
                <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
                  <p className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
                    {node.step}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                    {node.detail}
                  </p>
                  <p className="mt-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:var(--rose)]">
                    {node.limit}
                  </p>
                </div>
                {i < stack.length - 1 ? (
                  <div
                    className="flex items-center justify-center text-2xl font-black text-[color:var(--ink)] lg:px-1"
                    aria-hidden
                  >
                    <span className="hidden lg:inline">→</span>
                    <span className="lg:hidden">↓</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            Cron · POST /api/bsc/cleanup runs hourly
          </p>
        </div>
      </section>

      {/* Workload at target scale */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="The workload"
            title="100 merchants, 2000 browsers."
            body="Translated into load: reads dominate, click writes are modest, and the heaviest table is user_clicks. None of this is a rewrite — it's a connection-pooling and caching problem."
          />

          <div className="mt-10 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] hard-shadow-sm">
            {workload.map((row, i) => (
              <div
                key={row.metric}
                className={`grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[1.2fr_0.6fr_1.4fr] sm:items-baseline ${
                  i % 2 === 0 ? "bg-[color:var(--cream)]" : "bg-[color:var(--champagne)]"
                } ${i > 0 ? "border-t-2 border-dashed border-[color:var(--line)]" : ""}`}
              >
                <p className="text-sm font-bold text-[color:var(--ink)]">{row.metric}</p>
                <p className="font-display text-2xl font-semibold leading-none tracking-[-0.02em] text-[color:var(--rose)]">
                  {row.value}
                </p>
                <p className="text-sm font-medium leading-6 text-[color:var(--mauve)]">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The walls */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Bottlenecks"
            title="The walls, in order."
            body="These are the limits in the real code, ranked by which one bites first. Each has a one-line fix — clear them top to bottom."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {walls.map((wall) => (
              <div
                key={wall.title}
                className="group relative flex flex-col rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg] hover:hard-shadow"
              >
                <span
                  className={`block h-2 w-14 rounded-full ${
                    wall.accent === "rose"
                      ? "bg-[color:var(--rose)]"
                      : wall.accent === "ink"
                        ? "bg-[color:var(--ink)]"
                        : wall.accent === "cream"
                          ? "bg-[color:var(--punch)]"
                          : "bg-[color:var(--peach)]"
                  }`}
                />
                <p className="eyebrow mt-5">{wall.eyebrow}</p>
                <h3 className="font-display mt-3 text-3xl font-semibold leading-[1.04] tracking-[-0.02em] text-[color:var(--ink)]">
                  {wall.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {wall.body}
                </p>
                <div className="mt-4 rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--ink)]">
                    Fix
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[color:var(--ink)]">
                    {wall.fix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scaling tiers */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Roadmap"
            title="Three tiers."
            body="Today, the asked-for target, and ~10× beyond it. Each tier is a short list of concrete moves."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {tiers.map((t, i) => (
              <div
                key={t.tier}
                className="flex flex-col rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-3 py-1 text-[0.7rem] font-black uppercase tracking-wider text-[color:var(--champagne)]">
                    {t.tier}
                  </span>
                  <span
                    className={`block size-3 rounded-full ${
                      i === 0
                        ? "bg-[color:var(--mauve)]"
                        : i === 1
                          ? "bg-[color:var(--rose)]"
                          : "bg-[color:var(--peach)]"
                    }`}
                    aria-hidden
                  />
                </div>
                <p className="mt-4 font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {t.when}
                </p>
                <h3 className="font-display mt-2 text-2xl font-semibold leading-[1.06] tracking-[-0.02em] text-[color:var(--ink)]">
                  {t.headline}
                </h3>
                <ul className="mt-4 grid gap-2">
                  {t.moves.map((move) => (
                    <li
                      key={move}
                      className="flex gap-2 text-sm font-medium leading-6 text-[color:var(--mauve)]"
                    >
                      <span className="text-[color:var(--rose)]" aria-hidden>
                        ✷
                      </span>
                      {move}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* By the numbers — per-tier load */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="By the numbers"
            title="What each tier carries."
            body="The same three tiers as the bill, but in load instead of dollars — merchants, events, traffic, and where the database sits. Tier 1 is the asked-for target; Tier 2+ is roughly 10× beyond it."
          />

          {/* Header row */}
          <div className="mt-10 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] hard-shadow-sm">
            <div className="grid grid-cols-[1.4fr_repeat(3,0.9fr)] items-stretch bg-[color:var(--ink)] text-[color:var(--champagne)]">
              <div className="px-4 py-3 text-[0.7rem] font-black uppercase tracking-[0.14em]">
                Metric
              </div>
              {[
                { tier: "Tier 0", when: "Today", dot: "bg-[color:var(--mauve)]" },
                { tier: "Tier 1", when: "Target", dot: "bg-[color:var(--rose)]" },
                { tier: "Tier 2+", when: "~10×", dot: "bg-[color:var(--peach)]" },
              ].map((h) => (
                <div
                  key={h.tier}
                  className="flex flex-col gap-0.5 border-l-2 border-[color:var(--champagne)]/25 px-4 py-3"
                >
                  <span className="flex items-center gap-1.5 text-[0.7rem] font-black uppercase tracking-wider">
                    <span className={`block size-2 rounded-full ${h.dot}`} aria-hidden />
                    {h.tier}
                  </span>
                  <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[color:var(--champagne)]/70">
                    {h.when}
                  </span>
                </div>
              ))}
            </div>

            {tierNumbers.map((row, i) => (
              <div
                key={row.metric}
                className={`grid grid-cols-[1.4fr_repeat(3,0.9fr)] items-center ${
                  i % 2 === 0 ? "bg-[color:var(--champagne)]" : "bg-[color:var(--cream)]"
                } border-t-2 border-dashed border-[color:var(--line)]`}
              >
                <div className="px-4 py-3 text-sm font-bold text-[color:var(--ink)]">
                  {row.metric}
                </div>
                {[row.t0, row.t1, row.t2].map((val, j) => (
                  <div
                    key={j}
                    className={`border-l-2 border-dashed border-[color:var(--line)] px-4 py-3 font-mono text-[0.8rem] font-bold ${
                      j === 1 ? "text-[color:var(--rose)]" : "text-[color:var(--ink)]"
                    }`}
                  >
                    {val}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            Browsers = peak concurrent visitor sessions, not total signups
          </p>
        </div>
      </section>

      {/* Multi-region */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Saigon · Sydney · London"
            title="One primary, replicas near readers."
            body="Recommended path: keep a single write primary in Sydney and add read replicas where the readers are. Reads go to the nearest replica; writes always go to the primary. This avoids the latency and migration cost of a true multi-primary database — defer Neon / CockroachDB / Yugabyte until cross-region write latency genuinely hurts."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {regions.map((r) => (
              <div
                key={r.city}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-3xl font-semibold leading-none tracking-[-0.02em] text-[color:var(--ink)]">
                    {r.city}
                  </h3>
                  <span
                    className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.62rem] font-black uppercase tracking-wider ${
                      r.role === "Write primary"
                        ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                        : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                    }`}
                  >
                    {r.role}
                  </span>
                </div>
                <p className="mt-4 font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                  {r.code}
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {r.note}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {phases.map((p) => (
              <div
                key={p.phase}
                className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-6"
              >
                <p className="eyebrow">{p.phase}</p>
                <h4 className="font-display mt-2 text-xl font-semibold leading-snug tracking-[-0.02em] text-[color:var(--ink)]">
                  {p.title}
                </h4>
                <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it costs */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="What it costs"
            title="The bill, per tier."
            body="Monthly infra in USD (early 2026 — planning ranges, not quotes). Stripe is excluded here because it's per-transaction; it and Mapbox are the two costs that don't behave like fixed infra, called out below."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {costTiers.map((t) => (
              <div
                key={t.tier}
                className="flex flex-col rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-3 py-1 text-[0.7rem] font-black uppercase tracking-wider text-[color:var(--champagne)]">
                    {t.tier}
                  </span>
                  <span
                    className={`block size-3 rounded-full ${
                      t.accent === "mauve"
                        ? "bg-[color:var(--mauve)]"
                        : t.accent === "rose"
                          ? "bg-[color:var(--rose)]"
                          : "bg-[color:var(--peach)]"
                    }`}
                    aria-hidden
                  />
                </div>
                <p className="mt-4 font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {t.when}
                </p>
                <p className="font-display mt-2 text-4xl font-bold leading-none tracking-[-0.025em] text-[color:var(--rose)]">
                  {t.total}
                  <span className="ml-1 align-baseline text-base text-[color:var(--mauve)]">/mo</span>
                </p>

                <dl className="mt-5 grid gap-2">
                  {t.lines.map((l, j) => (
                    <div
                      key={`${l.svc}-${j}`}
                      className="flex items-baseline justify-between gap-3 border-b border-dashed border-[color:var(--line)] pb-2 text-sm"
                    >
                      <dt className="font-medium leading-6 text-[color:var(--mauve)]">
                        <span className="font-bold text-[color:var(--ink)]">{l.svc}</span> · {l.plan}
                      </dt>
                      <dd className="shrink-0 font-mono text-[0.8rem] font-bold text-[color:var(--ink)]">
                        {l.cost}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-[0.8rem] font-medium leading-5 text-[color:var(--mauve)]">
                  {t.caveat}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {costAxes.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-6"
              >
                <h4 className="font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-[color:var(--ink)]">
                  {a.title}
                </h4>
                <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  {a.body}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
            Stripe ≈ 2–3.5% take-rate on GMV · billed out of transaction revenue, not infra
          </p>
        </div>
      </section>

      {/* Suggestions / next steps */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Do this next"
            title="The short list."
            body="In priority order. The first four clear the way to the 100 / 2000 target — the R2 move also cuts the fastest-growing cost line; the rest carry you to multi-region."
          />

          <ol className="mt-10 grid gap-3">
            {suggestions.map((s, i) => (
              <li
                key={s}
                className="flex items-center gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-4 hard-shadow-sm"
              >
                <span className="font-display flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] text-lg font-semibold text-[color:var(--surface-deep)]">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold leading-6 text-[color:var(--ink)] sm:text-base">
                  {s}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Pill tone="rose">Config &amp; caching first</Pill>
            <Pill tone="peach">Replicas later</Pill>
            <Pill tone="ink">Sydney-primary</Pill>
            <LinkButton href="/tables" variant="secondary">
              See the live schema
            </LinkButton>
          </div>
        </div>
      </section>
    </main>
  );
}
