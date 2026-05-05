import Link from "next/link";
import { navItems } from "@/lib/click-data";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-[#340068]/12 bg-[#FFFCF9]/94 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3" aria-label="Click home">
          <span className="grid size-10 place-items-center rounded-full bg-[#FF6978] text-lg font-black text-[#340068] shadow-[4px_4px_0_#340068]">
            C
          </span>
          <span className="font-display text-3xl font-black leading-none tracking-normal text-[#340068]">
            Click
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-black text-[#340068]/60 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#340068]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="hidden rounded-full border-2 border-[#340068] bg-white px-4 py-2 text-sm font-black text-[#340068] shadow-[2px_2px_0_#340068] sm:block"
          >
            Join
          </Link>
          <Link
            href="/discover"
            className="rounded-full bg-[#340068] px-4 py-2 text-sm font-black text-white shadow-[2px_2px_0_#B1EDE8]"
          >
            Ask Click
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const footerGroups = [
    ["Product", "Discover", "Events", "Dashboard", "Onboarding"],
    ["Platform", "Merchant", "Admin", "Privacy", "Matching"],
    ["Modes", "Friendship", "Dating", "Networking", "Exploring"],
  ];

  return (
    <footer className="brand-gradient-soft text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <p className="font-display text-3xl font-black">Click</p>
          <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-white/62">
            An event-first people platform for friendship, dating, local groups, and
            shared-interest discovery.
          </p>
        </div>
        {footerGroups.map(([title, ...items]) => (
          <div key={title}>
            <p className="font-black">{title}</p>
            <div className="mt-3 grid gap-2 text-sm font-bold text-white/62">
              {items.map((item) => (
                <Link
                  href={linkForFooterItem(item)}
                  key={item}
                  className="w-fit hover:text-white"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}

function linkForFooterItem(item: string) {
  const normalized = item.toLowerCase();

  if (normalized === "discover") return "/discover";
  if (normalized === "events") return "/events";
  if (normalized === "dashboard") return "/dashboard";
  if (normalized === "onboarding") return "/onboarding";
  if (normalized === "merchant") return "/merchant";
  if (normalized === "admin") return "/admin";
  return "/";
}
