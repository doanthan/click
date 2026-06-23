import Link from "next/link";
import { auth } from "@/auth";
import { getAdminReports, type AdminReportRow } from "@/lib/event-repository";
import { resolveReportAction, suspendFromReportAction } from "./actions";

export const metadata = {
  title: "Safety Reports | Click Admin",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const REASON_LABELS: Record<string, string> = {
  harassment: "Harassment or threats",
  inappropriate_messages: "Inappropriate behaviour",
  spam_or_scam: "Spam or scam",
  fake_profile: "Fake / impersonating",
  safety_concern: "Safety concern",
  other: "Other",
};

// Hours since a report was filed — used to surface the 24hr SLA.
function hoursSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

export default async function AdminReportsPage() {
  const session = await auth();
  const reports = await getAdminReports(session);
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status !== "open");

  return (
    <div className="space-y-8 py-6">
      <header>
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--rose)]">
          Trust &amp; Safety
        </span>
        <h1 className="font-display mt-2 text-4xl font-bold leading-tight tracking-[-0.025em] sm:text-5xl">
          Safety Reports
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
          User reports awaiting review. Target SLA is 24 hours. Resolving a report either dismisses
          it (no action) or marks it actioned — you can also suspend the reported account directly.
        </p>
      </header>

      <section>
        <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--ink)]">
          Open · {open.length}
        </h2>
        {open.length === 0 ? (
          <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-6 text-sm font-medium text-[color:var(--mauve)]">
            No open reports. 🎉
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {open.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 ? (
        <section>
          <h2 className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[color:var(--mauve)]">
            Resolved · {resolved.length}
          </h2>
          <ul className="mt-4 space-y-3">
            {resolved.map((report) => (
              <li
                key={report.id}
                className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[color:var(--ink)]">
                    {report.reportedName}{" "}
                    <span className="font-mono text-xs font-bold uppercase tracking-wide text-[color:var(--mauve)]">
                      · {REASON_LABELS[report.reason] ?? report.reason}
                    </span>
                  </span>
                  <span
                    className={`rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${
                      report.status === "actioned"
                        ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
                        : "bg-[color:var(--cream)] text-[color:var(--mauve)]"
                    }`}
                  >
                    {report.status}
                  </span>
                </div>
                {report.resolutionNote ? (
                  <p className="mt-1 text-xs font-medium text-[color:var(--mauve)]">
                    {report.resolutionNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReportCard({ report }: { report: AdminReportRow }) {
  const age = hoursSince(report.createdAt);
  const breached = age >= 24;
  const alreadySuspended = Boolean(report.reportedSuspendedAt);

  return (
    <li className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-[color:var(--surface-deep)]">
            {REASON_LABELS[report.reason] ?? report.reason}
          </span>
          <h3 className="font-display mt-2 text-2xl font-semibold leading-tight">
            <Link
              href={`/profile/${report.reportedId}`}
              className="hover:text-[color:var(--rose)]"
            >
              {report.reportedName}
            </Link>
          </h3>
          <p className="mt-1 text-xs font-medium text-[color:var(--mauve)]">
            Reported by{" "}
            <Link href={`/profile/${report.reporterId}`} className="font-bold underline">
              {report.reporterName}
            </Link>
            {report.sourceEventTitle ? ` · at ${report.sourceEventTitle}` : ""} ·{" "}
            {dateFormatter.format(new Date(report.createdAt))}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-wider ${
            breached
              ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)]"
              : "bg-[color:var(--cream)] text-[color:var(--ink)]"
          }`}
        >
          {age}h ago{breached ? " · SLA" : ""}
        </span>
      </div>

      {report.details ? (
        <p className="mt-3 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-3 text-sm font-medium leading-6 text-[color:var(--ink)]">
          {report.details}
        </p>
      ) : null}

      {alreadySuspended ? (
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[color:var(--rose)]">
          Reported account is already suspended.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form action={resolveReportAction}>
          <input type="hidden" name="report_id" value={report.id} />
          <input type="hidden" name="resolution" value="dismissed" />
          <button
            type="submit"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
          >
            Dismiss
          </button>
        </form>

        <form action={resolveReportAction}>
          <input type="hidden" name="report_id" value={report.id} />
          <input type="hidden" name="resolution" value="actioned" />
          <button
            type="submit"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
          >
            Mark actioned
          </button>
        </form>

        {!alreadySuspended ? (
          <form action={suspendFromReportAction}>
            <input type="hidden" name="report_id" value={report.id} />
            <input type="hidden" name="reported_id" value={report.reportedId} />
            <input
              type="hidden"
              name="reason"
              value={`Safety report: ${REASON_LABELS[report.reason] ?? report.reason}`}
            />
            <button
              type="submit"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Suspend account
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
