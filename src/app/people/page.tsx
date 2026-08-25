import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClickRadar } from "@/components/click-radar";
import { ClickWithSomeoneUserCard } from "@/components/click-with-someone-user-card";
import { Avatar, Icon, ckBtn } from "@/components/ds";
import {
  DISCOVERY_CLICK_WINDOW_DAYS,
  MUTUAL_CLOCK_DAYS,
  POST_EVENT_CLICK_CAP,
  POST_EVENT_CLICK_WINDOW_HOURS,
  POST_EVENT_PROMPT_DELAY_HOURS,
} from "@/lib/clicks/constants";
import {
  getMutualClicksForSession,
  getPersonalizedDiscovery,
  getProfileCompletion,
  getProfileStatus,
  getSuggestedPeople,
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

  const [suggested, mutuals, personalized, profileStatus, completion] = await Promise.all([
    getSuggestedPeople(session),
    getMutualClicksForSession(session),
    getPersonalizedDiscovery(session),
    getProfileStatus(session),
    getProfileCompletion(session),
  ]);

  // Same bar the matcher cares about, same test the dashboard already makes
  // (dashboard/page.tsx:119). getSuggestedPeople filters on the CANDIDATES'
  // tags, never on the viewer's, so an empty set says nothing about whether the
  // viewer has interests - and telling someone who just picked five of them to
  // go and pick some is the first thing this page said to a new member.
  const hasInterests = completion.items.find((i) => i.key === "tags")?.done ?? false;

  // The daily set is a small, curated pool - a drip, not an endless feed. People
  // you've already clicked drop OUT of it (same rule the dashboard uses): the set
  // was a hard stop at three, so once you'd clicked all three the page showed the
  // same three muted "clicked" cards forever with nothing left to do and no word
  // on what happens next.
  const clickable = suggested.filter((p) => !p.alreadyClicked);
  // Rotated by the Sydney date, so "3 people for you today" is true tomorrow as
  // well. It used to be a flat slice(0, 3): sit on your hands and the same three
  // faces greeted you every morning under a heading promising new ones, which
  // teaches people the page is not worth reopening. Rotating the window costs no
  // extra query and suits a drip - the people you skipped come back around.
  const dayKey = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" })
      .format(new Date())
      .replace(/-/g, ""),
  );
  const start = clickable.length > 0 ? dayKey % clickable.length : 0;
  const dailySet = clickable.length > 0
    ? Array.from({ length: Math.min(3, clickable.length) }, (_unused, i) =>
        clickable[(start + i) % clickable.length],
      )
    : [];
  // You've worked through everyone we had, rather than never having had anyone.
  const setExhausted = dailySet.length === 0 && suggested.length > 0;

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

        {/* The rules, where the question actually gets asked. /how-it-works is the
            MARKETING page and teases the mechanic on purpose, so the link that used
            to sit here answered "how does this work" with a pitch. A native
            <details> costs no client JS, and every number below is read from
            clicks/constants.ts so the copy cannot drift from the enforcement. */}
        <details className="group mt-3 rounded-[var(--radius-lg)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] px-4 py-3">
          <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-[color:var(--purple)] marker:content-none">
            How clicking works
            <span aria-hidden className="ml-1 inline-block transition-transform group-open:rotate-90">
              →
            </span>
          </summary>
          <ul className="mt-3 grid gap-2 text-[13.5px] leading-6 text-[color:var(--ink-soft)]">
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
                Clicks don&apos;t hang around.
              </strong>{" "}
              A click stays open {DISCOVERY_CLICK_WINDOW_DAYS} days for them to click back. After
              that it&apos;s still out there - cross paths again and you can pick it back up. A
              mutual has {MUTUAL_CLOCK_DAYS} days to turn into a plan.
            </li>
            <li>
              <strong className="font-semibold text-[color:var(--ink)]">
                After an event, it opens up.
              </strong>{" "}
              Who was there appears {POST_EVENT_PROMPT_DELAY_HOURS} hours after it ends, and you
              have {POST_EVENT_CLICK_WINDOW_HOURS} hours from the end of the event to click up to{" "}
              {POST_EVENT_CLICK_CAP} of them.
            </li>
          </ul>
        </details>

        {/* ---- The daily set ---- */}
        <section className="mt-7">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[1.075rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)] sm:text-[1.3rem]">
              {dailySet.length > 0 ? `${dailySet.length} ${dailySet.length === 1 ? "person" : "people"} for you today` : "People for you"}
            </h2>
            {dailySet.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--slate)]">
                <Icon name="trend" size={14} className="text-[color:var(--purple-400)]" />
                Fresh today
              </span>
            ) : null}
          </div>

          {dailySet.length > 0 ? (
            <>
              <div className="grid gap-4">
                {dailySet.map((person) => (
                  <ClickWithSomeoneUserCard
                    key={person.id}
                    person={person}
                    viewerOpenToDating={profileStatus.datingVisible}
                  />
                ))}
              </div>
              {/* The anonymity reassurance shows ONCE at the top of the section,
                  never under each card. */}
              <p className="mt-4 flex items-start gap-[7px] px-0.5 text-[13px] leading-relaxed text-[color:var(--slate)]">
                <Icon name="lock" size={14} className="mt-0.5" />
                <span>Clicking is anonymous - we&apos;ll only show you if it&apos;s mutual.</span>
              </p>
            </>
          ) : setExhausted ? (
            // The end of the drip is a STATE, not an absence. Say the clicks are
            // sent, say they're private, and point at the thing that actually
            // refills the set - going to more events.
            <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
              <p className="font-display text-[15px] font-semibold text-[color:var(--ink)]">
                That&apos;s everyone for now.
              </p>
              <p className="mx-auto mt-1.5 max-w-[420px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
                Your clicks are sent and stay private - we&apos;ll tell you the moment one is
                mutual. New people show up as you go to more events.
              </p>
              <Link href="/discover" className={`${ckBtn("primary", "sm")} mt-4`}>
                <span className="ck-btn__label">Find an event →</span>
              </Link>
            </div>
          ) : (
            <div className="rounded-[var(--radius-xl)] bg-[color:var(--lav-bg)] px-6 py-8 text-center">
              {hasInterests ? (
                <>
                  <p className="font-display text-[15px] font-semibold text-[color:var(--ink)]">
                    No one to show you just yet.
                  </p>
                  <p className="mx-auto mt-1.5 max-w-[420px] text-sm leading-relaxed text-[color:var(--ink-soft)]">
                    We only suggest people with real overlap, so this fills up as more members
                    join near you. Going to an event is the fastest way to meet them.
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
          <ClickRadar events={personalized?.events ?? []} />
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
                  {liveMutuals.map((m) => (
                    <YourClickRow
                      key={m.otherProfileId}
                      name={m.otherDisplayName}
                      profileId={m.otherProfileId}
                      // A live mutual is the your-move card - it earns the soft
                      // lavender-wash fill; the action is always a purple verb.
                      yourMove
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
                        !m.suggestedEventSlug
                          ? "Suggest a plan →"
                          : viewerHasSeat(m.suggestedEventSlug)
                            ? "See your plan →"
                            : !m.suggestedEventJoinable
                              ? "Pick another plan →"
                              : m.planAccepted
                                ? "See your plan →"
                                : m.suggestedByOther
                                  ? "See their plan →"
                                  : m.suggestedBySomeone
                                    ? "See your plan →"
                                    : "See the plan →"
                      }
                    />
                  ))}
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
                      name={m.otherDisplayName}
                      profileId={m.otherProfileId}
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
 * Your-clicks outcome card - the ONE list row for Live mutuals · Plans · Past.
 * State is carried by three things only: the section header, an earned card
 * accent (the soft lavender-wash fill on YOUR-MOVE cards), and the action verb.
 * NO name-adjacent state pill, and NO spark on a list row (the spark is reserved
 * for the three peaks). Sage is reserved for success - a confirmed plan's
 * "going" marker - never the intent line.
 */
function YourClickRow({
  name,
  profileId,
  line,
  actionLabel,
  yourMove,
  going,
}: {
  name: string;
  profileId: string;
  line: string;
  actionLabel: string;
  yourMove?: boolean;
  going?: boolean;
}) {
  return (
    <article
      className={`flex items-center gap-3.5 rounded-[var(--radius-lg)] border p-4 ${
        yourMove
          ? "border-transparent bg-[color:var(--lav-bg)]"
          : "border-[color:var(--line-soft)] bg-[color:var(--paper)]"
      }`}
    >
      <Avatar name={name} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${profileId}`}
            className="font-display truncate text-[17px] font-semibold text-[color:var(--ink)] hover:underline"
          >
            {name}
          </Link>
          {going ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--sage)_14%,var(--paper))] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--sage)]">
              <Icon name="check" size={11} stroke={3} />
              going
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-[color:var(--slate)]">{line}</p>
      </div>
      <Link href="/proposals" className="ck-btn ck-btn--sm ck-btn--primary shrink-0">
        <span className="ck-btn__label">{actionLabel}</span>
      </Link>
    </article>
  );
}
