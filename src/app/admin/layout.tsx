import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth, isAdminEmail } from "@/auth";
import { AdminSidebar } from "@/components/admin-sidebar";
import { getAdminSidebarCounts } from "@/lib/event-repository";

export const metadata = {
  title: "Admin Portal | Click",
  description: "Click admin portal for moderation, tag governance, security, and analytics.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
        <section className="relative z-10 mx-auto max-w-2xl rounded-3xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-10 hard-shadow">
          <span className="sticker sticker--rose tilt-r-1 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--surface-deep)]" />
            Access denied
          </span>
          <h1 className="font-display mt-6 text-4xl font-bold leading-tight tracking-[-0.025em] sm:text-5xl">
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
