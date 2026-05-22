import { redirect } from "next/navigation";
import { InfoCard, MetricCard, SectionIntro } from "@/components/click-ui";
import { canManageUsers, canModerate, ensureBscProfile, getBscAdminStats } from "@/lib/bible-study";

export const metadata = {
  title: "Admin | Bible Study Connect",
};

export default async function AdminPage() {
  let profile;
  let stats;
  try {
    profile = await ensureBscProfile();
    if (!canModerate(profile.role)) redirect("/dashboard");
    stats = await getBscAdminStats();
  } catch {
    redirect("/sign-in");
  }

  const modules = [
    ["Users", canManageUsers(profile.role) ? "Search, view, manage roles, ban, unban, and suspend users." : "Moderators cannot access user PII endpoints."],
    ["Groups", "Browse and moderate all public and private groups, remove content, and audit changes."],
    ["Reports", "Review community reports with reporter and reported-user context according to role permissions."],
    ["Prayer", "Approve or remove prayer requests and praise reports when moderation is required."],
    ["Testimonies", "Approve or reject submitted testimonies before public display."],
    ["Events", "View and moderate public and private group events."],
    ["Discussions", "View and delete discussion posts or comments that break community standards."],
    ["Announcements", "Post site-wide announcements for the community."],
    ["System", "Review platform health, cleanup jobs, upload tokens, and notification expiry."],
  ];

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow={`Admin role: ${profile.role}`}
          title="Moderation, safety, and platform health."
          body="The dashboard is structured around role-based access control, audit logging, and private-profile redaction."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Users" value={stats.users.toString()} tone="cream" />
          <MetricCard label="Groups" value={stats.groups.toString()} tone="peach" />
          <MetricCard label="Prayer" value={stats.prayerPosts.toString()} tone="rose" />
          <MetricCard label="Stories" value={stats.testimonies.toString()} tone="cream" />
          <MetricCard label="Events" value={stats.events.toString()} tone="peach" />
          <MetricCard label="Reports" value={stats.reports.toString()} tone="ink" />
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map(([title, body]) => (
            <InfoCard key={title} title={title} body={body} accent={title === "Reports" ? "rose" : "peach"} />
          ))}
        </div>
      </section>
    </main>
  );
}
