import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { signOutOfTestAccount, startTestScenario } from "@/app/login/actions";
import { QaGlobalResetForm, QaSubmitButton } from "@/components/qa-testing-controls";
import { QA_PERSONAS, QA_SCENARIO_GROUPS, type QaPersona } from "@/lib/qa-personas";
import { isLocalDevelopment } from "@/lib/runtime-mode";
import { isTestSwitcherUnlocked } from "@/lib/test-switcher";
import SupabaseLogDrawer from "./SupabaseLogDrawer";
import TestCasesBoard from "./TestCasesBoard";

export const metadata = {
  title: "Testing workspace",
  description: "Start Click's seeded QA scenarios from a known state.",
  robots: { index: false, follow: false },
};

function roleLabel(role: QaPersona["role"]) {
  if (role === "merchant") return "Host";
  if (role === "admin") return "Admin";
  return "Customer";
}

function scenarioNote(email: string) {
  if (email === "sam@click.local") {
    return "After Sam submits, use Test as Admin to approve the application. Then Test as Sam without resetting to see first-login host onboarding.";
  }
  if (email === "theo@click.local") {
    return "This is the approved-host walkthrough itself. Payout readiness is deliberately separate from onboarding completion.";
  }
  if (email === "nadia@click.local") {
    return "The Click paid-flow gate is open. A live Stripe charge intentionally fails before money moves.";
  }
  if (email === "ruby@click.local" || email === "ollie@click.local") {
    return "Start fresh once, then use Test as in the avatar menu so shared clicks are not reset.";
  }
  return null;
}

export default async function TestPage() {
  if (!(await isTestSwitcherUnlocked())) notFound();

  const session = await auth();
  const currentEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const showDeveloperTools = isLocalDevelopment();

  return (
    <main className="min-h-[100dvh] bg-[color:var(--champagne)] px-4 py-10 text-[color:var(--ink)] sm:px-6 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="eyebrow">QA workspace</p>
          <h1 className="font-display mt-3 text-4xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">
            Start from a known state.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--slate)]">
            Start fresh resets only the selected test person, signs in, and opens the first page of that scenario. Use Test as in the avatar menu when you want to keep existing work.
          </p>
        </header>

        <section className="mt-7 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Signed-out entry points</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
                Clear the current test session before checking public signup, login, and locked browsing.
              </p>
            </div>
            <form action={signOutOfTestAccount}>
              <input type="hidden" name="redirectTo" value="/signup" />
              <QaSubmitButton
                label="Start signed out"
                pendingLabel="Signing out..."
                variant="secondary"
              />
            </form>
          </div>
        </section>

        <div className="mt-9 grid gap-9">
          {QA_SCENARIO_GROUPS.map((group) => {
            const scenarios = QA_PERSONAS.filter((persona) => persona.group === group.id);
            return (
              <section key={group.id} aria-labelledby={`qa-${group.id}`}>
                <div className="max-w-2xl">
                  <h2
                    id={`qa-${group.id}`}
                    className="font-display text-2xl font-semibold text-[color:var(--ink)]"
                  >
                    {group.label}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">
                    {group.description}
                  </p>
                </div>

                <ul className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
                  {scenarios.map((persona, index) => {
                    const active = persona.email === currentEmail;
                    const note = scenarioNote(persona.email);
                    return (
                      <li
                        key={persona.email}
                        className={`grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                          index > 0 ? "border-t border-[color:var(--line)]" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-semibold text-[color:var(--ink)]">
                              {persona.label}
                            </h3>
                            <span className="rounded-lg bg-[color:var(--lavender-100)] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--purple-800)]">
                              {roleLabel(persona.role)}
                            </span>
                            {active ? (
                              <span className="rounded-lg bg-[color:var(--champagne)] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--sage-ink)]">
                                Active now
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[color:var(--slate)]">
                            {persona.exercises}
                          </p>
                          <p className="mt-1 text-xs font-medium text-[color:var(--ink-faint)]">
                            {persona.email} · starts at {persona.startPath}
                          </p>
                          {note ? (
                            <p className="mt-2 max-w-3xl rounded-xl bg-[color:var(--lavender-100)] px-3 py-2 text-xs leading-5 text-[color:var(--purple-800)]">
                              {note}
                            </p>
                          ) : null}
                        </div>

                        <form action={startTestScenario}>
                          <input type="hidden" name="email" value={persona.email} />
                          <QaSubmitButton
                            label={active ? "Restart fresh" : "Start fresh"}
                            pendingLabel="Preparing..."
                          />
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)] p-5">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-[color:var(--ink)]">
              Advanced reset
            </summary>
            <div className="mt-4 flex flex-col gap-4 border-t border-[color:var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
                Removes every @click.local profile, its events, and shared QA progress. Use this only when the whole test environment needs a clean slate.
              </p>
              <QaGlobalResetForm />
            </div>
          </details>
        </section>

        {showDeveloperTools ? (
          <section className="mt-10 border-t border-[color:var(--line)] pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">Local developer tools</h2>
                <p className="mt-1 text-sm text-[color:var(--slate)]">
                  Database logs and the engineering test-case board stay local only.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SupabaseLogDrawer />
                <Link href="/test-click" className="ck-btn ck-btn--secondary ck-btn--sm">
                  Click walkthrough
                </Link>
              </div>
            </div>
            <TestCasesBoard />
          </section>
        ) : null}
      </div>
    </main>
  );
}
