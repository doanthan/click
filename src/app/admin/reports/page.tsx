import Link from "next/link";
import { auth } from "@/auth";
import { Badge } from "@/components/ds";
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
        <span className="eyebrow">Trust &amp; safety</span>
        <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
          Safety reports
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--slate)]">
          User reports awaiting review. Target SLA is 24 hours. Resolving a report either dismisses
          it (no action) or marks it actioned - you can also suspend the reported account directly.
        </p>
      </header>

      <section>
        <h2 className="eyebrow text-[color:var(--ink)]">
          Open · {open.length}
        </h2>
        {open.length === 0 ? (
          <p className="mt-4 rounded-[18px] border border-dashed border-[color:var(--line)] bg-[color:var(--paper)] p-6 text-sm text-[color:var(--slate)]">
            No open reports.
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
          <h2 className="eyebrow">
            Resolved · {resolved.length}
          </h2>
          <ul className="mt-4 space-y-3">
            {resolved.map((report) => (
              <li
                key={report.id}
                className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--paper)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[color:var(--ink)]">
                    {report.reportedName}{" "}
                    <span className="text-xs font-medium text-[color:var(--slate)]">
                      · {REASON_LABELS[report.reason] ?? report.reason}
                    </span>
                  </span>
                  <Badge tone={report.status === "actioned" ? "sage" : "neutral"}>
                    {report.status}
                  </Badge>
                </div>
                {report.resolutionNote ? (
                  <p className="mt-1 text-xs text-[color:var(--slate)]">
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
    <li className="rounded-[18px] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone="coral">{REASON_LABELS[report.reason] ?? report.reason}</Badge>
          <h3 className="font-display mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            <Link
              href={`/profile/${report.reportedId}`}
              className="hover:text-[color:var(--purple)]"
            >
              {report.reportedName}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            Reported by{" "}
            <Link href={`/profile/${report.reporterId}`} className="font-semibold underline">
              {report.reporterName}
            </Link>
            {report.sourceEventTitle ? ` · at ${report.sourceEventTitle}` : ""} ·{" "}
            {dateFormatter.format(new Date(report.createdAt))}
          </p>
        </div>
        <Badge tone={breached ? "coral" : "neutral"}>
          {age}h ago{breached ? " · SLA" : ""}
        </Badge>
      </div>

      {report.details ? (
        <p className="mt-3 rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--champagne)] p-3 text-sm leading-6 text-[color:var(--ink)]">
          {report.details}
        </p>
      ) : null}

      {alreadySuspended ? (
        <p className="mt-3 text-xs font-semibold text-[color:var(--danger)]">
          Reported account is already suspended.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form action={resolveReportAction}>
          <input type="hidden" name="report_id" value={report.id} />
          <input type="hidden" name="resolution" value="dismissed" />
          <button
            type="submit"
            className="ck-btn ck-btn--secondary ck-btn--sm"
          >
            Dismiss
          </button>
        </form>

        <form action={resolveReportAction}>
          <input type="hidden" name="report_id" value={report.id} />
          <input type="hidden" name="resolution" value="actioned" />
          <button
            type="submit"
            className="ck-btn ck-btn--primary ck-btn--sm"
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
              className="ck-btn ck-btn--danger ck-btn--sm"
            >
              Suspend account
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
