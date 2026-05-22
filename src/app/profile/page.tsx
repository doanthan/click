import { redirect } from "next/navigation";
import { BscProfileForm } from "@/components/bsc-action-forms";
import { MetricCard, SectionIntro } from "@/components/click-ui";
import { ensureBscProfile, getBscDashboard } from "@/lib/bible-study";

export const metadata = {
  title: "Profile | Bible Study Connect",
};

export default async function ProfilePage() {
  let profile;
  try {
    profile = await ensureBscProfile();
  } catch {
    redirect("/sign-in");
  }

  const dashboard = await getBscDashboard();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <SectionIntro
          eyebrow="Profile"
          title={profile.displayName || "Complete your profile."}
          body="Your public profile controls how other members see you. Private profiles redact identity from other users, while admins can still moderate safely."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <MetricCard label="Groups joined" value={dashboard.groups.length.toString()} tone="cream" />
          <MetricCard label="Prayer posts" value={dashboard.prayers.length.toString()} tone="peach" />
          <MetricCard label="Testimonies" value={dashboard.testimonies.length.toString()} tone="rose" />
          <MetricCard label="Events" value={dashboard.events.length.toString()} tone="ink" />
        </div>
      </section>
      <section className="mx-auto mt-10 max-w-4xl rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)] p-5">
        <BscProfileForm initial={profile} />
      </section>
    </main>
  );
}
