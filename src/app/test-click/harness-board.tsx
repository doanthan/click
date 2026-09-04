import Link from "next/link";
import {
  isHarnessAllowed,
  listHarnessPeople,
  readPairState,
  type PairState,
  type SideView,
} from "@/lib/click-test-harness";
import { readFixtureReport } from "@/lib/click-test-fixtures";
import { readHarnessLog, reconcileHarnessLog, snapshotPair } from "@/lib/click-test-log";
import { HarnessButton } from "./harness-button";
import { HarnessLog } from "./harness-log";
import { buildScenarios, type Scenario, type ScenarioState } from "./scenarios";

/**
 * The two-person click driver.
 *
 * A click only exists as a pair of facts, and the whole product promise is that
 * one of those facts is invisible until the other arrives. That is unobservable
 * from a single signed-in browser - you have to see both sides of the same
 * instant - so this board renders the two views side by side and drives each of
 * them as the person it belongs to.
 *
 * The two columns are NOT a mock. Each one is the output of the same repository
 * functions the real surfaces call, so an empty right-hand column IS the privacy
 * guarantee holding, not a rendering shortcut.
 */

const DEFAULT_A = "maya@click.local";
const DEFAULT_B = "ruby@click.local";

const STATE_STYLES: Record<ScenarioState, { label: string; className: string }> = {
  // Status colours live on badges only - never on a control.
  done: { label: "holds", className: "bg-[color:var(--sage)]/15 text-[color:var(--sage-ink)]" },
  waiting: { label: "not yet", className: "bg-[color:var(--mist)] text-[color:var(--slate)]" },
  drive: { label: "drive it", className: "bg-[color:var(--amber)]/18 text-[color:var(--amber-ink)]" },
  broken: { label: "broken", className: "bg-[color:var(--danger)]/12 text-[color:var(--danger)]" },
};

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[color:var(--mist)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <h3 className="font-display text-[1.05rem] font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
        {title}
      </h3>
      {caption ? (
        <p className="mt-1 text-[0.78rem] leading-relaxed text-[color:var(--slate)]">{caption}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--mist)] py-1.5 last:border-0">
      <span className="text-[0.7rem] uppercase tracking-[0.08em] text-[color:var(--slate)]">
        {label}
      </span>
      <span className="text-right font-mono text-[0.72rem] font-semibold text-[color:var(--ink)]">
        {value}
      </span>
    </div>
  );
}

export async function ClickHarnessBoard({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}) {
  if (!(await isHarnessAllowed())) {
    return (
      <Panel
        title="The harness is locked on this environment"
        caption="It can act as any QA persona, so it sits behind the same unlock as the persona switcher."
      >
        <p className="text-[0.82rem] text-[color:var(--slate)]">
          Open{" "}
          <code className="rounded bg-[color:var(--lav-bg)] px-1.5 py-0.5">
            /qa-unlock?key=…
          </code>{" "}
          with your <code>TEST_SWITCHER_KEY</code>, or sign in as an admin address and unlock it
          from <Link href="/admin/system" className="font-semibold text-[color:var(--purple)] underline">/admin/system</Link>.
        </p>
      </Panel>
    );
  }

  const [people, fixtures] = await Promise.all([listHarnessPeople(), readFixtureReport()]);
  const aEmail = searchParams.a ?? DEFAULT_A;
  const bEmail = searchParams.b ?? DEFAULT_B;
  const pair = await readPairState(aEmail, bEmail);

  // Writes the mechanic defers past the response - the mutual click's notification
  // and both emails ride on `afterResponse` so their cost cannot be timed off the
  // reply - are invisible to the step that caused them. Catch them here, one render
  // later, and attribute them rather than losing them.
  if (pair) {
    reconcileHarnessLog(
      `${pair.a.id}:${pair.b.id}`,
      await snapshotPair(pair.a.id, pair.b.id),
      { aId: pair.a.id, bId: pair.b.id, aName: pair.a.displayName, bName: pair.b.displayName },
    );
  }
  const pairFields = pair ? { a: pair.a.email, b: pair.b.email } : { a: aEmail, b: bEmail };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--purple)]">
        Two-person driver
      </p>
      <h2 className="font-display mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[color:var(--ink)] sm:text-4xl">
        Drive both sides of a click at once.
      </h2>
      <p className="mt-2 max-w-3xl text-[0.9rem] leading-relaxed text-[color:var(--slate)]">
        Every button below runs the real server function the product runs, as the person whose
        column it sits in. The two columns are the two people&rsquo;s own views of the same moment -
        so the moment one column shows something the other does not, you are looking at the privacy
        rule working.
      </p>

      <div className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-5">
          <FixturesPanel fixtures={fixtures} pair={pair} />
          <PeoplePanel people={people} aEmail={aEmail} bEmail={bEmail} />
          {pair ? <PairBoard pair={pair} fixtures={fixtures} /> : (
            <Panel title="Pick two different QA people" caption="Both must be @click.local accounts that exist.">
              <p className="text-[0.82rem] text-[color:var(--slate)]">
                No pair loaded for <code>{aEmail}</code> + <code>{bEmail}</code>.
              </p>
            </Panel>
          )}
        </div>
        <HarnessLog entries={readHarnessLog()} pairFields={pairFields} />
      </div>
    </div>
  );
}

function FixturesPanel({
  fixtures,
  pair,
}: {
  fixtures: Awaited<ReturnType<typeof readFixtureReport>>;
  pair: PairState | null;
}) {
  const stale = fixtures.length === 0;
  return (
    <Panel
      title="Fixtures"
      caption="The click windows are all relative to an event's own clock, so fixtures with fixed dates go stale and every surface downstream of them looks broken. These are rebuilt from now() on demand."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="overflow-x-auto">
          {stale ? (
            <p className="rounded-[12px] bg-[color:var(--amber)]/12 p-3 text-[0.8rem] font-semibold text-[color:var(--amber-ink)]">
              No fixtures yet. Build them before anything else - without an event that ended in the
              last 48 hours and one at least 2 days out, half the mechanic has nothing to point at.
            </p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-[0.75rem]">
              <thead>
                <tr className="border-b border-[color:var(--mist)] text-[0.65rem] uppercase tracking-[0.08em] text-[color:var(--slate)]">
                  <th className="py-2 pr-3 font-semibold">Event</th>
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">Seats</th>
                  <th className="py-2 font-semibold">Why it exists</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((fixture) => (
                  <tr key={fixture.slug} className="border-b border-[color:var(--mist)] align-top last:border-0">
                    <td className="py-2 pr-3 font-semibold text-[color:var(--ink)]">
                      {fixture.title}
                      <span className="block font-mono text-[0.65rem] font-normal text-[color:var(--slate)]">
                        {fixture.slug}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[0.68rem] text-[color:var(--slate)]">
                      {relative(fixture.startsAt)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[0.68rem] text-[color:var(--slate)]">
                      {fixture.seatsTaken}/{fixture.capacity}
                    </td>
                    <td className="py-2 text-[0.7rem] leading-snug text-[color:var(--slate)]">
                      {fixture.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <HarnessButton
            label="Rebuild fixtures from now()"
            tone="primary"
            fields={{ step: "refresh_fixtures", ...pairOf(pair) }}
            hint="Idempotent. Only ever touches qa-click-* events and @click.local people."
          />
          <HarnessButton
            label="Run the lifecycle sweep"
            fields={{ step: "run_sweep", ...pairOf(pair) }}
            hint="The real cron body - expires clicks, mutuals and plans whose clocks have passed."
          />
          {pair ? (
            <HarnessButton
              label={`Fill ${sellOutTarget(pair)}`}
              fields={{
                step: "fill_event",
                ...pairOf(pair),
                event_slug: sellOutTarget(pair),
                a_id: pair.a.id,
                b_id: pair.b.id,
              }}
              hint="Takes every free seat with OTHER QA people - never the pair - so their own agreed plan can be watched selling out from under them."
            />
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function PeoplePanel({
  people,
  aEmail,
  bEmail,
}: {
  people: Awaited<ReturnType<typeof listHarnessPeople>>;
  aEmail: string;
  bEmail: string;
}) {
  const unusable = people.filter((person) => person.blockers.length > 0);
  return (
    <Panel
      title="The pair"
      caption="Only @click.local accounts. Switching the pair reloads the board; nothing is written."
    >
      <form method="get" className="flex flex-wrap items-end gap-3">
        {(["a", "b"] as const).map((slot) => (
          <label key={slot} className="flex flex-col gap-1">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[color:var(--slate)]">
              {slot === "a" ? "Left column" : "Right column"}
            </span>
            <select
              name={slot}
              defaultValue={slot === "a" ? aEmail : bEmail}
              className="rounded-[12px] border border-[color:var(--mist-strong)] bg-white px-3 py-2 text-[0.8rem] font-semibold text-[color:var(--ink)]"
            >
              {people.map((person) => (
                <option key={person.email} value={person.email}>
                  {person.displayName} ({person.email})
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          type="submit"
          className="rounded-[12px] bg-[color:var(--purple)] px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-[color:var(--purple-hover)]"
        >
          Load pair
        </button>
      </form>
      {unusable.length > 0 ? (
        <div className="mt-4 rounded-[12px] bg-[color:var(--amber)]/12 p-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--amber-ink)]">
            Cannot take part
          </p>
          <ul className="mt-1 space-y-0.5">
            {unusable.map((person) => (
              <li key={person.email} className="text-[0.75rem] text-[color:var(--ink)]">
                <strong>{person.displayName}</strong> - {person.blockers.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function PairBoard({
  pair,
  fixtures,
}: {
  pair: PairState;
  fixtures: Awaited<ReturnType<typeof readFixtureReport>>;
}) {
  const scenarios = buildScenarios(pair);
  const openWindow = fixtures.find((f) => f.slug === "qa-click-last-night");
  const closedWindow = fixtures.find((f) => f.slug === "qa-click-old-night");
  const justEnded = fixtures.find((f) => f.slug === "qa-click-just-ended");
  const tooSoon = fixtures.find((f) => f.slug === "qa-click-soon");
  const planA = fixtures.find((f) => f.slug === "qa-click-plan-a");
  const planB = fixtures.find((f) => f.slug === "qa-click-plan-b");
  const tight = fixtures.find((f) => f.slug === "qa-click-full-night");
  // A counter-proposal has to name a DIFFERENT event or it tests nothing, so the
  // alternative is chosen against whatever is actually on the table right now -
  // not against which column the button happens to sit in.
  const onTable = pair.viewA.proposal?.suggestedEventSlug ?? pair.viewB.proposal?.suggestedEventSlug;
  const alternative = onTable === planB?.slug ? planA?.slug : planB?.slug;

  return (
    <>
      <Panel
        title="Pair state"
        caption="The rows themselves, not a rendering of them. Both axes of the state model are shown because they move independently."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Field label="clicks" value={String(pair.clicks.length)} />
            {pair.clicks.slice(0, 4).map((click) => (
              <Field
                key={click.id}
                label={click.direction === "a_to_b" ? `${pair.a.displayName} →` : `${pair.b.displayName} →`}
                value={`${click.status} · ${click.surface}`}
              />
            ))}
          </div>
          <div>
            <Field label="mutual status" value={pair.mutual?.status ?? "none"} />
            <Field label="coord_state" value={pair.mutual?.coordState ?? "-"} />
            <Field label="reveal seen" value={pair.mutual ? `${pair.mutual.seenByA ? "A" : "-"} / ${pair.mutual.seenByB ? "B" : "-"}` : "-"} />
            <Field label="connected via" value={pair.mutual?.connectedReason ?? "-"} />
          </div>
          <div>
            <Field label="plan" value={pair.proposal?.status ?? "none"} />
            <Field label="plan event" value={pair.proposal?.eventTitle ?? "-"} />
            <Field label="proposed by" value={pair.proposal?.proposedBy ?? "-"} />
            <Field label="suppressed until" value={pair.suppressedUntil?.slice(0, 10) ?? "-"} />
            <Field label="blocked" value={pair.blocked ? "yes" : "no"} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="w-full sm:w-56">
            <HarnessButton
              label="Reset this pair"
              tone="danger"
              fields={{ step: "reset_pair", a: pair.a.email, b: pair.b.email }}
              hint="Clears every click, mutual, plan, suppression and block between these two so the scenarios are re-runnable. QA accounts only."
            />
          </div>
          {(["clicks", "mutual", "proposal"] as const).map((clock) => (
            <div key={clock} className="w-full sm:w-56">
              <HarnessButton
                label={`Wind the ${clock} clock back`}
                fields={{ step: "wind_clock", clock, a: pair.a.email, b: pair.b.email }}
                hint="Backdates the deadline only. The sweep is what expires it, exactly as it would in a week."
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <SideColumn
          side={pair.viewA}
          me={pair.a}
          them={pair.b}
          pair={pair}
          openWindow={openWindow?.slug}
          closedWindow={closedWindow?.slug}
          justEndedSlug={justEnded?.slug}
          tooSoonSlug={tooSoon?.slug}
          planSlug={planA?.slug}
          altSlug={alternative}
          tightSlug={tight?.slug}
        />
        <SideColumn
          side={pair.viewB}
          me={pair.b}
          them={pair.a}
          pair={pair}
          openWindow={openWindow?.slug}
          closedWindow={closedWindow?.slug}
          justEndedSlug={justEnded?.slug}
          tooSoonSlug={tooSoon?.slug}
          planSlug={planB?.slug}
          altSlug={alternative}
          tightSlug={tight?.slug}
        />
      </div>

      <Panel
        title="Scenario board"
        caption="Derived from the rows above every time this page loads. 'drive it' means there is no row that could record a pass - press the control and read the refusal."
      >
        <ul className="space-y-2">
          {scenarios.map((scenario) => (
            <ScenarioRow key={scenario.id} scenario={scenario} />
          ))}
        </ul>
      </Panel>
    </>
  );
}

function ScenarioRow({ scenario }: { scenario: Scenario }) {
  const style = STATE_STYLES[scenario.state];
  return (
    <li className="rounded-[12px] border border-[color:var(--mist)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-[8px] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] ${style.className}`}
        >
          {style.label}
        </span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[color:var(--slate)]">
          {scenario.stage}
        </span>
        <span className="text-[0.84rem] font-semibold text-[color:var(--ink)]">{scenario.title}</span>
      </div>
      <p className="mt-1 text-[0.74rem] leading-snug text-[color:var(--slate)]">
        {scenario.expectation}
      </p>
      <p className="mt-1 font-mono text-[0.68rem] leading-snug text-[color:var(--ink-soft)]">
        {scenario.detail}
      </p>
    </li>
  );
}

function SideColumn({
  side,
  me,
  them,
  pair,
  openWindow,
  closedWindow,
  justEndedSlug,
  tooSoonSlug,
  planSlug,
  altSlug,
  tightSlug,
}: {
  side: SideView;
  me: PairState["a"];
  them: PairState["b"];
  pair: PairState;
  openWindow?: string;
  closedWindow?: string;
  justEndedSlug?: string;
  tooSoonSlug?: string;
  planSlug?: string;
  altSlug?: string;
  tightSlug?: string;
}) {
  const mutualId = side.proposal?.mutualId ?? pair.mutual?.id ?? "";
  const proposalId = side.proposal?.id ?? "";
  const canCoordinate = pair.mutual?.status === "active";
  const planEventSlug = side.proposal?.suggestedEventSlug ?? "";
  // Every step is bracketed by a snapshot of THIS pair, so every control has to
  // name the pair it belongs to - including the ones that act on one person.
  const p = { a: pair.a.email, b: pair.b.email };

  return (
    <Panel
      title={me.displayName}
      caption={`Signed in as ${me.email}. Everything here is what this person's own session returns.`}
    >
      {side.error ? (
        <p className="mb-3 rounded-[12px] bg-[color:var(--danger)]/10 p-3 text-[0.78rem] font-semibold text-[color:var(--danger)]">
          {side.error}
        </p>
      ) : null}

      <div className="rounded-[12px] bg-[color:var(--lav-bg)] p-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[color:var(--slate)]">
          What {me.displayName} can see about {them.displayName}
        </p>
        <Field label="shows as clicked" value={side.seesClicked ? "yes" : "no"} />
        <Field label="shows as mutual" value={side.seesMutual ? "yes" : "no"} />
        <Field label="mutual in their list" value={side.mutual ? "yes" : "no"} />
        <Field label="plan in their list" value={side.proposal ? side.proposal.coordState : "none"} />
        <Field label="post-event prompts" value={String(side.postEventPrompts)} />
        {side.proposal ? (
          <>
            <Field label="intent line" value={side.proposal.intentLine} />
            <Field label="reveal seen" value={side.proposal.revealSeen ? "yes" : "no"} />
            <Field label="their seat" value={side.proposal.otherHasSeat ? "taken" : "-"} />
            <Field label="own seat" value={side.proposal.viewerHasSeat ? "taken" : "-"} />
          </>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[color:var(--slate)]">
          Send
        </p>
        <HarnessButton
          label={`Click with ${them.displayName} (discovery)`}
          tone="primary"
          fields={{ step: "send_discovery", ...p, actor: me.email, target_id: them.id }}
        />
        {openWindow ? (
          <HarnessButton
            label={`Click from the open window`}
            fields={{
              step: "send_post_event",
              ...p,
              actor: me.email,
              target_id: them.id,
              event_slug: openWindow,
            }}
            hint="Process 2 - event-bound, and must never form a mutual with a discovery click."
          />
        ) : null}
        {closedWindow ? (
          <HarnessButton
            label="Click from the closed window"
            fields={{
              step: "send_post_event",
              ...p,
              actor: me.email,
              target_id: them.id,
              event_slug: closedWindow,
            }}
            hint="Must refuse, and the refusal must not reveal whether the other person was there."
          />
        ) : null}
        {justEndedSlug ? (
          <HarnessButton
            label="Click from the window that just opened"
            fields={{
              step: "send_post_event",
              ...p,
              actor: me.email,
              target_id: them.id,
              event_slug: justEndedSlug,
            }}
            hint="Ended 30 minutes ago. The send window opens the moment an event ends, but the prompt waits 2 hours - so this must be accepted while the post-event prompt count stays 0."
          />
        ) : null}
        <HarnessButton
          label={`Click with ${me.displayName} (yourself)`}
          fields={{ step: "send_self", ...p, actor: me.email, target_id: me.id }}
          hint="Must refuse, and this one is safe to name plainly - a self-click discloses nothing about anybody."
        />
        {openWindow ? (
          <>
            <HarnessButton
              label="Spend the post-event budget"
              fields={{ step: "spend_post_event_budget", ...p, actor: me.email, event_slug: openWindow }}
              hint="Sends three real clicks at other QA people from the open window. The next click at that event must then refuse on the cap."
            />
            <HarnessButton
              label="Leave the open window's guest list"
              tone="danger"
              fields={{ step: "leave_event", ...p, actor: me.email, event_slug: openWindow }}
              hint="Drops this person's own seat, so the pair are no longer both on the participant list - the refusal that must look identical to a blocked or hidden receiver."
            />
          </>
        ) : null}

        <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[color:var(--slate)]">
          Coordinate
        </p>
        <HarnessButton
          label="Mark the reveal seen"
          fields={{ step: "mark_seen", ...p, actor: me.email, mutual_id: mutualId }}
          disabled={!mutualId}
          disabledReason="No mutual yet."
        />
        {planSlug ? (
          <HarnessButton
            label={`Suggest ${planSlug}`}
            fields={{ step: "suggest", ...p, actor: me.email, mutual_id: mutualId, event_slug: planSlug }}
            disabled={!canCoordinate}
            disabledReason="Needs an active mutual."
          />
        ) : null}
        {tooSoonSlug ? (
          <HarnessButton
            label={`Suggest ${tooSoonSlug}`}
            fields={{ step: "suggest", ...p, actor: me.email, mutual_id: mutualId, event_slug: tooSoonSlug }}
            disabled={!canCoordinate}
            disabledReason="Needs an active mutual click."
            hint="24 hours out, under the 48-hour floor. The floor lives in the picker, not in the writer, so naming it directly is allowed on purpose - this must be ACCEPTED."
          />
        ) : null}
        {tightSlug ? (
          <HarnessButton
            label={`Suggest ${tightSlug}`}
            fields={{ step: "suggest", ...p, actor: me.email, mutual_id: mutualId, event_slug: tightSlug }}
            disabled={!canCoordinate}
            disabledReason="Needs an active mutual."
            hint="Room for exactly two - agree on this one, then fill it from the fixtures panel to watch it sell out."
          />
        ) : null}
        {altSlug ? (
          <HarnessButton
            label={`Counter with ${altSlug}`}
            fields={{
              step: "counter",
              ...p,
              actor: me.email,
              proposal_id: proposalId,
              event_slug: altSlug,
            }}
            disabled={!proposalId}
            disabledReason="No plan on the table."
          />
        ) : null}
        <HarnessButton
          label="Confirm the plan"
          tone="primary"
          fields={{ step: "confirm", ...p, actor: me.email, proposal_id: proposalId }}
          disabled={!proposalId}
          disabledReason="No plan on the table."
        />
        <HarnessButton
          label="Let an outsider confirm it"
          tone="danger"
          fields={{ step: "outsider_confirm", ...p, proposal_id: proposalId }}
          disabled={!proposalId}
          disabledReason="No plan on the table."
          hint="A third QA persona tries to confirm a plan they are not part of. Must refuse - and refuse as an absence, never as 'not yours'."
        />
        <HarnessButton
          label="Decline the plan"
          fields={{ step: "decline", ...p, actor: me.email, proposal_id: proposalId }}
          disabled={!proposalId}
          disabledReason="No plan on the table."
        />
        <HarnessButton
          label="Take a seat on the agreed plan"
          fields={{ step: "rsvp", ...p, actor: me.email, event_slug: planEventSlug }}
          disabled={!planEventSlug}
          disabledReason="No agreed event."
          hint="Confirming a plan is not booking it - this is the separate step."
        />
        <HarnessButton
          label="Join the waitlist together"
          fields={{ step: "waitlist_together", ...p, actor: me.email, mutual_id: mutualId }}
          disabled={!mutualId}
          disabledReason="No mutual yet."
        />
        <HarnessButton
          label="Mark as connected"
          fields={{ step: "mark_connected", ...p, actor: me.email, mutual_id: mutualId }}
          disabled={!mutualId}
          disabledReason="No mutual yet."
        />

        <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[color:var(--slate)]">
          End it
        </p>
        <HarnessButton
          label="Not feeling it"
          fields={{ step: "release", ...p, actor: me.email, mutual_id: mutualId }}
          disabled={!mutualId}
          disabledReason="No mutual yet."
          hint="The drawer's deliberate no. Silent to the other side, and holds the pair apart for 90 days."
        />
        <HarnessButton
          label="Set it down"
          fields={{ step: "soft_release", ...p, actor: me.email, mutual_id: mutualId }}
          disabled={!mutualId}
          disabledReason="No mutual yet."
          hint="The quieter exit. Also silent, but no 90-day hold - only the shorter rediscovery cooldown."
        />
        <HarnessButton
          label={`Block ${them.displayName}`}
          tone="danger"
          fields={{ step: "block", ...p, actor: me.email, target_id: them.id }}
        />
      </div>
    </Panel>
  );
}

/**
 * Which event to sell out from under the pair.
 *
 * Their OWN agreed plan whenever they have one - that is the scenario the
 * runbook actually describes, and filling some unrelated event proves nothing.
 * The capacity-2 fixture is only the fallback for a pair with no plan yet.
 */
function sellOutTarget(pair: PairState): string {
  const agreed = pair.viewA.proposal?.suggestedEventSlug ?? pair.viewB.proposal?.suggestedEventSlug;
  return agreed && agreed.startsWith("qa-") ? agreed : "qa-click-full-night";
}

/** The pair a step belongs to, so its before/after snapshot brackets the right rows. */
function pairOf(pair: PairState | null): Record<string, string> {
  return pair ? { a: pair.a.email, b: pair.b.email } : {};
}

function relative(iso: string): string {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  const abs = Math.abs(hours);
  const value = abs < 48 ? `${Math.round(abs)}h` : `${Math.round(abs / 24)}d`;
  return hours < 0 ? `${value} ago` : `in ${value}`;
}
