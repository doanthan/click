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

// Postgres jsonb does NOT preserve the order the keys were written in - it sorts
// them by length, then bytewise. A send_click row written {outcome, reason, ...}
// therefore came back rendering as "intent · reason · outcome · surface · ...",
// burying the two fields the row exists to answer. Detail is a single line, so
// the order is decided here instead. Anything not named keeps jsonb's own order
// behind these (Array#sort is stable).
const METADATA_ORDER = ["outcome", "reason", "receiver", "surface", "event", "intent"];

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  // Same call as the empty cells across the rest of the console: a word, not a
  // lone dash, so a screen reader does not skip the cell and an operator can
  // tell "this action carries no metadata" from a rendering fault.
  if (entries.length === 0) return "No detail recorded";
  const rank = (key: string) => {
    const at = METADATA_ORDER.indexOf(key);
    return at === -1 ? METADATA_ORDER.length : at;
  };
  return entries
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

const SCOPES = [
  ["all", "Everything"],
  ["admin", "Admin actions"],
  ["clicks", "Clicks"],
] as const;

type AuditScope = (typeof SCOPES)[number][0];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const scope: AuditScope = SCOPES.some(([value]) => value === params.scope)
    ? (params.scope as AuditScope)
    : "all";
  const audit = await getAdminAuditLog(scope);

  return (
    <div className="space-y-8 py-10">
      {/* The old description promised "every privileged admin action", but
          getAdminAuditLog is a fixed `limit 40` with no offset and there is no
          pager on this page - so an operator checking whether a ban or a refund
          was logged would read "every" and conclude it never happened once 40
          newer rows had pushed it off. Until the query takes a page, the header
          says what is actually on screen. Send-click rows land in the same table
          and outnumber admin actions by orders of magnitude, which is what the
          scope filter below is for. */}
      <AdminPageHeader
        eyebrow="Security"
        title="Audit Log"
        description="The 40 most recent logged actions, newest first. Every send-click attempt is recorded with the reason it landed or was refused - filter to Admin actions to read the moderation trail on its own."
      />
      <div className="flex flex-wrap gap-2">
        {SCOPES.map(([value, label]) => (
          <a
            key={value}
            href={value === "all" ? "/admin/audit" : `/admin/audit?scope=${value}`}
            aria-current={scope === value ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              scope === value
                ? "bg-[color:var(--rose)] text-white"
                : "border border-[color:var(--line)] bg-[color:var(--paper)] text-[color:var(--slate)] hover:text-[color:var(--ink)]"
            }`}
          >
            {label}
          </a>
        ))}
      </div>
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
            {scope === "clicks" ? "No clicks logged yet." : "No admin actions logged yet."}
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
