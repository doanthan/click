import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { AdminEventQueue } from "@/components/admin-event-queue";
import { AdminMembersTable } from "@/components/admin-members-table";
import { AdminMerchantsTable } from "@/components/admin-merchants-table";
import { AdminSystemSettings } from "@/components/admin-system-settings";
import { AdminTagManager } from "@/components/admin-tag-manager";
import { AdminTrendChart } from "@/components/admin-trend-chart";
import { AdminWorkspace } from "@/components/admin-workspace";
import { InfoCard, MetricCard, PageHero, SectionIntro } from "@/components/click-ui";
import { adminModules, securityRows } from "@/lib/click-data";
import {
  getAdminAuditLog,
  getAdminEvents,
  getAdminTags,
  getAdminMembers,
  getAdminMerchants,
  getAdminMetrics,
  getAdminWeeklyTrend,
  getSystemSettings,
} from "@/lib/event-repository";

export const metadata = {
  title: "Admin Portal | Click",
  description: "Click admin portal for moderation, tag governance, security, and analytics.",
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
  if (entries.length === 0) return "—";
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
        <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
        <section className="relative z-10 mx-auto max-w-2xl rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-10 hard-shadow">
          <span className="sticker sticker--rose tilt-r-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--surface-deep)]" />
            Access denied
          </span>
          <h1 className="font-display mt-6 text-4xl font-light leading-tight tracking-tight sm:text-5xl">
            This account doesn’t have admin access.
          </h1>
          <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
            You’re signed in as{" "}
            <span className="font-mono font-bold text-[color:var(--ink)]">
              {session.user.email}
            </span>
            . The admin portal is restricted to accounts configured in
            <span className="font-mono"> ADMIN_EMAILS</span>. If you need access,
            ask an existing admin to add your address.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
            >
              Back to dashboard
            </Link>
            <Link
              href="/login?callbackUrl=/admin"
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
            >
              Sign in as a different account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [events, members, merchants, tags, audit, trend, systemSettings] = await Promise.all([
    getAdminEvents(),
    getAdminMembers(),
    getAdminMerchants(),
    getAdminTags(),
    getAdminAuditLog(),
    getAdminWeeklyTrend(),
    getSystemSettings(),
  ]);
  const metrics = await getAdminMetrics(events);
  const pendingCount = events.filter((event) => event.status === "Pending").length;

  const overviewPanel = (
    <div className="space-y-12 py-10">
      <SectionIntro
        eyebrow="Operations"
        title="Admin work is approvals, governance, and proof."
        body="Every sensitive action should require a confirmation step and write to an audit trail."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Members" value={metrics.totalMembers.toLocaleString()} tone="cream" />
        <MetricCard label="New this week" value={metrics.newMembersThisWeek.toLocaleString()} tone="peach" />
        <MetricCard label="Pending events" value={metrics.pendingEvents.toLocaleString()} tone="rose" />
        <MetricCard label="Pending merchants" value={metrics.pendingMerchants.toLocaleString()} tone="ink" />
        <MetricCard label="Total events" value={metrics.totalEvents.toLocaleString()} tone="peach" />
        <MetricCard label="Confirmed RSVPs" value={metrics.confirmedRsvps.toLocaleString()} tone="cream" />
        <MetricCard label="Merchants" value={metrics.totalMerchants.toLocaleString()} tone="rose" />
        <MetricCard label="Mutual Clicks" value={metrics.mutualClicks.toLocaleString()} tone="ink" />
      </div>

      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          Last 8 weeks
        </p>
        <h3 className="font-display mt-2 text-3xl font-light leading-tight">
          Growth + engagement at a glance.
        </h3>
        <div className="mt-6">
          <AdminTrendChart buckets={trend} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {adminModules.map(([title, body], index) => (
          <InfoCard
            key={title}
            title={title}
            body={body}
            accent={index === 4 ? "rose" : index === 5 ? "ink" : "peach"}
          />
        ))}
      </div>
    </div>
  );

  const membersPanel = (
    <div className="space-y-8 py-10">
      <SectionIntro
        eyebrow="Members"
        title="Profiles, intent, and verification at a glance."
        body="Filter by role, search by name, email, or suburb, and see who is actively saving or RSVP-ing."
      />
      <AdminMembersTable members={members} />
    </div>
  );

  const eventsPanel = (
    <div className="space-y-8 py-10">
      <SectionIntro
        eyebrow="Events"
        title="Review events before they shape the marketplace."
        body="Tag accuracy, duplicates, photos, capacity, booking model, and location claims live here. Approving an event writes to the audit log."
      />
      <AdminEventQueue events={events} />
    </div>
  );

  const merchantsPanel = (
    <div className="space-y-8 py-10">
      <SectionIntro
        eyebrow="Merchants"
        title="Verification, contact info, and event volume."
        body="Approve hosts after ABN, contact, and website checks. Pending merchants cannot launch Click-managed bookings."
      />
      <AdminMerchantsTable merchants={merchants} />
    </div>
  );

  const tagsPanel = (
    <div className="space-y-8 py-10">
      <SectionIntro
        eyebrow="Tag governance"
        title="Interest Tags are product infrastructure."
        body="Life Tags are generated by the system. Interest Tags are curated by admins to prevent duplicates and keep discovery quality high."
      />
      <AdminTagManager tags={tags} />
    </div>
  );

  const auditPanel = (
    <div className="space-y-8 py-10">
      <SectionIntro
        eyebrow="Audit log"
        title="Every sensitive action leaves a trace."
        body="Approvals, verifications, tag changes, financial edits, and moderation actions are recorded with actor, target, and time."
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

      <div className="overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="hidden grid-cols-[0.9fr_1fr_1.4fr_0.7fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
          <span>Action</span>
          <span>Actor</span>
          <span>Detail</span>
          <span>When</span>
        </div>
        {audit.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-bold text-[color:var(--mauve)]">
            No admin actions logged yet.
          </p>
        ) : (
          audit.map((entry) => (
            <div
              key={entry.id}
              className="grid gap-2 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 md:grid-cols-[0.9fr_1fr_1.4fr_0.7fr] md:items-center"
            >
              <span className="font-black uppercase tracking-wider text-[color:var(--ink)]">
                {formatActionLabel(entry.action)}
              </span>
              <span>{entry.actorName ?? "System"}</span>
              <span className="break-words text-xs">{formatMetadata(entry.metadata)}</span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {dateFormatter.format(new Date(entry.createdAt))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] text-[color:var(--ink)]">
      <PageHero
        eyebrow="Admin portal"
        title="Keep the room worth entering."
        body="Merchant approval, event moderation, member oversight, tag governance, audit logs, and payment review — all in one workspace."
      >
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Members" value={metrics.totalMembers.toLocaleString()} tone="cream" />
          <MetricCard label="Merchants" value={metrics.totalMerchants.toLocaleString()} tone="peach" />
          <MetricCard label="Events" value={events.length.toString()} tone="rose" />
          <MetricCard label="Pending" value={pendingCount.toString()} tone="ink" />
        </div>
      </PageHero>

      <section className="bg-[color:var(--champagne)] px-4 pb-16 pt-4 sm:px-6">
        <AdminWorkspace
          counts={{
            members: members.length,
            events: events.length,
            merchants: merchants.length,
            tags: tags.length,
            audit: audit.length,
          }}
          panels={{
            overview: overviewPanel,
            members: membersPanel,
            events: eventsPanel,
            merchants: merchantsPanel,
            tags: tagsPanel,
            audit: auditPanel,
            system: (
              <div className="space-y-8 py-10">
                <SectionIntro
                  eyebrow="System"
                  title="Runtime knobs."
                  body="Maintenance mode, commission rate, and the site-wide marketing banner. All changes are audit-logged."
                />
                <AdminSystemSettings initial={systemSettings} />
              </div>
            ),
          }}
        />
      </section>
    </main>
  );
}
