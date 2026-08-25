"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/ds";

/**
 * The two platform-wide switches on /admin/system, actually rendered.
 *
 * Both settings existed, saved, and confirmed "System settings saved" while
 * having no consumer anywhere in the app - nothing read `maintenance_mode` and
 * nothing read `marketing_banner`. This is what they now do.
 *
 * WHY THIS IS A CLIENT COMPONENT. The maintenance curtain has to spare a few
 * routes (an admin has to be able to sign in to turn it off again), and the
 * root layout cannot see the pathname - a layout is not re-rendered per
 * navigation and `next/headers` does not carry the route. usePathname does.
 * The settings themselves are still read on the server and passed down, so no
 * database work moves into the browser.
 *
 * WHAT THE CURTAIN IS AND IS NOT. It is an availability notice: visitors get a
 * full-screen "back shortly" instead of the app. It is NOT an authorization
 * boundary - the page behind it still renders on the server, and a scripted
 * POST straight at an API route is unaffected. The copy on /admin/system says
 * exactly this, because a switch that overstates itself is the failure being
 * fixed here.
 */

/**
 * Routes that must stay reachable while the curtain is up.
 *
 * "/auth" is the whole second half of signing in, not a nicety: /login only
 * MAILS a token, and the token is spent by the form on /auth/email/verify. With
 * that path curtained, the "Continue securely" button sits under a fixed inset-0
 * overlay, the link expires unused, and a fresh one lands in the same place -
 * so an admin could switch maintenance on and then have no way to switch it off.
 * This list dates from when /login held a password form and finished the job.
 *
 * "/logout" was in here and is not a route in this app - NextAuth's sign-out
 * lives under /api, which is already exempt.
 */
const MAINTENANCE_EXEMPT = ["/admin", "/login", "/auth", "/api"];

function isExempt(pathname: string) {
  return MAINTENANCE_EXEMPT.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function SiteNotices({
  maintenance,
  banner,
  viewerIsAdmin,
}: {
  maintenance: boolean;
  banner: string;
  viewerIsAdmin: boolean;
}) {
  const pathname = usePathname() ?? "/";

  if (maintenance && !viewerIsAdmin && !isExempt(pathname)) {
    return <MaintenanceCurtain />;
  }

  return (
    <>
      {maintenance && viewerIsAdmin ? <AdminMaintenanceStrip /> : null}
      {banner ? <MarketingBanner text={banner} /> : null}
    </>
  );
}

function MaintenanceCurtain() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[color:var(--champagne)] px-4 py-16">
      <section
        role="status"
        className="w-full max-w-lg rounded-2xl bg-[color:var(--paper)] p-8 text-center shadow-[var(--shadow-sm)] sm:p-10"
      >
        <div className="flex justify-center">
          <Logo size={34} />
        </div>
        <span className="eyebrow mt-6 block">Back shortly</span>
        <h1 className="font-display mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
          We&rsquo;re making Click better.
        </h1>
        <p className="mt-4 text-base leading-7 text-[color:var(--slate)]">
          Click is down for a short spell of maintenance. Your bookings and your clicks are
          safe - nothing has been cancelled. Try again in a few minutes.
        </p>
        <p className="mt-6 text-sm text-[color:var(--slate)]">
          Need something urgently?{" "}
          <a href="mailto:hello@letsclick.app" className="font-semibold underline">
            hello@letsclick.app
          </a>
        </p>
      </section>
    </div>
  );
}

/**
 * Admins do not get the curtain, which means without this they would have no
 * way to tell the site is offline for everyone else. The one state where a
 * status colour on a full-width strip is the honest choice.
 */
function AdminMaintenanceStrip() {
  return (
    <div className="w-full bg-[color:color-mix(in_srgb,var(--amber)_18%,var(--paper))] px-4 py-2.5 text-center">
      <p className="text-[13px] font-semibold leading-5 text-[color:var(--amber-ink)]">
        Maintenance mode is on. Visitors see a &ldquo;back shortly&rdquo; screen; you do not.{" "}
        <Link href="/admin/system" className="underline underline-offset-2">
          Turn it off
        </Link>
      </p>
    </div>
  );
}

/**
 * localStorage as an external store, read through useSyncExternalStore.
 *
 * Not useState + useEffect: reading storage in an effect and calling setState
 * is a cascading render React now lints against, and reading it in a useState
 * initialiser would differ from the server's render and blow up hydration.
 * useSyncExternalStore is the primitive for exactly this - `false` is the
 * server snapshot, so the banner renders server-side and disappears on the
 * first client pass if this viewer had already dismissed it.
 *
 * `dismissedListeners` also lets a second banner instance (or another tab, via
 * the storage event) react to a dismissal without prop-drilling.
 */
const dismissedListeners = new Set<() => void>();

function subscribeToDismissal(onChange: () => void) {
  dismissedListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    dismissedListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function announceDismissal() {
  for (const listener of dismissedListeners) listener();
}

/**
 * Dismissal is keyed to the message itself, so editing the banner shows it
 * again to someone who dismissed the previous one - and re-saving the same text
 * does not. Every access is wrapped: a private window or a browser set to block
 * site data throws on the accessor itself, and the banner must still render.
 */
function MarketingBanner({ text }: { text: string }) {
  const storageKey = `click.banner.dismissed.${text}`;

  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    () => {
      try {
        return window.localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );

  if (dismissed) return null;

  return (
    <div className="w-full bg-[color:var(--lav-bg)] px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3">
        <p className="text-[13px] font-medium leading-5 text-[color:var(--ink)]">{text}</p>
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(storageKey, "1");
            } catch {
              // A viewer who blocks site data just sees it again next page. Fine.
            }
            // Re-reads the snapshot above. When the write threw, the snapshot
            // is still false and the banner correctly stays put rather than
            // pretending a preference was saved.
            announceDismissal();
          }}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded-lg px-1.5 text-lg leading-none text-[color:var(--slate)] transition-colors hover:text-[color:var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
