import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClickRadar } from "@/components/click-radar";
import { ClickWithSomeoneUserCard } from "@/components/click-with-someone-user-card";
import { Icon, ckBtn } from "@/components/ds";
import { PeopleCard } from "@/components/people-card";
import { resolveAvatarImage } from "@/lib/avatar-images";
import { DAILY_PICK_COUNT } from "@/lib/clicks/daily-picks";
import {
  getDailyPicks,
  getMutualClicksForSession,
  getPersonalizedDiscovery,
  getProfileCompletion,
  getProfileStatus,
  getRadarSignals,
  type MutualClickEntry,
} from "@/lib/event-repository";

export const metadata = {
  title: "click with someone",
  description: "A small, intentional set of people you might click with - no endless feed.",
};

export default async function PeoplePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/people");
  }

  const [picks, mutuals, personalized, profileStatus, completion] = await Promise.all([
    // Today's picks (CHANGE BRIEF 2026-09-30): written once a day to daily_picks,
    // so this list, the dashboard's one-at-a-time card and GET /api/people/daily are
    // the same people in the same click state all day. A pick you click stays in
    // the set as "clicked" rather than dropping out - "new people every day" is the
    // job's promise (least recently picked first), not a reshuffle on every tap.
    getDailyPicks(session),
    getMutualClicksForSession(session),
    getPersonalizedDiscovery(session),
    getProfileStatus(session),
    getProfileCompletion(session),
  ]);

  // Same bar the matcher cares about, same test the dashboard already makes
  // (dashboard/page.tsx:119). The picks are filtered on the CANDIDATES' profiles,
  // never on the viewer's tags, so an empty set says nothing about whether the
  // viewer has interests - and telling someone who just picked five of them to
  // go and pick some is the first thing this page said to a new member.
  const hasInterests = completion.items.find((i) => i.key === "tags")?.done ?? false;
  // Clicking needs your own photo (sendClickInner's R_PHOTO gate, bug board #190),
  // so say so BEFORE a tap is refused rather than only after it. Same test the send
  // path uses; the gallery alone is not a face on the card.
  const viewerHasPhoto = resolveAvatarImage(profileStatus.photoUrl) !== null;

  // The brief's heading, with the set's real size in it: a thin pool must not
  // promise three people it doesn't have.
  const picksHeading =
    picks.length > 1
      ? `${picks.length} people you might click with today`
      : picks.length === 1
        ? "Someone you might click with today"
        : "People you might click with";

  // Your clicks, grouped by state. A plan exists once both are going; everything
  // else is a live mutual, which is ALWAYS the actionable "suggest a plan" card
  // (there is no dormant / "no match" state - the user can always propose).
  const plans = mutuals.filter((m) => m.bothGoingEventSlug);
  const liveMutuals = mutuals.filter((m) => !m.bothGoingEventSlug);
  // Same test the dashboard uses (dashboard/page.tsx), so the two surfaces stop
  // telling the same member two different things about the same plan.
  const registeredSet = new Set(profileStatus.registeredEventIds);
  const waitlistedSet = new Set(profileStatus.waitlistedEventIds);
  const viewerHasSeat = (slug: string | null) =>
    slug != null && registeredSet.has(slug) && !waitlistedSet.has(slug);

  // The radar's rows, rooms with people in them first (a stable sort keeps the
  // personalised order within each group), with the same lines the dashboard's
  // row gets. This bar used to render with no lines at all - every row read
  // "Trending in Sydney" however many people were going (bug board #172).
  const radarEvents = [...(personalized?.events ?? [])]
    .sort((a, b) => Number(b.attendees > 0) - Number(a.attendees > 0))
    .slice(0, 3);
  const radarSignals = await getRadarSignals(radarEvents, session);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page max-w-[760px] pt-6">
        {/* The mechanic chrome is lowercase - the feeling, not the platform. */}
        <h1 className="font-display text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
          click with someone
        </h1>
        <p className="mt-1.5 text-sm font-medium text-[color:var(--slate)]">
          A small, intentional set - no endless feed.
        </p>

        {/* ---- Today's picks ---- */}
        <section className="mt-7">
          {/* CHANGE BRIEF 2026-09-30 §2.1. What the brief bans (§2.6) is a refresh
              time, an "N left today" or a countdown to tomorrow's set - saying the
              set is a daily one is the point of it. The sub-line only runs when
              today really did bring three. */}
          <h2 className="font-display text-[1.075rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)] sm:text-[1.3rem]">
            {picksHeading}
          </h2>
          {picks.length === DAILY_PICK_COUNT ? (
            <p className="mt-1 text-[13.5px] font-medium text-[color:var(--slate)]">
              Three new people, every day.
            </p>
          ) : null}

          {viewerHasPhoto ? null : (
            <p className="mt-4 flex items-start gap-[7px] rounded-[var(--radius-lg)] bg-[color:var(--lav-bg)] px-4 py-3 text-[13.5px] leading-relaxed text-[color:var(--ink-soft)]">
              <Icon name="camera" size={15} className="mt-0.5 shrink-0" />
              <span>
                Add a photo to click with people - it&apos;s the first thing they see.{" "}
                <Link href="/profile/edit" className="font-semibold whitespace-nowrap text-[color:var(--purple)]">
                  Add a photo →
                </Link>
              </span>
            </p>
          )}

          {/* The anonymity reassurance, ONCE at the top of the set (COORDINATION_
              MODAL_SYSTEM §6) and never under each card, with "How clicking works"
              opening the rules right beneath it. /how-it-works is the MARKETING
              page and teases the mechanic on purpose, so a link there would answer
              "how does this work" with a pitch; a native <details> costs no client
              JS. NO NUMBERS in the rules, ever: the click window, the mutual clock,
              the post-event prompt delay and the per-event budget are back-end
              concepts and invariant 9 bans showing a timer, a cap or a cadence
              anywhere. The bullets carry the reassurance, not the tuning. */}
          <details className="group mt-4 mb-4">
            <summary className="flex cursor-pointer list-none items-start gap-[7px] px-0.5 text-[13px] leading-relaxed text-[color:var(--slate)] marker:content-none [&::-webkit-details-marker]:hidden">
              <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
              <span>
                Clicking is anonymous - we&apos;ll only show you if it&apos;s mutual.{" "}
                <span className="font-semibold whitespace-nowrap text-[color:var(--purple)]">
                  How clicking works{" "}
                  <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
                    →
                  </span>
                </span>
              </span>
            </summary>
            <ul className="mt-3 grid gap-2 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] px-4 py-3 text-[13.5px] leading-6 text-[color:var(--ink-soft)]">
              <li>
                <strong className="font-semibold text-[color:var(--ink)]">It stays private.</strong>{" "}
                They are never told. Nothing shows up on their side unless they click you too.
              </li>
              <li>
                <strong className="font-semibold text-[color:var(--ink)]">Nothing is a chat.</strong>{" "}
                When it is mutual you both see it at the same moment, and what opens is a plan -
                there is no messaging anywhere in Click.
              </li>
              <li>
                <strong className="font-semibold text-[color:var(--ink)]">
                  A click keeps its own time.
                </strong>{" "}
                It stays open for them to click back, and after that it&apos;s still out there - if
                you cross paths again, you can pick it back up. No rush.
              </li>
              <li>
                <strong className="font-semibold text-[color:var(--ink)]">
                  After an event, it opens up.
                </strong>{" "}
                Who was there appears shortly after it ends, while the night is still fresh. Tap
                anyone worth a second hang - we&apos;ll do the rest.
              </li>
            </ul>
          </details>

          {picks.length > 0 ? (
            /* The set arrives in reading order rather than all at once - the
               DS-calm 8px .rise-soft on the .rise-d* ladder, pure CSS so it
               plays before hydration and the global reduced-motion block
               collapses it. The wrapper exists only to carry the animation:
               both keyframes end on `transform: none`, so it never lingers as
               a containing block over the card's own hover lift. */
            <div className="grid gap-4">
              {picks.map((person, i) => (
                <div key={person.id} className={`rise-soft rise-d${i + 1}`}>
                  <ClickWithSomeoneUserCard person={person} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
              {hasInterests ? (
                <>
                  <p className="font-display text-[15px] font-semibold text-[color:var(--ink)]">
                    No one to show you just yet.
                  </p>
                  {/* Says what the set is actually drawn from. It used to claim "we only
                      suggest people with real overlap", which the picks have never
                      filtered on - the gate is a finished profile with a photo (bug
                      board #255). */}
                  <p className="mx-auto mt-1.5 max-w-[420px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
                    Suggestions come from members with a photo and a finished profile, and
                    there&apos;s no one new to show you yet. Going to an event is the fastest
                    way to meet people.
                  </p>
                  <Link href="/discover" className={`${ckBtn("primary", "sm")} mt-4`}>
                    <span className="ck-btn__label">Find an event →</span>
                  </Link>
                </>
              ) : (
                <p className="mx-auto max-w-[380px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  Add a few interests to{" "}
                  <Link href="/profile/edit" className="font-semibold text-[color:var(--purple)]">
                    your profile
                  </Link>{" "}
                  and we&apos;ll start surfacing people you actually overlap with.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ---- On your radar ---- */}
        <section className="mt-12">
          <h2 className="font-display mb-1 text-[1.075rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)] sm:text-[1.3rem]">
            On your radar
          </h2>
          <p className="mb-4 text-[13.5px] font-medium text-[color:var(--slate)]">
            People like you are showing up to these.
          </p>
          <ClickRadar events={radarEvents} fomoBySlug={radarSignals} />
        </section>

        {/* ---- Your clicks ---- */}
        {mutuals.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-display mb-4 text-[1.075rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)] sm:text-[1.3rem]">
              Your clicks
            </h2>

            {liveMutuals.length > 0 ? (
              <div className="mb-6">
                <p className="mb-2.5 text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">
                  Live mutuals
                </p>
                <div className="grid gap-3">
                  {liveMutuals.map((m) => {
                    // Whose turn it is (DS "whose-turn clarity"): the ball is with
                    // them once you hold your seat, or once the plan on the table is
                    // one YOU suggested and they have not answered. Everything else
                    // is yours - and only your move earns the lavender-wash fill and
                    // a purple verb; waiting is the muted "Waiting on [Name]".
                    const theirMove =
                      Boolean(m.suggestedEventSlug) &&
                      (viewerHasSeat(m.suggestedEventSlug) ||
                        (m.suggestedEventJoinable &&
                          !m.planAccepted &&
                          !m.suggestedByOther &&
                          m.suggestedBySomeone));
                    return (
                    <YourClickRow
                      key={m.otherProfileId}
                      mutual={m}
                      yourMove={!theirMove}
                      // A dead suggestion is not "no suggestion": say it's off and
                      // point at the fix, rather than silently reverting to the
                      // never-suggested copy.
                      line={
                        !m.suggestedEventSlug
                          ? "Pick something you'd both enjoy"
                          : // Every row here is a live mutual, i.e. one with NO shared
                            // upcoming event (that's what splits liveMutuals from plans
                            // above). So on a row where the viewer holds a seat, the
                            // other person by construction does not - and the branch
                            // that used to sit here said "You're both in" on precisely
                            // the rows where they weren't. Agreeing on a plan is not
                            // the same as taking a seat on it.
                            viewerHasSeat(m.suggestedEventSlug)
                            ? "You've got your seat - waiting on them"
                            : !m.suggestedEventJoinable
                              ? `${m.suggestedEventTitle ?? "That plan"} is off the table`
                              : m.planAccepted
                                ? "You both said yes - grab your seat"
                                : m.suggestedByOther
                                  ? `${m.otherDisplayName.split(" ")[0]} suggested a plan`
                                  : m.suggestedBySomeone
                                    ? "Waiting to hear back on your plan"
                                    : "Here's a plan for you two"
                      }
                      actionLabel={
                        theirMove
                          ? `Waiting on ${m.otherDisplayName.split(" ")[0]}`
                          : !m.suggestedEventSlug
                            ? "Suggest a plan →"
                            : !m.suggestedEventJoinable
                              ? "Pick another plan →"
                              : m.planAccepted
                                ? "See your plan →"
                                : m.suggestedByOther
                                  ? "See their plan →"
                                  : "See the plan →"
                      }
                    />
                    );
                  })}
                </div>
              </div>
            ) : null}

            {plans.length > 0 ? (
              <div>
                <p className="mb-2.5 text-xs font-bold tracking-[0.08em] uppercase text-[color:var(--slate)]">Plans</p>
                <div className="grid gap-3">
                  {plans.map((m) => (
                    <YourClickRow
                      key={m.otherProfileId}
                      mutual={m}
                      line={`Going to ${m.bothGoingEventTitle ?? "an event"} together`}
                      actionLabel="See the plan →"
                      going
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Your-clicks outcome card - the ONE list row for Live mutuals · Plans · Past,
 * built on the same People Card as the daily set above it (bug board #293): the
 * photo, the name with the pair's intent line, the night you met and the
 * interests you share. It used to be an initial-only avatar (the photo was
 * never passed) beside a name and a status line - a different card from every
 * other place you meet people, with nothing on what you have in common.
 *
 * State is carried by three things only: the section header, an earned card
 * accent (the soft lavender-wash fill on YOUR-MOVE cards), and the action verb.
 * NO spark on a list row (the spark is reserved for the three peaks). Sage is
 * reserved for success - a confirmed plan's "going" marker - never the intent line.
 */
function YourClickRow({
  mutual,
  line,
  actionLabel,
  yourMove,
  going,
}: {
  mutual: MutualClickEntry;
  line: string;
  actionLabel: string;
  yourMove?: boolean;
  going?: boolean;
}) {
  return (
    <PeopleCard
      person={{
        id: mutual.otherProfileId,
        displayName: mutual.otherDisplayName,
        photoUrl: mutual.otherPhotoUrl,
        sharedInterests: mutual.sharedInterests,
        sharedEvent: mutual.sourceEventTitle,
      }}
      intent={mutual.intentLabel}
      // No "View profile" ghost on this card, so the name is the labelled route.
      profileHref={`/profile/${mutual.otherProfileId}`}
      linkName
      yourMove={yourMove}
      nameAside={
        going ? (
          <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--sage)]">
            <Icon name="check" size={11} stroke={3} />
            going
          </span>
        ) : null
      }
      detail={<p className="text-[13.5px] font-semibold leading-snug text-[color:var(--ink)]">{line}</p>}
      actions={
        // Straight into the drawer AT this mutual (§4) - its one-time reveal first if
        // it hasn't played, else its current step - never the bare list to search.
        // Purple only for your move; a settled plan is the quiet secondary, and
        // waiting on them is the muted pending footprint, still a way in.
        <Link
          href={`/proposals?open=${mutual.mutualId}`}
          className={
            yourMove
              ? ckBtn("primary", "sm", { full: true })
              : going
                ? ckBtn("secondary", "sm", { full: true })
                : ckBtn("pending", "sm", { full: true, className: "cursor-pointer" })
          }
        >
          <span className="ck-btn__label">{actionLabel}</span>
        </Link>
      }
    />
  );
}
