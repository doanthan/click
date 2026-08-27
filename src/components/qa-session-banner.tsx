import Link from "next/link";
import { resetCurrentTestScenario, signOutOfClick } from "@/app/login/actions";
import { findQaPersona } from "@/lib/qa-personas";
import { QaSubmitButton } from "@/components/qa-testing-controls";

export function QaSessionBanner({
  currentEmail,
  unlocked,
}: {
  currentEmail: string;
  unlocked: boolean;
}) {
  const persona = findQaPersona(currentEmail);
  const label = persona?.label ?? "Test account";

  return (
    <aside
      aria-label="Active test session"
      className="border-b border-[color:var(--purple-800)] bg-[color:var(--purple)] text-[color:var(--paper)]"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-2.5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-5">
            Testing as <span className="font-bold">{label}</span>
          </p>
          <p className="truncate text-[11.5px] leading-4 text-[rgba(255,255,255,0.76)]">
            {unlocked
              ? `${currentEmail} - changes stay in the @click.local test namespace.`
              : "Testing access has expired. Exit this account, then sign in as a real admin to turn it on again."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unlocked ? (
            <>
              <Link
                href="/test"
                className="inline-flex min-h-9 items-center rounded-xl border border-white/40 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Testing workspace
              </Link>
              {persona ? (
                <form action={resetCurrentTestScenario}>
                  <QaSubmitButton
                    label="Reset this scenario"
                    pendingLabel="Resetting..."
                    variant="secondary"
                  />
                </form>
              ) : null}
            </>
          ) : null}
          <form action={signOutOfClick}>
            <button
              type="submit"
              className="inline-flex min-h-9 items-center rounded-xl bg-white px-3 text-[12.5px] font-semibold text-[color:var(--purple-800)] transition-transform hover:-translate-y-px"
            >
              Exit test account
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
