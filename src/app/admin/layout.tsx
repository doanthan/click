import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth, isAdminEmail } from "@/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminSidebarCounts } from "@/lib/event-repository";

export const metadata = {
  title: "Admin Portal",
  description: "Click admin portal for moderation, tag governance, security, and analytics.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="relative min-h-screen bg-[color:var(--champagne)] px-4 py-20 text-[color:var(--ink)] sm:px-6">
        <section className="relative z-10 mx-auto max-w-2xl rounded-2xl bg-[color:var(--paper)] p-10 shadow-[var(--shadow-sm)]">
          <span className="eyebrow">Access denied</span>
          <h1 className="font-display mt-6 text-4xl font-semibold leading-tight tracking-[-0.025em] sm:text-5xl">
            This account doesn’t have admin access.
          </h1>
          <p className="mt-5 text-base leading-7 text-[color:var(--slate)]">
            You’re signed in as{" "}
            <span className="font-semibold text-[color:var(--ink)]">
              {session.user.email}
            </span>
            . The admin portal is restricted to accounts configured in
            <span className="font-semibold text-[color:var(--ink)]"> ADMIN_EMAILS</span>. If you need access,
            ask an existing admin to add your address.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="ck-btn ck-btn--primary ck-btn--md">
              Back to dashboard
            </Link>
            <Link
              href="/login?callbackUrl=/admin"
              className="ck-btn ck-btn--secondary ck-btn--md"
            >
              Sign in as a different account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const counts = await getAdminSidebarCounts();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-8 text-[color:var(--ink)] sm:px-6 lg:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <AdminSidebar counts={counts} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
