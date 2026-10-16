"use client";

import { useActionState } from "react";
import { runScheduledJobNowAction, type RunNowState } from "@/app/admin/system/actions";

const JOBS = [
  {
    job: "rebuild_suggestion_scores",
    label: "Rebuild suggestion scores now",
    detail: "Refreshes the matching features every suggestion is scored from. Also runs nightly.",
  },
  {
    job: "build_daily_picks",
    label: "Build today's suggestions now",
    detail: "Writes today's three picks for every member who has none yet. Also runs every morning.",
  },
] as const;

function RunNowButton({ job, label, detail }: (typeof JOBS)[number]) {
  const [state, action, pending] = useActionState<RunNowState, FormData>(
    runScheduledJobNowAction,
    null,
  );
  return (
    <form action={action} className="grid gap-2 rounded-xl border border-[color:var(--line-soft)] p-4">
      <input type="hidden" name="job" value={job} />
      <p className="text-sm leading-6 text-[color:var(--slate)]">{detail}</p>
      <button
        type="submit"
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
        className={`ck-btn ck-btn--secondary ck-btn--md justify-self-start ${pending ? "opacity-70" : ""}`}
      >
        {pending ? "Running…" : label}
      </button>
      {state ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-xs font-semibold ${
            state.ok ? "text-[color:var(--slate)]" : "text-[color:var(--danger)]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * 03 §10 Run now. The same jobs the crons run, on demand: admin only, audited,
 * at most once every 2 minutes, and "already running" while one is going.
 */
export function AdminRunNow() {
  return (
    <section className="rounded-2xl bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <p className="eyebrow">Jobs</p>
      <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
        Run now
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--slate)]">
        Runs the scheduled job straight away, exactly as the schedule would. Every press is in the
        audit log.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {JOBS.map((entry) => (
          <RunNowButton key={entry.job} {...entry} />
        ))}
      </div>
    </section>
  );
}
