"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * /business — internal forecasting + reality-check dashboard for the Click
 * founding team. Built off context/BUSINESS_CASE.md. Three scenarios
 * (Worst / Base / Best), the brutal cash math, an honest competitor teardown,
 * and a straight answer on whether to raise VC. Not linked in public nav.
 */

type ScenarioKey = "worst" | "base" | "best";

type Scenario = {
  key: ScenarioKey;
  label: string;
  tag: string;
  blurb: string;
  // 12 monthly MRR points (AUD)
  mrr: number[];
  // operating spend assumption for year 1 (AUD, total) — conditional on funding
  year1Burn: number;
  burnNote: string;
  // exit ARR by year (AUD)
  arr: { y1: number; y2: number; y3: number };
  breakeven: string;
  verdict: string;
};

const SCENARIOS: Record<ScenarioKey, Scenario> = {
  worst: {
    key: "worst",
    label: "Worst case",
    tag: "Bear / it's hard",
    blurb:
      "Merchant gate slips, retention sits below 25%, paid acquisition never beats CAC, PR doesn't land. The team stays lean and unpaid to survive. This is the most common outcome for a first two-sided marketplace.",
    mrr: [80, 250, 500, 900, 1500, 2400, 3400, 4400, 5200, 6200, 7100, 7500],
    year1Burn: 240_000,
    burnNote:
      "Lean survival mode: founders unpaid, no hires, ~$20k/mo. Even then Year 1 burns ~$240k against ~$39k earned.",
    arr: { y1: 90_000, y2: 144_000, y3: 200_000 },
    breakeven: "Month 24+ or never — likely a zombie or a wind-down",
    verdict:
      "Below the doc's own 'bear case'. The honest floor: a small lifestyle business or a graceful shutdown. Not fundable.",
  },
  base: {
    key: "base",
    label: "Base case",
    tag: "The plan as written",
    blurb:
      "Exactly the BUSINESS_CASE.md projection: 35 merchants, 40% month-6 retention, organic + PR working, paid acquisition switched on in Month 4. Everything goes roughly to plan — which itself is optimistic.",
    mrr: [150, 450, 900, 1800, 3000, 4667, 6200, 8000, 10138, 12000, 13600, 15409],
    year1Burn: 475_000,
    burnNote:
      "Full plan burn: $19.5–31.5k/mo (M1–3), $38.5k/mo (M4–6), $47.5k/mo (M7–12). ~$475k for the year — requires raised capital to spend.",
    arr: { y1: 185_000, y2: 480_000, y3: 1_000_000 },
    breakeven: "Month 14 (per the plan), assuming the raise lands",
    verdict:
      "$15.4k MRR at Month 12 = ~$185k ARR. Pitchable for pre-seed, but this is a 'good execution + some luck' line, not the default.",
  },
  best: {
    key: "best",
    label: "Best case",
    tag: "Bull / it catches",
    blurb:
      "A TikTok founder-story breaks out, Time Out + Broadsheet both run it, the launch event sells out and seeds real mutual-clicks, retention beats 45%. The flywheel actually spins and you expand to a second city early.",
    mrr: [300, 800, 1500, 3200, 5500, 8500, 12000, 15000, 18000, 22000, 26000, 30000],
    year1Burn: 475_000,
    burnNote:
      "Same ~$475k spend, but deployed behind a working funnel — you'd raise again mid-year to pour fuel on it.",
    arr: { y1: 360_000, y2: 1_400_000, y3: 3_600_000 },
    breakeven: "Month 11, then you intentionally stay unprofitable to grow",
    verdict:
      "$30k MRR at Month 12 = ~$360k ARR with a real growth curve. THIS is the only scenario where VC is the obviously-right tool.",
  },
};

const STREAMS_M12: Record<ScenarioKey, { label: string; value: number; tone: string }[]> = {
  worst: [
    { label: "Commission (10%)", value: 3800, tone: "var(--peach)" },
    { label: "Merchant subs", value: 2900, tone: "var(--rose)" },
    { label: "Click Plus", value: 500, tone: "var(--rose-soft)" },
    { label: "Promoted", value: 300, tone: "var(--punch)" },
  ],
  base: [
    { label: "Commission (10%)", value: 6750, tone: "var(--peach)" },
    { label: "Merchant subs", value: 6900, tone: "var(--rose)" },
    { label: "Click Plus", value: 779, tone: "var(--rose-soft)" },
    { label: "Promoted", value: 980, tone: "var(--punch)" },
  ],
  best: [
    { label: "Commission (10%)", value: 14000, tone: "var(--peach)" },
    { label: "Merchant subs", value: 11500, tone: "var(--rose)" },
    { label: "Click Plus", value: 2800, tone: "var(--rose-soft)" },
    { label: "Promoted", value: 1700, tone: "var(--punch)" },
  ],
};

const fmt = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    : n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${n}`;

const fmtFull = (n: number) => `$${n.toLocaleString("en-AU")}`;

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

const PROS = [
  {
    title: "A real, documented, painful problem.",
    body: "Sydney 3rd-worst city for making friends; 43% of under-25s chronically lonely; an actual NSW Parliament loneliness inquiry. You're not inventing demand — it exists and it's quantified.",
  },
  {
    title: "Built-in distribution via merchants.",
    body: "Every studio/bar that lists is also a channel — their existing customers see Click. That's the cheapest, highest-trust acquisition you have, and most consumer-social apps don't get it.",
  },
  {
    title: "The 'no chat' angle is genuinely differentiated.",
    body: "It's a real safety + brand wedge, especially for women. It's a clear story journalists can repeat in one sentence — which is most of what early PR needs.",
  },
  {
    title: "The product is already largely built.",
    body: "Events, RSVP, Stripe, admin, onboarding, quiz all exist. You're past the 'can we build it' risk that kills most pre-seed teams — your risk is purely demand and retention.",
  },
  {
    title: "Multiple revenue streams that compound.",
    body: "Commission + merchant subs + Click Plus + promoted placement. If one ramps slowly the others can carry. SaaS subs alone (merchant tiers) can become the steady base.",
  },
];

const THREATS = [
  {
    title: "Cold-start is brutal — and you have TWO sides.",
    body: "No events → no users. No users → merchants churn. The plan's '35 merchants before any user' gate is right, but signing 35 SMBs by hand in 12 weeks is a full-time sales grind with a ~30% conversion at best.",
  },
  {
    title: "Retention is the whole ballgame — and it's unproven.",
    body: "The entire model assumes 40% month-6 retention. Consumer-social retention is usually FAR worse. If users come once and ghost, every revenue line collapses. You have zero data on this yet.",
  },
  {
    title: "The burn vastly outruns the revenue.",
    body: "Year 1 spends ~$475k (plan) to earn ~$76k. On <$50k invested and 3–6 months runway, this is a cliff. Without a raise OR a radical cut to lean mode, the company runs out of cash before Phase 2.",
  },
  {
    title: "Stripe Connect + commission margins are thin.",
    body: "10% of a $45 ticket = $4.50, minus Stripe's 2.9% + $0.30 minus refunds/chargebacks. Real take per booking is closer to $3.50. You need volume the inner-Sydney TAM may not support quickly.",
  },
  {
    title: "Marketplace leakage.",
    body: "Once a user meets a studio through Click, the next booking goes direct — the merchant's incentive is to take the relationship off-platform. Eventbrite/ClassBento have fought this for a decade.",
  },
  {
    title: "Safety / dating-mode liability.",
    body: "The moment you enable dating intent + in-person meetups, one bad incident is an existential PR and legal event. Block/mute/report and policy must ship before, not after.",
  },
  {
    title: "Founder & key-person risk.",
    body: "The developer's IP isn't assigned and they're not formalised. Three first-time founders, no technical co-founder locked, single-city. Investors will price this risk heavily.",
  },
];

const COMPETITORS = [
  {
    name: "Timeleft",
    threat: "Severe",
    what: "VC-backed (France), dinners-with-strangers, already live in Sydney, viral on TikTok. Almost exactly your 'event is the icebreaker, no swiping' thesis — but funded and scaling now.",
    why: "This is the one to worry about. They've validated the exact wedge in your city with far more capital. 'We don't have chat' won't differentiate against them.",
  },
  {
    name: "Meetup",
    threat: "High",
    what: "20-year incumbent, owns 'find a group/event near me', cheap, massive SEO and existing Sydney communities (run clubs, board games, hikes).",
    why: "Free or near-free. Most of your target users already have it installed. You must be visibly better at curation + connection, not just 'Meetup but prettier'.",
  },
  {
    name: "Bumble BFF / Hinge / dating apps",
    threat: "High",
    what: "Deep pockets, the default place people go for both dating and friendship. Bumble BFF is explicitly friendship-matching.",
    why: "They own the intent and the install base. Your counter is 'real-world first, no cold DMs' — a genuine wedge, but you're fighting brands with 100M+ users and huge ad budgets.",
  },
  {
    name: "222 / Pie / We3 (new social)",
    threat: "Medium-High",
    what: "Well-funded US 'meet people through curated events/groups' apps. Same category bet you're making, often with ML matching and real raises.",
    why: "Proves the category is hot (good) and crowded (bad). If any localise to AU, your first-mover claim evaporates. Speed and a data moat are your only defence.",
  },
  {
    name: "Eventbrite / Humanitix / ClassBento / Fever",
    threat: "Medium",
    what: "Own event discovery + ticketing supply. ClassBento especially owns Sydney experiences (pottery, cooking) — your exact merchant categories.",
    why: "Merchants already use them and will resist a second platform taking 10%. They're not selling 'connection', but they own the supply you need and the booking habit.",
  },
  {
    name: "Free alternatives (run clubs, Facebook Groups, churches, hobby meetups)",
    threat: "Underrated",
    what: "$0. Run Club culture is booming in Sydney. Facebook Groups are where 'New to Sydney' people already gather.",
    why: "Your real competition isn't an app — it's free. You must be worth paying for (or worth the friction) versus showing up to a free Saturday run.",
  },
];

export default function BusinessPage() {
  const [active, setActive] = useState<ScenarioKey>("base");
  const s = SCENARIOS[active];

  const year1Revenue = useMemo(() => sum(s.mrr), [s]);
  const netBurn = s.year1Burn - year1Revenue;
  const peakMrr = Math.max(...s.mrr);
  const streams = STREAMS_M12[active];
  const streamTotal = sum(streams.map((x) => x.value));

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 pb-12 pt-14 sm:px-6">
        <div className="relative z-10 mx-auto max-w-6xl">
          {/* This page isn't in any nav — give it an explicit way back to admin
              so it isn't a dead end. */}
          <Link
            href="/admin"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--mauve)] hover:text-[color:var(--ink)]"
          >
            <span aria-hidden>←</span> Back to admin
          </Link>
          <span className="sticker sticker--peach tilt-l-2 flex w-fit">
            <span className="size-2 rounded-full bg-[color:var(--punch)] pulse-ring" />
            Internal · founder reality dashboard
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-light leading-[0.94] tracking-tight sm:text-7xl">
            How much money can <span className="italic"><span className="peach-highlight">Click</span></span> actually make?
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            A straight forecast built off the business case — worst, base, and best.
            Plus the part the deck skips: the cash math, the competitors who are
            already doing this, and whether you three should take VC money at all.
          </p>
          <p className="mt-4 max-w-3xl rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 text-sm font-semibold leading-6 text-[color:var(--ink)] hard-shadow-sm">
            ⚠️ Reality note for first-time founders: every number below is a
            <em> hypothesis</em>, not a forecast. Pre-launch projections are almost
            always wrong. Treat the base case as &ldquo;if we execute well AND get a
            little lucky&rdquo; — not the default.
          </p>
        </div>
      </section>

      {/* Scenario toggle */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Pick a scenario</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => {
              const sc = SCENARIOS[k];
              const isActive = k === active;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActive(k)}
                  className={`rounded-2xl border-2 border-[color:var(--line)] p-5 text-left transition-transform hard-shadow-sm ${
                    isActive
                      ? "bg-[color:var(--ink)] text-[color:var(--champagne)] -translate-y-1 hard-shadow"
                      : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:-translate-y-0.5"
                  }`}
                >
                  <span
                    className={`font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] ${
                      isActive ? "text-[color:var(--peach)]" : "text-[color:var(--punch)]"
                    }`}
                  >
                    {sc.tag}
                  </span>
                  <p className="font-display mt-2 text-2xl font-light leading-tight">
                    {sc.label}
                  </p>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      isActive ? "text-[color:var(--peach)]" : "text-[color:var(--mauve)]"
                    }`}
                  >
                    {fmt(peakMrrFor(k))}/mo by Month 12
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            {s.blurb}
          </p>
        </div>
      </section>

      {/* Headline metrics */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">{s.label} · the numbers</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Month 12 MRR" value={fmt(peakMrr)} sub={`${fmtFull(peakMrr)} / month`} tone="peach" />
            <Metric label="Year 1 revenue (collected)" value={fmt(year1Revenue)} sub="sum of all 12 months" tone="rose" />
            <Metric label="Year 1 spend" value={fmt(s.year1Burn)} sub="operating burn" tone="cream" />
            <Metric label="Year 1 net cash" value={`-${fmt(netBurn)}`} sub="the hole you must fund" tone="ink" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Metric label="Exit ARR · Year 1" value={fmt(s.arr.y1)} sub="annual run-rate" tone="cream" />
            <Metric label="Exit ARR · Year 2" value={fmt(s.arr.y2)} sub="if it keeps growing" tone="cream" />
            <Metric label="Exit ARR · Year 3" value={fmt(s.arr.y3)} sub="the prize (or not)" tone="cream" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--punch)]">
                Break-even
              </p>
              <p className="mt-2 text-base font-bold leading-6 text-[color:var(--ink)]">{s.breakeven}</p>
            </div>
            <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
              <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--punch)]">
                Burn assumption
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{s.burnNote}</p>
            </div>
          </div>
        </div>
      </section>

      {/* MRR ramp chart */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Monthly recurring revenue · {s.label}</p>
          <h2 className="font-display mt-3 text-4xl font-light leading-tight">The 12-month ramp.</h2>
          <div className="mt-8 grid grid-cols-12 items-end gap-1.5 sm:gap-2" style={{ height: 240 }}>
            {s.mrr.map((v, i) => {
              const h = Math.max(4, Math.round((v / peakMrr) * 100));
              return (
                <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
                  <span className="text-[0.55rem] font-bold text-[color:var(--mauve)] sm:text-[0.65rem]">
                    {v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                  </span>
                  <div
                    className="w-full rounded-t-md border-2 border-[color:var(--line)] bg-[color:var(--peach)]"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[0.55rem] font-bold text-[color:var(--ink)] sm:text-[0.65rem]">
                    M{i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Revenue stream mix at Month 12 */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Where Month-12 revenue comes from · {s.label}</p>
          <h2 className="font-display mt-3 text-4xl font-light leading-tight">Four streams, one bar.</h2>
          <div className="mt-8 flex h-12 w-full overflow-hidden rounded-full border-2 border-[color:var(--line)] hard-shadow-sm">
            {streams.map((st) => (
              <div
                key={st.label}
                className="h-full border-r-2 border-[color:var(--line)] last:border-r-0"
                style={{ width: `${(st.value / streamTotal) * 100}%`, background: st.tone }}
                title={`${st.label}: ${fmtFull(st.value)}`}
              />
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {streams.map((st) => (
              <div key={st.label} className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 hard-shadow-sm">
                <span className="inline-block size-3 rounded-full border border-[color:var(--line)]" style={{ background: st.tone }} />
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)]">{st.label}</p>
                <p className="font-display mt-1 text-2xl font-light">{fmtFull(st.value)}</p>
                <p className="text-xs font-semibold text-[color:var(--mauve)]">
                  {Math.round((st.value / streamTotal) * 100)}% of MRR
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            Note: merchant subscriptions (recurring SaaS) and commission are the
            backbone. Click Plus and promoted placement are real but small for
            years — don&apos;t bet the company on consumer subscriptions converting.
          </p>
        </div>
      </section>

      {/* THE CASH MATH — the part the deck skips */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-14 text-[color:var(--on-deep)] sm:px-6">
        <div className="mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-r-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--punch)]" />
            Read this part twice
          </span>
          <h2 className="font-display mt-6 text-4xl font-light leading-tight sm:text-5xl">
            The cash math is the whole story.
          </h2>
          <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-[color:var(--peach)]">
            In <strong>every</strong> scenario, Year 1 spends far more than it earns.
            That is normal for marketplaces — but it means the business cannot exist
            on your current ~$50k and 3–6 month runway. The only questions are how big
            the hole is and how you fund it.
          </p>

          {/* Mobile (< md): stacked scenario cards instead of a 640px table. */}
          <div className="mt-8 grid gap-3 md:hidden">
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => {
              const sc = SCENARIOS[k];
              const rev = sum(sc.mrr);
              return (
                <div
                  key={k}
                  className={`rounded-2xl border-2 border-[color:var(--champagne)]/30 p-4 ${
                    k === active ? "bg-[color:var(--surface-deep)]/60" : "bg-[color:var(--surface-deep)]/20"
                  }`}
                >
                  <p className="font-bold text-[color:var(--champagne)]">{sc.label}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-[color:var(--peach)]/80">Yr-1 revenue</dt>
                    <dd className="text-right font-bold text-[color:var(--champagne)]">{fmt(rev)}</dd>
                    <dt className="text-[color:var(--peach)]/80">Yr-1 spend</dt>
                    <dd className="text-right font-bold text-[color:var(--champagne)]">{fmt(sc.year1Burn)}</dd>
                    <dt className="text-[color:var(--peach)]/80">Net cash hole</dt>
                    <dd className="text-right font-bold text-[color:var(--rose)]">-{fmt(sc.year1Burn - rev)}</dd>
                  </dl>
                  <p className="mt-3 text-sm text-[color:var(--champagne)]/80">{sc.breakeven}</p>
                </div>
              );
            })}
          </div>

          {/* Desktop (md+): full comparison table. */}
          <div className="mt-8 hidden overflow-x-auto rounded-2xl border-2 border-[color:var(--champagne)]/30 md:block">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[color:var(--surface-deep)] text-[color:var(--peach)]">
                  <th className="p-3 font-mono text-xs uppercase tracking-wider">Scenario</th>
                  <th className="p-3 font-mono text-xs uppercase tracking-wider">Yr-1 revenue</th>
                  <th className="p-3 font-mono text-xs uppercase tracking-wider">Yr-1 spend</th>
                  <th className="p-3 font-mono text-xs uppercase tracking-wider">Net cash hole</th>
                  <th className="p-3 font-mono text-xs uppercase tracking-wider">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => {
                  const sc = SCENARIOS[k];
                  const rev = sum(sc.mrr);
                  return (
                    <tr
                      key={k}
                      className={`border-t-2 border-[color:var(--champagne)]/20 ${
                        k === active ? "bg-[color:var(--surface-deep)]/60" : ""
                      }`}
                    >
                      <td className="p-3 font-bold">{sc.label}</td>
                      <td className="p-3">{fmt(rev)}</td>
                      <td className="p-3">{fmt(sc.year1Burn)}</td>
                      <td className="p-3 font-bold text-[color:var(--rose)]">-{fmt(sc.year1Burn - rev)}</td>
                      <td className="p-3 text-[color:var(--champagne)]/80">{sc.breakeven}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <DeepCard title="Option A — Raise it" body="Pre-seed $150–400k buys ~18 months. Standard path, but you sell 15–25% and sign up to grow 10× or die. Hard to land pre-revenue with no retention data." />
            <DeepCard title="Option B — Stay lean" body="Founders unpaid, no hires, ~$5k/mo. Survive on grants (NSW MVP $25k) + early revenue. Slower, but you keep 100% and buy time to PROVE retention before raising." />
            <DeepCard title="Option C — Hybrid (recommended)" body="Bridge $30–80k F&F + the NSW grant, run lean for 6 months, hit one number: 40% month-6 retention. THEN raise from strength — or realise it's a lifestyle business and that's fine." />
          </div>
        </div>
      </section>

      {/* PROS */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Why this could genuinely work</p>
          <h2 className="font-display mt-3 text-4xl font-light leading-tight">The real strengths.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PROS.map((p) => (
              <div key={p.title} className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
                <span className="block h-2 w-12 rounded-full bg-[color:var(--peach)]" />
                <h3 className="font-display mt-4 text-2xl font-light leading-tight">{p.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THREATS */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">The threats nobody on the team wants to say out loud</p>
          <h2 className="font-display mt-3 text-4xl font-light leading-tight">What actually kills this.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {THREATS.map((t, i) => (
              <div key={t.title} className="flex gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--punch)] text-sm font-bold text-[color:var(--cream)]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-light leading-tight">{t.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPETITORS */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow">Be honest about who you&apos;re up against</p>
          <h2 className="font-display mt-3 text-4xl font-light leading-tight">You are not first. You are not alone.</h2>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            The deck says &ldquo;a new category&rdquo;. It isn&apos;t. &ldquo;Meet people through
            shared real-world events, no swiping&rdquo; is a crowded, funded bet right now.
            Knowing that is a strength — it tells you where to be faster and sharper.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {COMPETITORS.map((c) => (
              <div key={c.name} className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-6 hard-shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-2xl font-light leading-tight">{c.name}</h3>
                  <span
                    className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                      c.threat.startsWith("Severe")
                        ? "bg-[color:var(--punch)] text-[color:var(--cream)]"
                        : c.threat.startsWith("High")
                          ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                          : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                    }`}
                  >
                    {c.threat}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--ink)]">{c.what}</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                  <span className="font-bold text-[color:var(--punch)]">Why it matters: </span>
                  {c.why}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE VC QUESTION */}
      <section className="border-b-2 border-[color:var(--line)] bg-[color:var(--ink)] px-4 py-16 text-[color:var(--on-deep)] sm:px-6">
        <div className="mx-auto max-w-5xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--punch)]" />
            The real question
          </span>
          <h2 className="font-display mt-6 text-4xl font-light leading-tight sm:text-6xl">
            Should you take VC money?
          </h2>
          <p className="mt-6 text-lg font-medium leading-8 text-[color:var(--peach)]">
            Short answer: <strong>not yet — and maybe not ever, and that&apos;s okay.</strong>
          </p>

          <div className="mt-8 space-y-5 text-base font-medium leading-7 text-[color:var(--champagne)]/90">
            <p>
              VC is not a prize or free money. It&apos;s rocket fuel you bolt onto a
              business that has <em>already proven it grows</em>. You light it before
              the rocket is built and you just blow up faster. Right now you have a
              built product and zero proof that users come back. That&apos;s the wrong
              moment to raise.
            </p>
            <p>
              Taking VC also means signing a contract: grow ~3× a year, every year,
              or you&apos;re a write-off. It means a board, dilution (you&apos;ll likely give
              up 20%+ across pre-seed + seed), and the pressure to chase scale over
              sustainability. For a friendship app in one city, that pressure can push
              you into bad decisions (premature paid spend, expanding before
              retention works).
            </p>
            <p className="rounded-2xl border-2 border-[color:var(--champagne)]/40 bg-[color:var(--surface-deep)] p-5 text-[color:var(--peach)]">
              The one number that decides everything: <strong>month-6 retention.</strong>
              If 40%+ of users are still active at month 6, you have a venture-scale
              business and VC becomes the right tool. If it&apos;s 10–15% (the common
              reality), no amount of funding fixes it — and you&apos;ll have given away a
              chunk of a company that was never going to be venture-sized.
            </p>
          </div>

          <h3 className="font-display mt-10 text-2xl font-light text-[color:var(--peach)]">
            A decision rule you can actually use
          </h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <RuleCard
              when="Do this NOW"
              tone="peach"
              items={[
                "Take the free money: NSW MVP grant (up to $25k, non-dilutive).",
                "Raise a tiny F&F bridge ($30–80k) on a SAFE — friends, not funds.",
                "Run brutally lean: founders unpaid, no hires, ~$5k/mo.",
                "Formalise the developer + IP assignment THIS week.",
              ]}
            />
            <RuleCard
              when="Only raise pre-seed IF"
              tone="rose"
              items={[
                "Month-6 retention ≥ 35–40% on real users.",
                "First-RSVP conversion > 25%, onboarding completion > 60%.",
                "35+ active merchants, 15+ events/week, repeat bookings.",
                "You actually WANT a 7-year, venture-scale grind.",
              ]}
            />
            <RuleCard
              when="Walk away from VC if"
              tone="ink"
              items={[
                "Retention stalls below ~20% after honest effort.",
                "You&apos;d rather a profitable $300k–1M/yr business you own 100%.",
                "Terms are punitive (sub-$2M cap, heavy control).",
                "The only reason to raise is to pay yourselves salaries.",
              ]}
            />
          </div>

          <p className="mt-10 text-base font-medium leading-7 text-[color:var(--champagne)]/90">
            <strong className="text-[color:var(--peach)]">Bottom line for three first-time founders:</strong>{" "}
            Don&apos;t fundraise to validate the idea — validate the idea, then decide if
            you even want to fundraise. The cheapest, smartest 6 months you can spend
            is proving retention on grant + bridge money. If it works, investors will
            chase you and your terms will be better. If it doesn&apos;t, you&apos;ll have
            lost months instead of years — and you won&apos;t owe a board an explanation.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Back to admin
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              How the product works
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--champagne)] px-4 py-8 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs font-semibold leading-6 text-[color:var(--mauve)]">
          Source: <code>context/BUSINESS_CASE.md</code>. Worst/best cases are
          modelled scenarios, not commitments. Figures are AUD, pre-tax, and assume
          the launch gate (35 merchants) is met. Internal planning only — do not put
          these numbers in an investor deck without sensitising the assumptions.
        </p>
      </section>
    </main>
  );
}

function peakMrrFor(k: ScenarioKey) {
  const m = SCENARIOS[k].mrr;
  return m[m.length - 1];
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "peach" | "rose" | "cream" | "ink" }) {
  const palette =
    tone === "rose"
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : tone === "cream"
        ? "bg-[color:var(--cream)] text-[color:var(--ink)]"
        : tone === "ink"
          ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
          : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  return (
    <article className={`rounded-2xl border-2 border-[color:var(--line)] ${palette} hard-shadow-sm p-5`}>
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="font-display mt-2 text-4xl font-light leading-none sm:text-5xl">{value}</p>
      <p className="mt-2 text-xs font-semibold opacity-75">{sub}</p>
    </article>
  );
}

function DeepCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--champagne)]/40 bg-[color:var(--surface-deep)] p-5">
      <h3 className="font-display text-xl font-light text-[color:var(--peach)]">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--champagne)]/85">{body}</p>
    </div>
  );
}

function RuleCard({ when, items, tone }: { when: string; items: string[]; tone: "peach" | "rose" | "ink" }) {
  const head =
    tone === "rose"
      ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
      : tone === "ink"
        ? "bg-[color:var(--champagne)] text-[color:var(--ink)]"
        : "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  return (
    <div className="rounded-2xl border-2 border-[color:var(--champagne)]/40 bg-[color:var(--surface-deep)] p-5">
      <span className={`inline-block rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${head}`}>
        {when}
      </span>
      <ul className="mt-4 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-sm font-medium leading-6 text-[color:var(--champagne)]/90">
            <span className="text-[color:var(--peach)]">→</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
