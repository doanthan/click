import Link from "next/link";
import { getEventsForExplore } from "@/lib/event-repository";
import SupabaseLogDrawer from "./SupabaseLogDrawer";

export const metadata = {
  title: "Test personas | Click",
  description: "Jump into the key journeys for each kind of Click user.",
};

type Step = { href: string; label: string };

type Story = {
  title: string;
  description: string;
  steps: Step[];
};

type Persona = {
  name: string;
  tagline: string;
  // Tailwind utility classes for the persona's accent header.
  accent: string;
  stories: Story[];
};

export default async function TestPage() {
  const events = await getEventsForExplore();
  const sampleSlug = events[0]?.id ?? "sample-event";
  const sampleTitle = events[0]?.title ?? "an event";

  const personas: Persona[] = [
    {
      name: "Customer",
      tagline: "Browse events, book a spot, and Click with someone.",
      accent: "bg-[color:var(--rose)] text-[color:var(--surface-deep)]",
      stories: [
        {
          title: "Sign up process",
          description:
            "Create an account, finish the attendee profile, and land on the dashboard.",
          steps: [
            { href: "/register", label: "Register" },
            { href: "/onboarding", label: "Onboarding" },
            { href: "/dashboard", label: "Dashboard" },
          ],
        },
        {
          title: "View events",
          description:
            "Browse the live events grid, then open one for the full detail page.",
          steps: [
            { href: "/events", label: "Events grid" },
            { href: `/events/${sampleSlug}`, label: `Detail — ${sampleTitle}` },
          ],
        },
        {
          title: "Book an event",
          description:
            "RSVP (or Reserve & pay) on the detail page, then find it in confirmed events and the calendar.",
          steps: [
            { href: `/events/${sampleSlug}`, label: "RSVP / pay" },
            { href: "/confirmed-events", label: "Confirmed" },
            { href: "/dashboard/calendar", label: "Calendar" },
          ],
        },
        {
          title: "Save events",
          description:
            "Tap Save on an event to bookmark it, then find it in your saved list.",
          steps: [
            { href: `/events/${sampleSlug}`, label: "Save event" },
            { href: "/bookmarks", label: "Saved" },
          ],
        },
        {
          title: "Click with another user",
          description:
            "See suggested people, Click privately, and watch for a mutual match.",
          steps: [{ href: "/people", label: "People" }],
        },
        {
          title: "Messages",
          description:
            "A mutual Click opens a conversation — chat with your match.",
          steps: [
            { href: "/people", label: "Mutual Click" },
            { href: "/messages", label: "Messages" },
          ],
        },
      ],
    },
    {
      name: "Merchant",
      tagline: "Become a host, list events, and fill seats.",
      accent: "bg-[color:var(--peach)] text-[color:var(--surface-deep)]",
      stories: [
        {
          title: "Sign up process",
          description:
            "Submit the merchant profile to get promoted from attendee to host.",
          steps: [
            { href: "/merchant/signup", label: "Merchant signup" },
            { href: "/merchant", label: "Merchant dashboard" },
          ],
        },
        {
          title: "Create & manage events",
          description:
            "Create an event (starts Pending) and review its attendee list.",
          steps: [
            { href: "/merchant/events/create", label: "Create event" },
            { href: "/merchant", label: "Your events" },
          ],
        },
        {
          title: "Click with another user",
          description: "Hosts are people too — find and Click with someone.",
          steps: [{ href: "/people", label: "People" }],
        },
      ],
    },
    {
      name: "Admin",
      tagline: "Keep the platform clean and trustworthy.",
      accent: "bg-[color:var(--ink)] text-[color:var(--champagne)]",
      stories: [
        {
          title: "Dashboard",
          description:
            "Platform totals, the pending-events queue, and the audit log.",
          steps: [{ href: "/admin", label: "Admin console" }],
        },
        {
          title: "Approve merchants",
          description:
            "Review pending merchants and flip verification to approved.",
          steps: [{ href: "/admin", label: "Merchant review" }],
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-6xl">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          QA personas
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
            Test by <span className="italic text-[color:var(--rose)]">who</span>.
          </h1>
          <SupabaseLogDrawer />
        </div>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[color:var(--mauve)]">
          Pick a persona and walk its key journeys. Each step opens in a new tab;
          open the Supabase log to confirm the writes landed.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {personas.map((persona) => (
            <section
              key={persona.name}
              className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm"
            >
              <header
                className={`-mx-5 -mt-5 mb-5 rounded-t-3xl border-b-2 border-[color:var(--line)] px-5 py-4 ${persona.accent}`}
              >
                <h2 className="font-display text-3xl font-light leading-tight">
                  {persona.name}
                </h2>
                <p className="mt-1 text-sm font-medium leading-5 opacity-90">
                  {persona.tagline}
                </p>
              </header>

              <ul className="grid gap-4">
                {persona.stories.map((story) => (
                  <li
                    key={story.title}
                    className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4"
                  >
                    <h3 className="font-bold text-[color:var(--ink)]">
                      {story.title}
                    </h3>
                    <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--mauve)]">
                      {story.description}
                    </p>
                    <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                      {story.steps.map((step, idx) => (
                        <li key={step.href + idx} className="flex items-center gap-1.5">
                          {idx > 0 ? (
                            <span aria-hidden className="text-[color:var(--mauve)]">
                              →
                            </span>
                          ) : null}
                          <Link
                            href={step.href}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[color:var(--ink)] transition hover:border-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-[color:var(--champagne)]"
                          >
                            {step.label} ↗
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--mauve)]/40">
          ✷ doan is the best ✷
        </p>
      </section>
    </main>
  );
}
