import { HarnessButton } from "./harness-button";
import type { HarnessLogEntry } from "@/lib/click-test-log";

/**
 * The activity log.
 *
 * Reads as a transcript rather than a status line because the interesting steps in
 * this mechanic are the ones whose reply is deliberately uninformative. Three
 * pieces per entry and they answer three different questions:
 *
 *   message  - what the person would have been told. On a refusal this is the same
 *              sentence for nine different causes, on purpose (§6.1).
 *   reason   - which gate actually closed, off the error's `auditReason`. This is
 *              the half the product must never show and the tester always needs.
 *   changes  - the rows that moved. The only honest record of a send, since the
 *              reply is identical whether or not a mutual click formed.
 */

const OUTCOME: Record<HarnessLogEntry["outcome"], { label: string; className: string }> = {
  // Status colours, on badges only - never on a control.
  ok: { label: "wrote", className: "bg-[color:var(--sage)]/15 text-[color:var(--sage-ink)]" },
  noop: { label: "no-op", className: "bg-[color:var(--mist)] text-[color:var(--slate)]" },
  refused: { label: "refused", className: "bg-[color:var(--danger)]/12 text-[color:var(--danger)]" },
};

export function HarnessLog({
  entries,
  pairFields,
}: {
  entries: HarnessLogEntry[];
  pairFields: Record<string, string>;
}) {
  return (
    <aside className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <section className="rounded-[16px] border border-[color:var(--mist)] bg-white p-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-[1.05rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
              Activity log
            </h3>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-[color:var(--slate)]">
              Every step, the rows it moved, and the gate that closed on it. A send&rsquo;s reply is
              identical whether or not it formed a mutual click, so the row diff is the only place
              the outcome is legible.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <HarnessButton
            label="Clear the log"
            fields={{ step: "clear_log", ...pairFields }}
            hint="In-memory only - it clears on a server restart anyway. Writes nothing."
          />
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 rounded-[12px] bg-[color:var(--lav-bg)] p-3 text-[0.78rem] text-[color:var(--slate)]">
            Nothing yet. Press a control and the whole step lands here - including the steps that
            succeed by doing nothing.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
}

function LogRow({ entry }: { entry: HarnessLogEntry }) {
  const style = OUTCOME[entry.outcome];
  return (
    <li className="rounded-[12px] border border-[color:var(--mist)] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-[8px] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] ${style.className}`}
        >
          {style.label}
        </span>
        <span className="font-mono text-[0.72rem] font-semibold text-[color:var(--ink)]">
          {entry.step}
        </span>
        {entry.actor ? (
          <span className="font-mono text-[0.62rem] text-[color:var(--slate)]">
            as {entry.actor.replace("@click.local", "")}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[0.6rem] text-[color:var(--slate)]">
          {new Date(entry.at).toLocaleTimeString()} · {entry.ms}ms
        </span>
      </div>

      <p className="mt-1.5 text-[0.74rem] leading-snug text-[color:var(--ink)]">{entry.message}</p>

      {entry.reason ? (
        <p className="mt-1.5 rounded-[8px] bg-[color:var(--danger)]/8 px-2 py-1 font-mono text-[0.66rem] leading-snug text-[color:var(--danger)]">
          why: {entry.reason}
        </p>
      ) : null}

      {entry.rule ? (
        <p className="mt-1 text-[0.66rem] leading-snug text-[color:var(--slate)]">{entry.rule}</p>
      ) : null}

      {entry.changes.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {entry.changes.map((change) => (
            <li
              key={change}
              className="font-mono text-[0.66rem] leading-snug text-[color:var(--ink-soft)]"
            >
              + {change}
            </li>
          ))}
        </ul>
      ) : entry.outcome === "noop" ? (
        <p className="mt-1.5 font-mono text-[0.66rem] leading-snug text-[color:var(--slate)]">
          no rows changed - this step reported success and wrote nothing
        </p>
      ) : null}

      {entry.late.length > 0 ? (
        <div className="mt-1.5 rounded-[8px] bg-[color:var(--lav-bg)] px-2 py-1">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[color:var(--slate)]">
            landed after the response
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {entry.late.map((change) => (
              <li
                key={change}
                className="font-mono text-[0.66rem] leading-snug text-[color:var(--ink-soft)]"
              >
                + {change}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
