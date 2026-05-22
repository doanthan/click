import Link from "next/link";
import { canModerate, getOptionalBscProfile, getBscViewer } from "@/lib/bible-study";

export async function SiteHeader() {
  const [viewer, profile] = await Promise.all([getBscViewer(), getOptionalBscProfile()]);
  const isModerator = canModerate(profile?.role);

  const navItems = [
    { label: "Groups", href: "/groups" },
    { label: "Prayer", href: "/prayer" },
    { label: "Testimonies", href: "/testimonies" },
    { label: "Events", href: "/events" },
    { label: "Waitlist", href: "/waitlist" },
  ];

  if (viewer) {
    navItems.push({ label: "Dashboard", href: "/dashboard" });
  }
  if (isModerator) {
    navItems.push({ label: "Admin", href: "/admin" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--line-soft)] bg-[color:var(--champagne)]/96 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group min-w-0" aria-label="Bible Study Connect home">
          <span className="block font-display text-2xl font-semibold leading-none text-[color:var(--ink)] sm:text-3xl">
            Bible Study Connect
          </span>
          <span className="mt-1 hidden font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)] sm:block">
            Groups, prayer, testimonies
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)] lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-[color:var(--ink)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {viewer ? (
            <>
              <Link
                href="/notifications"
                className="hidden rounded-full border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] sm:inline-flex"
              >
                Notifications
              </Link>
              <Link
                href="/profile"
                className="max-w-40 truncate rounded-full border border-[color:var(--line-soft)] bg-[color:var(--ink)] px-4 py-2 text-sm font-bold text-[color:var(--champagne)]"
              >
                {profile?.displayName || viewer.name}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-full border border-[color:var(--line-soft)] bg-[color:var(--cream)] px-4 py-2 text-sm font-bold text-[color:var(--ink)]"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full border border-[color:var(--line-soft)] bg-[color:var(--ink)] px-4 py-2 text-sm font-bold text-[color:var(--champagne)]"
              >
                Join
              </Link>
            </>
          )}
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t border-[color:var(--line-soft)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)] lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full bg-[color:var(--cream)] px-3 py-1.5"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const footerGroups: Array<{
    title: string;
    items: Array<{ label: string; href: string }>;
  }> = [
    {
      title: "Community",
      items: [
        { label: "Groups", href: "/groups" },
        { label: "Prayer", href: "/prayer" },
        { label: "Testimonies", href: "/testimonies" },
        { label: "Events", href: "/events" },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Profile", href: "/profile" },
        { label: "Settings", href: "/account-settings" },
        { label: "Waitlist", href: "/waitlist" },
      ],
    },
    {
      title: "Safety",
      items: [
        { label: "Admin", href: "/admin" },
        { label: "Notifications", href: "/notifications" },
        { label: "Discover", href: "/discover" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[color:var(--line-soft)] bg-[color:var(--surface-deep)] text-[color:var(--on-deep)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <span className="font-display text-4xl font-semibold leading-none text-[color:var(--champagne)]">
            Bible Study Connect
          </span>
          <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-[color:var(--on-deep)]/72">
            A calm place to find Bible study groups, post prayer requests,
            share testimonies, and meet believers nearby.
          </p>
        </div>
        {footerGroups.map(({ title, items }) => (
          <div key={title}>
            <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[color:var(--peach)]">
              {title}
            </p>
            <div className="mt-3 grid gap-2 text-sm font-semibold text-[color:var(--on-deep)]/72">
              {items.map((item) => (
                <Link key={item.href} href={item.href} className="w-fit hover:text-[color:var(--peach)]">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[color:var(--on-deep)]/15 px-4 py-5 text-center font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[color:var(--on-deep)]/60">
        Built for local Christian community
      </div>
    </footer>
  );
}
