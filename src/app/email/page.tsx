// Email previews — a dev gallery of every Click transactional email rendered
// with realistic mock data from `database/002_seed.sql` personas. Public
// (matches `/test` and `/tables`); noindex because it's a dev tool. No DB
// queries — fixtures are static so the page works without Postgres up.
//
// URL: /email?scenario=<id>. The sidebar links update the search param so
// every preview is shareable and back/forward buttons work.

import Link from "next/link";

import { findScenario, scenarios, type EmailScenarioGroup } from "@/lib/email-templates";

import { PreviewControls } from "./preview-controls";

export const metadata = {
  title: "Email previews | Click",
  description: "Branded HTML previews of every Click transactional email.",
  robots: { index: false, follow: false },
};

// The page builds HTML strings on every request — keep it dynamic so a
// fixture tweak shows up immediately during dev without a cache busy-bee.
export const dynamic = "force-dynamic";

type EmailPageProps = {
  searchParams: Promise<{ scenario?: string }>;
};

export default async function EmailPage({ searchParams }: EmailPageProps) {
  const { scenario: scenarioId } = await searchParams;
  const active = findScenario(scenarioId);
  const built = active.build();

  const groups: EmailScenarioGroup[] = ["Attendees", "Merchants"];

  return (
    <main className="paper-noise min-h-screen overflow-hidden text-[color:var(--ink)]">
      <section className="bg-[color:var(--cream)] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
            {/* Sidebar */}
            <nav aria-label="Email scenarios" className="lg:sticky lg:top-8 lg:self-start">
              <ul className="space-y-6">
                {groups.map((group) => (
                  <li key={group}>
                    <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                      {group}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {scenarios
                        .filter((s) => s.group === group)
                        .map((s) => {
                          const isActive = s.id === active.id;
                          return (
                            <li key={s.id}>
                              <Link
                                href={`/email?scenario=${s.id}`}
                                aria-current={isActive ? "page" : undefined}
                                className={`group block rounded-xl border-2 px-3 py-2 transition-colors ${
                                  isActive
                                    ? "border-[color:var(--line)] bg-[color:var(--peach)] text-[color:var(--ink)] hard-shadow-sm"
                                    : "border-transparent text-[color:var(--ink)] hover:border-[color:var(--line)] hover:bg-[color:var(--champagne)]"
                                }`}
                              >
                                <span className="block text-sm font-bold leading-tight">
                                  {s.label}
                                </span>
                                <span className="mt-0.5 block text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[color:var(--mauve)]">
                                  {s.wired ? "Wired" : "Draft"} · to {s.to}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Preview pane */}
            <div className="min-w-0 space-y-5">
              <header className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] ${
                      active.wired
                        ? "bg-[color:var(--peach)] text-[color:var(--ink)]"
                        : "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                    }`}
                  >
                    {active.wired ? "Wired" : "Draft"}
                  </span>
                  <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    {active.group}
                  </span>
                </div>
                <h2 className="font-display mt-3 text-3xl font-light leading-[1.05] text-[color:var(--ink)]">
                  {active.label}
                </h2>
                <p className="mt-1.5 text-sm font-medium text-[color:var(--mauve)]">
                  {active.description}
                </p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[5.5rem_1fr]">
                  <dt className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    To
                  </dt>
                  <dd className="font-mono text-[0.85rem] text-[color:var(--ink)]">
                    {active.to}
                  </dd>
                  <dt className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Subject
                  </dt>
                  <dd className="font-semibold text-[color:var(--ink)]">{built.subject}</dd>
                </dl>
              </header>

              <PreviewControls
                html={built.html}
                text={built.text}
                scenarioLabel={active.label}
                scenarioId={active.id}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
