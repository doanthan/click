import { AdminPageHeader } from "@/components/admin-page-header";
import { InfoCard } from "@/components/click-ui";
import { securityRows } from "@/lib/click-data";
import { getAdminAuditLog } from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

export const metadata = {
  title: "Audit Log | Admin",
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function formatActionLabel(action: string) {
  return action.replace(/_/g, " ");
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return "-";
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

export default async function AdminAuditPage() {
  await requireAdminPage();

  const audit = await getAdminAuditLog();

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Security"
        title="Audit Log"
        description="Every privileged admin action, timestamped."
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {securityRows.map(([title, body], index) => (
          <InfoCard
            key={title}
            title={title}
            body={body}
            accent={index === 0 ? "rose" : "peach"}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
        <div className="hidden grid-cols-[0.9fr_1fr_1.4fr_0.7fr] gap-4 border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--slate)] md:grid">
          <span>Action</span>
          <span>Actor</span>
          <span>Detail</span>
          <span>When</span>
        </div>
        {audit.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-medium text-[color:var(--slate)]">
            No admin actions logged yet.
          </p>
        ) : (
          audit.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-2 border-b border-[color:var(--line)] px-5 py-4 text-sm text-[color:var(--slate)] last:border-0 md:grid-cols-[0.9fr_1fr_1.4fr_0.7fr] md:items-center"
            >
              <span className="font-semibold text-[color:var(--ink)]">
                {formatActionLabel(entry.action)}
              </span>
              <span>{entry.actorName ?? "System"}</span>
              <span className="break-words text-xs">{formatMetadata(entry.metadata)}</span>
              <span className="text-xs tabular-nums">
                {dateFormatter.format(new Date(entry.createdAt))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
