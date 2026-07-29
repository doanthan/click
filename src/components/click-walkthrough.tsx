"use client";

import { Fragment, useRef, useState, useSyncExternalStore } from "react";
import { Pill } from "@/components/click-ui";
import { formatIntent } from "@/lib/click-data";

// ---------------------------------------------------------------------------
// /test-click - interactive walkthrough of the click mechanic.
//
// This is an EXPLAINER, not a live surface. Every card below is a STATIC,
// representative clone of a real component (no server actions, no DB) so the
// page mirrors the COPY + BEHAVIOUR users actually see. Demo data is obviously
// fake; the visual palette here can drift from the live DS - mirror the words
// and the flow, not the pixels. If you change a real click surface, mirror it.
// Sources:
//   • Step 1 card        → src/components/click-with-someone-user-card.tsx
//   • Entry-point B card → src/components/post-event-click-card.tsx
//   • Steps 2 & 5 card   → the "it's mutual" MomentBanner in src/app/dashboard/page.tsx
//   • Steps 3 / 4 cards  → src/components/coordination-drawer.tsx (opened from clicks-list.tsx)
// The mechanic itself lives in createUserClickForSession / getMutualClicksForSession
// / the proposals flow in src/lib/event-repository.ts. Timers: src/lib/clicks/constants.ts.
// ---------------------------------------------------------------------------

const EYEBROW =
  "font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]";

// Referentially-stable no-op subscribe for the hydration flag (see ClickWalkthrough).
const noopSubscribe = () => () => {};

const DEMO = {
  person: {
    initials: "MR",
    name: "Maya R.",
    meta: "Newtown · 29",
    intents: ["new_in_town", "weekend_coffee", "live_music"],
    shared: ["Live Jazz", "Pottery", "Brunch", "Hiking"],
  },
  postEvent: {
    title: "Rooftop Vinyl & Negronis",
    endedLabel: "12 Jun",
    coAttendees: [
      { name: "Jordan T.", suburb: "Surry Hills" },
      { name: "Priya N.", suburb: "Erskineville" },
    ],
  },
  mutual: {
    other: "Maya",
    event: "Sunset Pottery Social",
    dateLabel: "Sat 26 Jul", // event is weeks out…
    expiresLabel: "Sun 13 Jul", // …but the plan winds down 7 days after you clicked
  },
};

const POST_EVENT_HELP =
  "Tap anyone you’d like to see again. It’s completely private - they only ever hear about it if they click you back.";
const CONFIRMED_HELP = `RSVP to the event below. ${DEMO.mutual.other} needs to RSVP too - you’re only going together once you both have a seat.`;

// --- Faithful static card clones -------------------------------------------

function DemoClickCard({ sent = false }: { sent?: boolean }) {
  return (
    <article className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] font-bold text-[color:var(--surface-deep)]">
          {DEMO.person.initials}
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-display block truncate text-2xl font-semibold leading-tight text-[color:var(--ink)]">
            {DEMO.person.name}
          </span>
          <p className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            {DEMO.person.meta}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {DEMO.person.intents.map((intent) => (
          <Pill key={intent} tone="cream">
            {formatIntent(intent)}
          </Pill>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-3">
        <span className={EYEBROW}>Shared interests</span>
        <p className="mt-1 text-sm font-bold text-[color:var(--ink)]">
          {DEMO.person.shared.join(" · ")}
        </p>
      </div>

      <div className="mt-5">
        <span
          className={`block w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-4 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm ${
            sent ? "opacity-70" : ""
          }`}
        >
          {sent ? "clicked - pending their click back" : `click with ${DEMO.person.name.split(" ")[0]}`}
        </span>
      </div>
    </article>
  );
}

function DemoPostEventCard() {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-5 hard-shadow-sm">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        You were there · {DEMO.postEvent.endedLabel}
      </p>
      <h3 className="font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
        Did you click with anyone at{" "}
        <span className="text-[color:var(--coral)]">{DEMO.postEvent.title}</span>?
      </h3>
      <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--ink)]/80">
        {POST_EVENT_HELP}
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {DEMO.postEvent.coAttendees.map((person) => (
          <li
            key={person.name}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--ink)]">
              {person.name}
              <span className="ml-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-[color:var(--mauve)]">
                · {person.suburb}
              </span>
            </span>
            <span className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)]">
              click with {person.name.split(" ")[0]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemoMutualCard({ celebrate = false }: { celebrate?: boolean }) {
  return (
    <div className="flex flex-col rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)] p-5 text-[color:var(--surface-deep)] hard-shadow-sm">
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] opacity-80">
        {celebrate ? "you're going together" : "it's mutual"}
      </p>
      <span className="font-display mt-1 text-2xl font-semibold leading-tight">
        You clicked with {DEMO.mutual.other}. ✨
      </span>
      {celebrate ? (
        <p className="mt-2 text-sm font-bold leading-6">
          🎉 You and {DEMO.mutual.other} both have a seat at{" "}
          <span className="underline decoration-2 underline-offset-4">{DEMO.mutual.event}</span>.
          See you there.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold leading-6">
            Find something you&rsquo;d both enjoy and meet there. We&rsquo;ve lined up{" "}
            <span className="font-bold underline decoration-2 underline-offset-4">
              {DEMO.mutual.event}
            </span>{" "}
            to start - confirm it together, or suggest another.
          </p>
          <span className="mt-3 inline-flex w-fit items-center rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--champagne)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm">
            See your plan →
          </span>
        </>
      )}
    </div>
  );
}

function DemoProposalCard() {
  return (
    <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <p className={EYEBROW}>You + {DEMO.mutual.other}</p>
      <h3 className="font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[color:var(--ink)]">
        Here&rsquo;s a plan: <span className="text-[color:var(--purple)]">{DEMO.mutual.event}</span>
      </h3>
      <p className="mt-1 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {DEMO.mutual.dateLabel}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm">
          Confirm this plan
        </span>
        <span className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)]">
          Suggest alternative
        </span>
      </div>

      <div className="mt-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4">
        <span className="block font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
          Choose from the Click catalogue
        </span>
        <div className="mt-2 flex w-full items-center justify-between rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)]">
          Pick an event… <span aria-hidden>▾</span>
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-[color:var(--mauve)]">
          A dropdown of real events - not a message box. There&rsquo;s no free text anywhere in a
          plan.
        </p>
      </div>
    </div>
  );
}

function DemoConfirmedCard() {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-4">
      <p className="text-sm font-bold text-[color:var(--ink)]">You&rsquo;re in - now lock in your seat.</p>
      <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--ink)]/80">{CONFIRMED_HELP}</p>
      <span className="mt-3 inline-flex rounded-full border-2 border-[color:var(--surface-deep)] bg-[color:var(--rose)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm">
        RSVP to {DEMO.mutual.event} →
      </span>
    </div>
  );
}

// --- Shared step annotation -------------------------------------------------

function Annotation({
  trigger,
  youSee,
  theySee,
  clock,
}: {
  trigger: string;
  youSee: string;
  theySee: string;
  clock: string;
}) {
  const cells = [
    { label: "Trigger", body: trigger, emphasize: false },
    { label: "What you see", body: youSee, emphasize: false },
    { label: "What they see", body: theySee, emphasize: true },
    { label: "The clock", body: clock, emphasize: false },
  ];
  return (
    <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={`rounded-2xl border-2 p-4 ${
            cell.emphasize
              ? "border-[color:var(--rose)] bg-[color:var(--lav-bg)]"
              : "border-[color:var(--line)] bg-[color:var(--cream)]"
          }`}
        >
          <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
            {cell.label}
          </dt>
          <dd className="mt-2 text-sm font-semibold leading-6 text-[color:var(--ink)]">
            {cell.body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StepHeader({ n, label, blurb }: { n: string; label: string; blurb: string }) {
  return (
    <div className="mb-5">
      <p className={EYEBROW}>
        Step {n} · {label}
      </p>
      <h3 className="font-display mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-3xl">
        {blurb}
      </h3>
    </div>
  );
}

// --- State-machine diagram --------------------------------------------------

type NodeTint = "lav" | "rose" | "peach";

const NODES: { n: string; label: string; tint: NodeTint; sub?: string }[] = [
  { n: "1", label: "Private pending", tint: "lav" },
  { n: "2", label: "Mutual", tint: "rose" },
  { n: "3", label: "Plan open", tint: "peach" },
  { n: "4", label: "Confirmed", tint: "peach", sub: "RSVP needed" },
  { n: "5", label: "Both going", tint: "rose" },
];

const GATES = ["they click you back", "auto-opens", "one tap · either of you", "you BOTH hold a seat"];

const DEAD_ENDS = [
  { from: "From Private pending", text: "No reply → the click expires in 7 days, silently." },
  { from: "From the plan", text: "7 days, no confirm → the plan winds down; cross paths again to pick it up." },
  { from: "From the plan / confirmed", text: "Event sold out → “pick another together”." },
];

const LEGEND = [
  { swatch: "bg-[color:var(--lav-bg)]", label: "private" },
  { swatch: "bg-[color:var(--rose)]", label: "live / mutual" },
  { swatch: "bg-[color:var(--peach)]", label: "action needed" },
  { swatch: "bg-[color:var(--champagne-deep)]", label: "ended" },
];

const CLOCKS = ["2h post-event gate", "7-day click", "7-day proposal"];

function nodeTintClass(tint: NodeTint) {
  if (tint === "rose") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  if (tint === "peach") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--lav-bg)] text-[color:var(--ink)]";
}

// --- Step bodies ------------------------------------------------------------

const STEPS = [
  {
    n: "01",
    label: "Private pending",
    blurb: "You tap. They have no idea.",
    body: (
      <>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border-2 border-[color:var(--rose)] bg-[color:var(--lav-bg)] p-5">
            <p className={EYEBROW}>Your screen</p>
            <p className="mb-4 mt-2 text-sm font-bold text-[color:var(--ink)]">
              You tapped - this is exactly what you see:
            </p>
            <DemoClickCard sent />
          </div>
          <div className="rounded-3xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne)] p-5">
            <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              Their screen · meanwhile
            </p>
            <div className="mt-4 grid min-h-[220px] place-items-center rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)]/50 p-6 text-center">
              <div>
                <p className="font-display text-3xl font-semibold text-[color:var(--mauve)]">Nothing.</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                  No notification. No badge. No idea. They only ever find out if they click you back.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Annotation
          trigger="You tap “click with [name]” - on your dashboard, the people page, or a post-event prompt."
          youSee="The button flips to a muted “clicked - pending their click back”."
          theySee="Nothing - they are never told. It only surfaces if they click you back."
          clock="Stored as pending; auto-expires after 7 days."
        />
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill tone="cream">Can&rsquo;t click with yourself</Pill>
          <Pill tone="cream">Blocking stops new clicks &amp; hides you in discovery</Pill>
          <Pill tone="peach">100% private &amp; anonymous</Pill>
        </div>
      </>
    ),
  },
  {
    n: "02",
    label: "Mutual",
    blurb: "They tap you back. Both sides light up.",
    body: (
      <>
        <DemoMutualCard />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            "Both of your clicks flip to “mutual”.",
            "We auto-suggest a future, still-bookable event around a shared interest - suiting both of you where it can, otherwise something one of you is into. Soonest first, ideally one neither has RSVP’d to.",
            "A 7-day plan window opens automatically.",
          ].map((text, i) => (
            <div
              key={i}
              className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4"
            >
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
                Auto · {i + 1}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--ink)]">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-4 text-sm font-semibold leading-6 text-[color:var(--ink)]">
          You both get an in-app notification - “It&rsquo;s mutual - you clicked with [Name]. ✨” - that
          opens your plan on <code>/proposals</code>, plus a mutual-click email. It&rsquo;s the first time
          anyone is notified at all. <strong>No chat opens - ever.</strong>
        </p>
        <Annotation
          trigger="The moment they also click you (their pending click already existed)."
          youSee="A bright “it’s mutual” card on your dashboard, and the plan waiting on /proposals."
          theySee="Exactly the same - both sides light up at once."
          clock="A 7-day plan window opens."
        />
        <p className="mt-4 rounded-2xl border-2 border-[color:var(--rose)] bg-[color:var(--lav-bg)] p-4 text-center font-display text-xl font-bold tracking-[-0.01em] text-[color:var(--ink)]">
          A mutual unlocks a PLAN, never a chat.
        </p>
      </>
    ),
  },
  {
    n: "03",
    label: "Coordinate",
    blurb: "You coordinate with taps - there is no chat.",
    body: (
      <>
        <div className="mx-auto max-w-xl">
          <DemoProposalCard />
        </div>
        <Annotation
          trigger="Either of you opens the plan from the mutual card or your /proposals list."
          youSee="The plan above - tap the row on /proposals to open it."
          theySee="The same - either of you can confirm, or suggest another."
          clock="The 7-day window runs from when you clicked - not the event date."
        />
        <p className="mt-4 rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--cream)] p-4 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
          The 7-day clock runs from when you <strong>clicked</strong> - not from the event date (the
          event can be weeks later). If it lapses, the plan quietly <strong>winds down</strong> - it’s
          not gone. Cross paths again, or suggest another plan, and you can pick it back up.
        </p>
      </>
    ),
  },
  {
    n: "04",
    label: "Confirm",
    blurb: "Confirming the plan is not the booking.",
    body: (
      <>
        <div className="mx-auto max-w-xl">
          <DemoConfirmedCard />
        </div>
        <p className="mt-4 rounded-2xl border-2 border-[color:var(--rose)] bg-[color:var(--lav-bg)] p-4 text-center font-display text-xl font-bold tracking-[-0.01em] text-[color:var(--ink)]">
          Confirming the plan ≠ holding a seat.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill tone="cream">Free event → free RSVP</Pill>
          <Pill tone="cream">Paid event → Stripe checkout</Pill>
          <Pill tone="peach">A claimed guest +1 also counts</Pill>
        </div>
        <Annotation
          trigger="One of you taps “Confirm this plan” - only possible while the suggested event is still bookable. If it sold out, you Suggest an alternative first."
          youSee="An “RSVP needed” card pointing you to the event."
          theySee="The same - they’re nudged to RSVP too."
          clock="No new timer - you just both need a seat."
        />
      </>
    ),
  },
  {
    n: "05",
    label: "Both going",
    blurb: "Two seats held. You’re going together.",
    body: (
      <>
        <div className="mx-auto max-w-xl">
          <DemoMutualCard celebrate />
        </div>
        <p className="mt-4 text-center text-sm font-semibold leading-6 text-[color:var(--mauve)]">
          Reached only when you both hold a confirmed seat (or a claimed guest +1) for the same
          upcoming event.
        </p>
        <Annotation
          trigger="You both complete a real RSVP for the same upcoming event."
          youSee="The celebration on your dashboard, and a “Both going” row on /proposals - computed live from your RSVPs, not from anyone tapping Confirm."
          theySee="The same - it celebrates on their dashboard too, at the same time."
          clock="No timer. You’re going. 🎉"
        />
      </>
    ),
  },
];

// --- Main component ---------------------------------------------------------

export function ClickWalkthrough() {
  // True only after client hydration - without JS the page renders all five
  // steps stacked (a readable static walkthrough); once hydrated it collapses
  // to the interactive stepper. useSyncExternalStore gives us this flag with no
  // setState-in-effect (which the repo's react-hooks lint forbids).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [active, setActive] = useState(0);
  const stepperRef = useRef<HTMLDivElement | null>(null);

  const last = STEPS.length - 1;

  function goToStep(i: number, scroll = false) {
    const next = Math.max(0, Math.min(last, i));
    setActive(next);
    if (scroll && stepperRef.current) {
      stepperRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function onStepperKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((a) => Math.min(last, a + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    }
  }

  return (
    <>
      {/* Section 2 - the whole flow at a glance */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className={EYEBROW}>The whole flow at a glance</p>
          <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
            One private tap → a mutual → a plan.
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            Post-event clicks open 2 hours after the event ends; discovery clicks work anytime.
            Tap any stage to jump to it.
          </p>

          <div className="mt-8 rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm sm:p-7">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {NODES.map((node, i) => (
                <Fragment key={node.n}>
                  <button
                    type="button"
                    onClick={() => goToStep(i, true)}
                    aria-current={active === i ? "step" : undefined}
                    className={`flex flex-1 flex-col rounded-2xl border-2 p-4 text-left hard-shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 ${nodeTintClass(
                      node.tint,
                    )} ${
                      active === i
                        ? "border-[color:var(--ink)] ring-2 ring-[color:var(--ink)]"
                        : "border-[color:var(--line)]"
                    }`}
                  >
                    <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] opacity-80">
                      {node.n}
                    </span>
                    <span className="font-display mt-1 text-lg font-semibold leading-tight">
                      {node.label}
                    </span>
                    {node.sub ? (
                      <span className="mt-2 inline-flex w-fit rounded-full border border-[color:var(--surface-deep)]/30 bg-[color:var(--champagne)]/60 px-2 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em]">
                        {node.sub}
                      </span>
                    ) : null}
                  </button>

                  {i < NODES.length - 1 ? (
                    <div className="flex shrink-0 items-center justify-center gap-2 lg:w-28 lg:flex-col lg:justify-center">
                      <span aria-hidden className="text-[color:var(--coral)] lg:hidden">
                        ↓
                      </span>
                      <span aria-hidden className="hidden text-[color:var(--coral)] lg:inline">
                        →
                      </span>
                      <span className="text-center font-mono text-[0.6rem] font-bold uppercase leading-tight tracking-[0.1em] text-[color:var(--mauve)]">
                        {GATES[i]}
                      </span>
                    </div>
                  ) : null}
                </Fragment>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {DEAD_ENDS.map((dead) => (
                <div
                  key={dead.from}
                  className="rounded-2xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--champagne-deep)] p-3"
                >
                  <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    {dead.from}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[color:var(--mauve)]">
                    {dead.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-[color:var(--line)] pt-5">
              {LEGEND.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span
                    className={`size-3 rounded-full border border-[color:var(--line)] ${item.swatch}`}
                  />
                  <span className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[color:var(--mauve)]">
                    {item.label}
                  </span>
                </span>
              ))}
              <span className="ml-auto flex flex-wrap gap-1.5">
                {CLOCKS.map((clock) => (
                  <span
                    key={clock}
                    className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[color:var(--ink)]"
                  >
                    ⏱ {clock}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - two ways to start a click */}
      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className={EYEBROW}>Two ways to start a click</p>
          <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
            Two doors, one outcome.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
              <p className={EYEBROW}>Discovery · anytime</p>
              <h3 className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em]">
                click with someone
              </h3>
              <p className="mb-4 mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                On your dashboard (one rotating suggestion) and the People page (the full list, ranked by
                how well you click - shared interests plus your click profile). No need to have met.
              </p>
              <DemoClickCard />
            </div>
            <div className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--cream)] p-5 hard-shadow-sm">
              <p className={EYEBROW}>After an event · gated</p>
              <h3 className="font-display mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em]">
                Who did you click with?
              </h3>
              <p className="mb-4 mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                Appears 2 hours after an event you attended ends, listing confirmed co-attendees you
                haven&rsquo;t clicked yet. You must both have been confirmed attendees.
              </p>
              <DemoPostEventCard />
            </div>
          </div>
          <p className="mt-5 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--lav-bg)] p-4 text-center text-sm font-bold text-[color:var(--ink)]">
            Either door leads to the same private pending click - that&rsquo;s the walkthrough below.
          </p>
        </div>
      </section>

      {/* Section 4 - the interactive stepper */}
      <section
        ref={stepperRef}
        className="scroll-mt-4 border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-14 sm:px-6"
      >
        <div className="mx-auto max-w-5xl">
          <p className={EYEBROW}>Step by step</p>
          <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
            Walk one click, end to end.
          </h2>

          {/* Sticky pill bar - interactive only once hydrated. Without JS, all
              five steps render stacked below (a readable static walkthrough). */}
          {mounted ? (
            <div className="sticky top-2 z-20 mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)]/95 p-3 backdrop-blur hard-shadow-sm">
              {/* Arrow keys move steps while a pill is focused - scoped here so it
                  never swallows arrow-key scrolling elsewhere on the page. */}
              <div className="flex gap-2 overflow-x-auto" onKeyDown={onStepperKeyDown}>
                {STEPS.map((step, i) => {
                  const state = i === active ? "active" : i < active ? "done" : "future";
                  return (
                    <button
                      key={step.n}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-current={state === "active" ? "step" : undefined}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-[color:var(--line)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                        state === "active"
                          ? "bg-[color:var(--rose)] text-[color:var(--surface-deep)] hard-shadow-sm"
                          : state === "done"
                            ? "bg-[color:var(--peach)] text-[color:var(--surface-deep)]"
                            : "bg-[color:var(--cream)] text-[color:var(--mauve)]"
                      }`}
                    >
                      <span>{state === "done" ? "✓" : step.n}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:var(--line)]">
                <div
                  className="h-full rounded-full bg-[color:var(--rose)] transition-[width]"
                  style={{ width: `${((active + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-10">
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                role="group"
                aria-label={`Step ${step.n}: ${step.label}`}
                className={mounted && active !== i ? "hidden" : ""}
              >
                <StepHeader n={step.n} label={step.label} blurb={step.blurb} />
                {step.body}
              </div>
            ))}
          </div>

          {mounted ? (
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
                className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hover:bg-[color:var(--peach)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Back
              </button>
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                {active + 1} / {STEPS.length}
              </span>
              {active < last ? (
                <button
                  type="button"
                  onClick={() => setActive((a) => Math.min(last, a + 1))}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goToStep(0, true)}
                  className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
                >
                  ↺ Start over
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
