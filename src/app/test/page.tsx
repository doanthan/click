import Link from "next/link";
import { getEventsForExplore } from "@/lib/event-repository";

export const metadata = {
  title: "Test routes | Click",
  description: "Index of every page in the app for manual QA.",
};

type RouteSpec = {
  href: string;
  label: string;
  notes: string;
  auth?: "none" | "user" | "merchant" | "admin";
};

function authBadge(auth: RouteSpec["auth"]) {
  if (!auth || auth === "none") {
    return { label: "Public", className: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]" };
  }
  if (auth === "user") {
    return { label: "Logged in", className: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]" };
  }
  if (auth === "merchant") {
    return { label: "Merchant", className: "bg-[color:var(--cream)] text-[color:var(--ink)]" };
  }
  return { label: "Admin", className: "bg-[color:var(--ink)] text-[color:var(--champagne)]" };
}

export default async function TestPage() {
  const events = await getEventsForExplore();
  const sampleSlug = events[0]?.id ?? "sample-event";

  const groups: { heading: string; routes: RouteSpec[] }[] = [
    {
      heading: "Public",
      routes: [
        { href: "/", label: "Home", notes: "Landing page with hero + AI prompt." },
        { href: "/events", label: "Events grid", notes: "Browse all live events." },
        {
          href: `/events/${sampleSlug}`,
          label: "Event detail (sample)",
          notes: `Detail page for "${events[0]?.title ?? sampleSlug}".`,
        },
        { href: "/discover", label: "Discover", notes: "AI prompt + recommendations." },
        { href: "/login", label: "Login", notes: "OAuth + credentials sign-in." },
        { href: "/forgot-password", label: "Forgot password", notes: "Password reset flow." },
      ],
    },
    {
      heading: "Logged-in user",
      routes: [
        {
          href: "/dashboard",
          label: "Dashboard",
          notes: "RSVPs, saved events, onboarding nudges.",
          auth: "user",
        },
        {
          href: "/dashboard/calendar",
          label: "Booking calendar",
          notes: "Month-grid of your booked events.",
          auth: "user",
        },
        {
          href: "/onboarding",
          label: "Onboarding",
          notes: "Profile completion (suburb, intents, tags).",
          auth: "user",
        },
      ],
    },
    {
      heading: "Merchant / host",
      routes: [
        {
          href: "/merchant/signup",
          label: "Merchant signup",
          notes: "Become a host.",
          auth: "user",
        },
        {
          href: "/merchant",
          label: "Merchant dashboard",
          notes: "Calendar + events panel + create form.",
          auth: "merchant",
        },
        {
          href: `/merchant/events/${sampleSlug}`,
          label: "Merchant event detail (sample)",
          notes: "Attendee list. Only opens for events you own.",
          auth: "merchant",
        },
      ],
    },
    {
      heading: "Admin",
      routes: [
        {
          href: "/admin",
          label: "Admin console",
          notes: "Approve pending events, review merchants.",
          auth: "admin",
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          QA index
        </p>
        <h1 className="font-display mt-4 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          Test <span className="italic text-[color:var(--rose)]">every page</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          One link per route. Click through to spot-check renders, auth gates,
          and empty states.
        </p>

        <div className="mt-10 grid gap-8">
          {groups.map((group) => (
            <section key={group.heading}>
              <h2 className="font-display text-3xl font-light leading-tight">
                {group.heading}
              </h2>
              <ul className="mt-4 grid gap-3">
                {group.routes.map((route) => {
                  const badge = authBadge(route.auth);
                  return (
                    <li
                      key={route.href}
                      className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-4 hard-shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                          href={route.href}
                          className="font-display text-2xl font-light leading-tight text-[color:var(--ink)] hover:underline"
                        >
                          {route.label}
                        </Link>
                        <span
                          className={`rounded-full border-2 border-[color:var(--line)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                        {route.href}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
                        {route.notes}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section>
            <h2 className="font-display text-3xl font-light leading-tight">API routes</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--mauve)]">
              Server-only — no page to open. Listed for reference.
            </p>
            <ul className="mt-4 grid gap-2 font-mono text-xs font-bold text-[color:var(--ink)]">
              <li>POST /api/events/[eventId]/register</li>
              <li>DELETE /api/events/[eventId]/register</li>
              <li>POST /api/events/[eventId]/bookmark</li>
              <li>POST /api/events/[eventId]/checkout</li>
              <li>POST /api/webhooks/stripe</li>
              <li>POST /api/merchant</li>
              <li>POST /api/onboarding</li>
              <li>POST /api/admin/events/[eventId]/approve</li>
              <li>GET /api/events</li>
              <li>* /api/auth/[...nextauth]</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
