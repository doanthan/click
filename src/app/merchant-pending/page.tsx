import Link from "next/link";
import { auth } from "@/auth";
import {
  assertProfileStatusUsable,
  getMerchantEvents,
  getProfileStatus,
} from "@/lib/event-repository";
import { PILOT_AREA_LABEL, isWithinSydneyPilot } from "@/lib/geo";

const upcomingDateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

// Spec §1 post-submission holding page. Shown to merchants whose application
// has landed but isn't yet approved by admin (verification_status='pending').
// The /merchant portal is gated until status='approved'. Anyone who isn't a
// pending/rejected merchant gets a clear access-denied state (no silent
// redirect) so the page never just "vanishes".

export const metadata = {
  title: "Application received",
  description:
    "Your Click host application is being reviewed. Here's what to prepare while you wait.",
};

function AccessDenied({
  reason,
  showHostCta,
}: {
  reason: string;
  // When the visitor has no application on file, point them INTO the host
  // onboarding funnel instead of leaving "Back to Click" as the only exit -
  // "Host an event" should always lead to merchant onboarding, never a dead end.
  showHostCta?: boolean;
}) {
  return (
    <main className="paper-noise grid min-h-screen place-items-center bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-[18px] bg-[color:var(--paper)] p-8 text-center shadow-[var(--shadow-sm)] sm:p-10">
        <span className="sticker sticker--rose inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--champagne)]" />
          No access
        </span>
        <h1 className="font-display mt-6 text-4xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
          {showHostCta ? "Want to host on Click?" : "You don’t have access to this page."}
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--slate)]">
          {reason}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {showHostCta ? (
            <Link href="/merchant/signup" className="ck-btn ck-btn--primary ck-btn--md">
              Start hosting →
            </Link>
          ) : null}
          <Link href="/" className="ck-btn ck-btn--secondary ck-btn--md">
            ← Back to Click
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function MerchantPendingPage() {
  const session = await auth();
  const status = session?.user ? await getProfileStatus(session) : null;
  // A failed profile read reports merchantProfile: null, and the branch below
  // reads a null profile as "this person has never applied" - so one transient
  // blip told a PENDING applicant, on the page whose whole job is holding their
  // application, that they had not applied and should go and start one. That
  // second application is an upsert over their real record.
  //
  // getProfileStatus already distinguishes the two: `degraded` means "we could
  // not find out", not "there is nothing". Every merchant layout fails loudly on
  // it through this same helper, and this page is the one those layouts redirect
  // INTO, so it has to hold the same line. Throws into error.tsx next door,
  // which offers a retry rather than a form.
  if (status) assertProfileStatusUsable(status);
  const merchantProfile = status?.merchantProfile ?? null;

  // 'suspended' belongs here too. It used to fall through to the else branch
  // below, whose only remaining case was 'approved' - so a suspended host was
  // locked out of /merchant AND told "your portal is live, there's no pending
  // status to show", with "Back to Click" as the sole exit.
  if (
    !merchantProfile ||
    (merchantProfile.verification_status !== "pending" &&
      merchantProfile.verification_status !== "rejected" &&
      merchantProfile.verification_status !== "suspended")
  ) {
    let reason: string;
    let showHostCta = false;
    if (!session?.user) {
      reason =
        "This page is only for merchants reviewing their application status. Sign in, then start a host application to get going.";
      showHostCta = true;
    } else if (!merchantProfile) {
      reason =
        "You haven’t submitted a host application yet. Start the quick onboarding to list your first event.";
      showHostCta = true;
    } else {
      // verification_status === "approved"
      reason =
        "Your merchant application is already approved - your portal is live, so there’s no pending status to show.";
    }
    return <AccessDenied reason={reason} showHostCta={showHostCta} />;
  }

  const rejected = merchantProfile.verification_status === "rejected";
  const suspended = merchantProfile.verification_status === "suspended";

  // A venue outside the launch pilot never enters the verification queue at all:
  // registerMerchantWizardSubmit parks the host on the waitlist and emails
  // merchant-waitlisted-merchant instead. The row still reads 'pending' either
  // way, so this page - which only ever branched on verification_status - was
  // promising a waitlisted host an admin decision "within 1 business day" that
  // nobody was ever going to make. Same predicate as the wizard's own notice and
  // as the server branch (isWithinSydneyPilot), read off the address the merchant
  // row already carries, so all three tell the host the same story.
  //
  // No postcode means we can't claim they're outside the pilot - rows predating
  // the wizard were written without an address - so those keep the queue copy
  // rather than being waitlisted on a guess.
  const postcode = merchantProfile.address_postcode?.trim() ?? "";
  const waitlisted =
    !rejected &&
    !suspended &&
    postcode !== "" &&
    !isWithinSydneyPilot(merchantProfile.address_state, postcode);
  // The email names the suburb it was given; the merchant row carries only state
  // and postcode, so the page names the part of the address it actually has
  // rather than inventing a suburb to match.
  const venueArea = [merchantProfile.address_state, postcode].filter(Boolean).join(" ");

  // A suspended host still has rooms full of people booked, and this page says
  // so out loud ("Confirmed bookings still stand"). It then used to remove every
  // way of meeting that obligation: /merchant redirects them here, so the door
  // list, the attendee emails, the check-in toggles and the Cancel button all
  // went with it. The event detail page itself never gated on approval - it only
  // needs a merchant profile - so the data was reachable the whole time and
  // simply had no link. This is that link.
  const upcomingEvents = suspended
    ? (await getMerchantEvents(session).catch(() => []))
        .filter((event) => {
          if (event.status === "Cancelled") return false;
          // eslint-disable-next-line react-hooks/purity -- async server component, evaluated once per request
          return new Date(event.endsAt ?? event.startsAt).getTime() >= Date.now();
        })
        .slice(0, 8)
    : [];
  // Rejected and suspended share the alert treatment and, crucially, neither
  // gets the "get your first event live" prep checklist - it reads as "you can
  // publish now" to someone who can't (bug board #204, and a suspended host is
  // the same trap).
  const needsAttention = rejected || suspended;

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.5fr_0.5fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <span className={`sticker ${needsAttention ? "sticker--rose" : "sticker--peach"} inline-flex`}>
            {/* The pulse-ring reads as "someone is looking at this right now",
                which is the one thing a waitlisted host must not be told - their
                dot is the same purple, just still. */}
            <span
              className={`size-2 rounded-full ${
                needsAttention
                  ? "bg-[color:var(--champagne)]"
                  : waitlisted
                    ? "bg-[color:var(--purple)]"
                    : "bg-[color:var(--purple)] pulse-ring"
              }`}
            />
            {suspended
              ? "Hosting paused"
              : rejected
                ? "Application needs another look"
                : waitlisted
                  ? "On the waitlist"
                  : "Application received"}
          </span>

          <h1 className="font-display mt-6 text-5xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-6xl">
            {suspended ? (
              <>
                Your hosting is <span className="text-[color:var(--purple)]">on hold</span>.
              </>
            ) : rejected ? (
              <>
                We need to <span className="text-[color:var(--purple)]">talk it over</span>.
              </>
            ) : waitlisted ? (
              <>
                You’re <span className="text-[color:var(--purple)]">on the list</span>.
              </>
            ) : (
              <>
                Thanks, <span className="text-[color:var(--purple)]">we’re on it</span>.
              </>
            )}
          </h1>

          <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[color:var(--slate)]">
            {suspended
              ? "An admin has paused hosting on this account, so your events are hidden from Discover and you can’t publish new ones. Bookings people already hold still stand. Check your email for the reason, or reply to that email and we’ll sort it out with you."
              : rejected
                ? "An admin reviewed your application and flagged something. Check your email for the reason and resubmit when you’ve addressed it."
                : waitlisted
                  ? `We’re piloting Click in ${PILOT_AREA_LABEL} right now, and the venue address on your application (${venueArea}) sits outside it - so you’re on the host waitlist rather than in the review queue. Nothing to send us: we’ll email the moment we open up near you.`
                  : "Your merchant application is in the admin queue. We aim to review new merchants within 1 business day. We’ll email you the moment your portal unlocks."}
          </p>

          <p className="mt-6 text-sm font-semibold text-[color:var(--ink)]">
            {suspended ? "Hosting account: " : "Application for: "}
            <span className="font-display font-semibold text-[color:var(--purple)]">{merchantProfile.business_name}</span>
          </p>
          <p className="mt-1 text-sm font-medium text-[color:var(--slate)]">
            Contact email on file: {merchantProfile.contact_email}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="ck-btn ck-btn--secondary ck-btn--md">
              ← Use Click as an attendee
            </Link>
            {rejected ? (
              <Link href="/merchant/signup" className="ck-btn ck-btn--primary ck-btn--md">
                Resubmit application →
              </Link>
            ) : null}
          </div>
        </div>

        {/*
          A rejected merchant must NOT see the "get your first event live"
          prep checklist - it reads as "you can create events now" even though
          they can't (bug board #204). Steer them to fix + resubmit instead.
          Same for a suspended one, who additionally has live attendees to
          think about, so their panel explains what is and isn't still running.
          And same for a waitlisted one: the checklist's whole premise is that
          approval is a day away, which is the exact promise nobody is going to
          keep for a venue outside the pilot.
        */}
        {suspended ? (
          <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
            <p className="eyebrow">What this means</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
              Your bookings keep running. New listings don’t.
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-[color:var(--slate)]">
              A pause is not a cancellation. Nobody who already booked with you loses
              their spot, and you can still reach us about it.
            </p>
            <ul className="mt-6 grid gap-4">
              {[
                {
                  t: "Confirmed bookings still stand",
                  d: "Anyone holding a spot at one of your events keeps it, and they keep their booking details.",
                },
                {
                  t: "Your events are hidden from Discover",
                  d: "They stop appearing in browse and search while the pause is on, so no new bookings come in.",
                },
                {
                  t: "New events can’t be published",
                  d: "Event creation stays closed until the pause is lifted.",
                },
                {
                  t: "Talk to us",
                  d: "We emailed the contact address on file with the reason. Reply to it and an admin will pick it up.",
                },
              ].map((item) => (
                <li
                  key={item.t}
                  className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
                >
                  <p className="font-semibold text-[color:var(--ink)]">{item.t}</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">{item.d}</p>
                </li>
              ))}
            </ul>
            {upcomingEvents.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4">
                <p className="font-semibold text-[color:var(--ink)]">
                  {upcomingEvents.length} night
                  {upcomingEvents.length === 1 ? "" : "s"} still to run
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">
                  Open one to see the door list, check people in, or cancel it and
                  refund everyone. These still work while your hosting is paused.
                </p>
                <ul className="mt-3 grid gap-1.5">
                  {upcomingEvents.map((event) => (
                    <li key={event.slug}>
                      <Link
                        href={`/merchant/events/${event.slug}`}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-xl bg-[color:var(--paper)] px-3.5 py-2.5 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--lavender-100)]"
                      >
                        <span className="min-w-0 truncate">{event.title}</span>
                        <span className="text-[12.5px] font-medium tabular-nums text-[color:var(--slate)]">
                          {upcomingDateFormatter.format(new Date(event.startsAt))} ·{" "}
                          {event.confirmed}/{event.capacity} booked
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Same address the suspension email came from, so replying there
                and starting here land in the same place. */}
            <a
              href={`mailto:hello@letsclick.app?subject=${encodeURIComponent(
                `Hosting paused - ${merchantProfile.business_name}`,
              )}`}
              className="ck-btn ck-btn--secondary ck-btn--md mt-6"
            >
              Email us about this →
            </a>
          </div>
        ) : rejected ? (
          <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
            <p className="eyebrow">What happens next</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
              Update your application and resubmit.
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-[color:var(--slate)]">
              Your application isn’t live yet, so you can’t create events until it’s
              approved. Check the rejection email for the specific reason, fix that in
              your application, and send it back for review.
            </p>
            <ol className="mt-6 grid gap-4">
              {[
                {
                  t: "Read the reason in your email",
                  d: "We emailed the contact address on file with exactly what the admin flagged.",
                },
                {
                  t: "Update the flagged details",
                  d: "Reopen your application - your previous answers are still there to edit.",
                },
                {
                  t: "Resubmit for review",
                  d: "Once you resubmit, your application goes back into the admin queue and we’ll email you the outcome.",
                },
              ].map((step, idx) => (
                <li
                  key={step.t}
                  className="flex gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-100)] text-sm font-semibold text-[color:var(--purple-700)]">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[color:var(--ink)]">{step.t}</p>
                    <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/merchant/signup"
              className="ck-btn ck-btn--primary ck-btn--md mt-6"
            >
              Resubmit application →
            </Link>
          </div>
        ) : waitlisted ? (
          /* Mirrors what /emails/merchant-waitlisted-merchant.html actually tells
             them - on the list, nothing to do, we email when we launch near you,
             reply if the address looks wrong - so the page and the email a host
             reads side by side say one thing rather than two. */
          <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
            <p className="eyebrow">What happens next</p>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
              Nothing to do - we’ll come to you.
            </h2>
            <p className="mt-4 text-sm font-medium leading-7 text-[color:var(--slate)]">
              Your application is saved exactly as you sent it. When Click opens up
              near you we pick it straight back up, so you’ll never fill any of this
              in twice.
            </p>
            <ul className="mt-6 grid gap-4">
              {[
                {
                  t: "You’re on the host waitlist",
                  d: `We’re piloting in ${PILOT_AREA_LABEL} first, so there’s no review date on this one and no decision for you to sit up waiting on.`,
                },
                {
                  t: "You hear from us first",
                  d: `The moment we open up around ${venueArea}, you’re in the first group we email to get your events live.`,
                },
                {
                  t: "Everything you sent is on file",
                  d: "Business details, contact, venue address and any documents you uploaded all stay saved with us.",
                },
                {
                  t: "Address not quite right?",
                  d: "If we’ve read your venue address wrong, email us and we’ll check it against the pilot again.",
                },
              ].map((item) => (
                <li
                  key={item.t}
                  className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
                >
                  <p className="font-semibold text-[color:var(--ink)]">{item.t}</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">{item.d}</p>
                </li>
              ))}
            </ul>

            {/* Same address the waitlist email came from, so replying there and
                starting here land in the same place. */}
            <a
              href={`mailto:hello@letsclick.app?subject=${encodeURIComponent(
                `Host waitlist - ${merchantProfile.business_name}`,
              )}`}
              className="ck-btn ck-btn--secondary ck-btn--md mt-6"
            >
              Email us about this →
            </a>
          </div>
        ) : (
        /* First-event prep checklist per spec §1 post-submission. */
        <div className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)]">
          <p className="eyebrow">While you wait</p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)]">
            Get your first event live in 15 minutes - prep these now.
          </h2>

          <ol className="mt-6 grid gap-4">
            {[
              {
                t: "Pick your strongest event idea",
                d: "Strong titles include the activity + vibe: ‘Thursday Pottery for Beginners’, not ‘Pottery Class’.",
              },
              {
                t: "Choose a high-traffic suburb for launch",
                d: "Inner-city Sydney events fill fastest. Surry Hills, Newtown, and Darlinghurst are the best starting points.",
              },
              {
                t: "Plan an intimate first event (10-20 people)",
                d: "Smaller events convert better on Click. Save big events for after you’ve built an audience.",
              },
              {
                t: "Connect Stripe for paid events",
                d: "Required before you can charge. The event wizard warns you on Step 2 the moment you type a price above 0 without payouts connected.",
              },
              {
                t: "Tag richly",
                d: "Users filter by tags. A cooking class can be Food + Social + Learning + Creative - pick all that fit.",
              },
            ].map((step, idx) => (
              <li
                key={step.t}
                className="flex gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--champagne)] p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--lavender-100)] text-sm font-semibold text-[color:var(--purple-700)]">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-semibold text-[color:var(--ink)]">{step.t}</p>
                  <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--slate)]">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-[12.5px] font-semibold text-[color:var(--slate)]">
            We’ll email you when approval lands
          </p>
        </div>
        )}
      </section>
    </main>
  );
}
