import "server-only";
import type { Session } from "next-auth";
import { auth, isAdminEmail } from "@/auth";
import { accountSwitchActor } from "@/lib/account-switch-policy";
import {
  confirmProposal,
  createUserClickForSession,
  markMutualConnectedForSession,
  markMutualSeen,
  proposeAlternativeForProposal,
  registerForEvent,
  softReleaseMutualForSession,
  suggestPlanForMutual,
  testCreatedEventSql,
} from "@/lib/event-repository";
import { getPostgresPool } from "@/lib/postgres";
import { isLocalDevelopment } from "@/lib/runtime-mode";
import { adminQaGrantEmail } from "@/lib/test-switcher";

/**
 * The Test pairs hooks (03 §10): /dev/coord/reset, /dev/coord/set,
 * /dev/coord/reveal_seen and /dev/clock/advance. They run in production - there
 * is no staging - so every one of them goes through guardDevPair first:
 *
 *   1. an ADMIN is behind the request (their own session, an admin viewing an
 *      account, or a QA unlock an admin minted - never the shared tester key);
 *   2. BOTH people in the pair are test accounts (profiles.is_test);
 *   3. every event the call touches - named in it, or referenced by the pair's
 *      clicks, plans and mutual - was created by a test account.
 *
 * Anything else is refused (403). Every call is audited: refused or failed
 * calls when they end, and a call that runs before it changes anything - if
 * that row can't be written, the hook does not run.
 * The stage jumps drive the real repository functions as the two test people,
 * never hand-written end states, so a stage reached here is one the app makes.
 */

export class DevHookRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevHookRefusedError";
  }
}

/** No admin behind the request. Logged, not written to audit_logs, so the open
 *  internet cannot fill the audit table by posting at these paths. */
class NotAdminError extends DevHookRefusedError {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DevPairPerson = { id: string; email: string; name: string };
export type DevPairContext = {
  actorEmail: string;
  actorProfileId: string | null;
  a: DevPairPerson;
  b: DevPairPerson;
};

/** Who the admin behind this request is, or null if there is none. */
async function adminBehindRequest(): Promise<string | null> {
  const session = await auth().catch(() => null);
  const actor = accountSwitchActor(session, isAdminEmail);
  if (actor) return actor.email;
  const granted = await adminQaGrantEmail();
  if (granted) return granted;
  // Local development already opens the QA tools to the machine (dev binds to
  // 127.0.0.1); the pair and event rules below still apply.
  return isLocalDevelopment() ? "local-development" : null;
}

/** 03 §10's guard. Throws DevHookRefusedError (403) unless all three hold. */
export async function guardDevPair(
  aId: string,
  bId: string,
  eventSlugs: string[] = [],
  admin?: string,
): Promise<DevPairContext> {
  const actorEmail = admin ?? (await adminBehindRequest());
  if (!actorEmail) throw new NotAdminError("Admin only.");
  if (!UUID.test(aId) || !UUID.test(bId) || aId === bId) {
    throw new DevHookRefusedError("Name two different test accounts by id.");
  }
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");

  const people = await pool.query<DevPairPerson & { is_test: boolean }>(
    `select id::text, email::text, display_name as name, is_test
       from profiles where id = any($1::uuid[])`,
    [[aId, bId]],
  );
  if (people.rows.length !== 2 || people.rows.some((row) => !row.is_test)) {
    throw new DevHookRefusedError("Both people must be test accounts.");
  }

  const events = await pool.query<{ slug: string; test_created: boolean }>(
    `
      select e.slug, ${testCreatedEventSql("e")} as test_created
      from events e
      where e.slug = any($3::text[])
         or e.id in (
           select c.event_id from clicks c
           where c.event_id is not null
             and ((c.sender_id = $1::uuid and c.receiver_id = $2::uuid)
               or (c.sender_id = $2::uuid and c.receiver_id = $1::uuid))
           union
           select p.suggested_event_id from click_proposals p
           join mutual_clicks m on m.id = p.mutual_click_id
           where m.user_a_id = least($1::uuid, $2::uuid) and m.user_b_id = greatest($1::uuid, $2::uuid)
           union
           select m.connected_event_id from mutual_clicks m
           where m.user_a_id = least($1::uuid, $2::uuid) and m.user_b_id = greatest($1::uuid, $2::uuid)
             and m.connected_event_id is not null
         )
    `,
    [aId, bId, eventSlugs],
  );
  const found = new Set(events.rows.map((row) => row.slug));
  const missing = eventSlugs.filter((slug) => !found.has(slug));
  if (missing.length > 0) throw new DevHookRefusedError(`No event ${missing.join(", ")}.`);
  const real = events.rows.filter((row) => !row.test_created).map((row) => row.slug);
  if (real.length > 0) {
    throw new DevHookRefusedError(`Not a test-created event: ${real.join(", ")}.`);
  }

  const actor = await pool.query<{ id: string }>(
    `select id::text from profiles where email = $1::citext limit 1`,
    [actorEmail],
  );
  const byId = new Map(people.rows.map((row) => [row.id, row]));
  return {
    actorEmail,
    actorProfileId: actor.rows[0]?.id ?? null,
    a: byId.get(aId)!,
    b: byId.get(bId)!,
  };
}

/** One audit_logs row (03 §10). Never throws unless `required`. */
export async function auditDevHook(
  hook: string,
  context: Partial<DevPairContext> | null,
  metadata: Record<string, unknown>,
  { required = false }: { required?: boolean } = {},
) {
  const pool = getPostgresPool();
  if (!pool) {
    if (required) throw new Error("Database unavailable.");
    return;
  }
  try {
    await pool.query(
      `insert into audit_logs (actor_profile_id, action, entity_table, entity_id, metadata)
       values ($1::uuid, $2, 'profiles', $3::uuid, $4::jsonb)`,
      [
        context?.actorProfileId ?? null,
        `dev.${hook}`,
        context?.a?.id ?? null,
        JSON.stringify({ actor: context?.actorEmail ?? null, b: context?.b?.id ?? null, ...metadata }),
      ],
    );
  } catch (error) {
    console.warn("[dev-hooks] audit write failed", { hook, error });
    if (required) throw new Error("Couldn't write the audit row, so the hook did not run.");
  }
}

/**
 * Every hook, from /dev/* and from /test-click: the admin, then the request's
 * own checks (a known stage, say) and the guard (403), an audit row BEFORE
 * anything changes - refused if it can't be written, so no call is ever
 * unaudited - then the hook, then its outcome. Every refusal and failure past
 * the admin check is audited too, naming the admin; `request` carries the pair
 * asked for. The hook only ever sees the pair the guard cleared.
 */
export async function runGuardedDevHook(
  hook: string,
  request: Record<string, unknown>,
  prepare: () => HookPlan & { a: string; b: string },
): Promise<string> {
  const actorEmail = await adminBehindRequest();
  if (!actorEmail) throw new NotAdminError("Admin only.");
  let context: DevPairContext | null = null;
  try {
    const plan = prepare();
    context = await guardDevPair(plan.a, plan.b, plan.events, actorEmail);
    await auditDevHook(hook, context, { request, outcome: "started" }, { required: true });
    const message = await plan.run(context);
    await auditDevHook(hook, context, { request, outcome: "ok", message });
    return message;
  } catch (error) {
    await auditDevHook(hook, context ?? { actorEmail }, {
      request,
      outcome: error instanceof DevHookRefusedError ? "refused" : "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** A session for a test account the guard has already cleared. */
function testSession(person: DevPairPerson): Session {
  return {
    user: { email: person.email, name: person.name, image: null },
    expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  } as Session;
}

/**
 * /dev/coord/reset - the pair back to "never met": the pair's own rows, and
 * the two people's post-event answers on test-created events only. A swap row
 * goes with the pair click it names (click_swaps cascades off clicks, 049).
 */
export async function resetDevPair(context: DevPairContext): Promise<string[]> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");
  const client = await pool.connect();
  const cleared: string[] = [];
  try {
    await client.query("begin");
    // click_proposals cascade off mutual_clicks (049).
    const steps: Array<[string, string]> = [
      [
        "clicks",
        `delete from clicks
          where (sender_id = $1::uuid and receiver_id = $2::uuid)
             or (sender_id = $2::uuid and receiver_id = $1::uuid)`,
      ],
      [
        "mutual_clicks (+ plans)",
        `delete from mutual_clicks
          where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)`,
      ],
      [
        "pair_suppressions",
        `delete from pair_suppressions
          where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)`,
      ],
      [
        "post_event_click_answers (test events)",
        `delete from post_event_click_answers answer
          using events e
          where answer.event_id = e.id
            and answer.profile_id in ($1::uuid, $2::uuid)
            and ${testCreatedEventSql("e")}`,
      ],
      [
        "user_blocks",
        `delete from user_blocks
          where (blocker_profile_id = $1::uuid and blocked_profile_id = $2::uuid)
             or (blocker_profile_id = $2::uuid and blocked_profile_id = $1::uuid)`,
      ],
    ];
    for (const [label, sql] of steps) {
      const result = await client.query(sql, [context.a.id, context.b.id]);
      if (result.rowCount) cleared.push(`${label}: ${result.rowCount}`);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return cleared.length > 0 ? cleared : ["nothing to clear - the pair was already fresh"];
}

/** Max hours one /dev/clock/advance call moves the pair's clock. */
export const DEV_CLOCK_MAX_HOURS = 24 * 30;

/**
 * /dev/clock/advance - "moves only that pair's timestamps back by N hours,
 * never a real clock, never a non-test row" (03 §10). Every timestamp on the
 * pair's clicks, mutual, plans and suppression moves back together, so the
 * pair looks N hours older to every read; the real lifecycle sweep then acts
 * on it exactly as it would have.
 */
export async function advanceDevPairClock(context: DevPairContext, hours: number): Promise<string> {
  if (!Number.isInteger(hours) || hours < 1 || hours > DEV_CLOCK_MAX_HOURS) {
    throw new DevHookRefusedError(`Hours must be a whole number from 1 to ${DEV_CLOCK_MAX_HOURS}.`);
  }
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");
  const shift = `($3::int * interval '1 hour')`;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const pair = [context.a.id, context.b.id, hours];
    const clicks = await client.query(
      `update clicks set created_at = created_at - ${shift}, updated_at = updated_at - ${shift},
                         expires_at = expires_at - ${shift}
        where (sender_id = $1::uuid and receiver_id = $2::uuid)
           or (sender_id = $2::uuid and receiver_id = $1::uuid)`,
      pair,
    );
    const proposals = await client.query(
      `update click_proposals p
          set created_at = p.created_at - ${shift}, updated_at = p.updated_at - ${shift},
              expires_at = p.expires_at - ${shift}, confirmed_at = p.confirmed_at - ${shift}
         from mutual_clicks m
        where m.id = p.mutual_click_id
          and m.user_a_id = least($1::uuid, $2::uuid) and m.user_b_id = greatest($1::uuid, $2::uuid)`,
      pair,
    );
    const mutuals = await client.query(
      `update mutual_clicks
          set mutual_at = mutual_at - ${shift}, expires_at = expires_at - ${shift},
              ended_at = ended_at - ${shift}, seen_at_a = seen_at_a - ${shift},
              seen_at_b = seen_at_b - ${shift},
              unseen_release_shown_at_a = unseen_release_shown_at_a - ${shift},
              unseen_release_shown_at_b = unseen_release_shown_at_b - ${shift},
              created_at = created_at - ${shift}, updated_at = updated_at - ${shift}
        where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)`,
      pair,
    );
    const suppressions = await client.query(
      `update pair_suppressions set expires_at = expires_at - ${shift}
        where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)`,
      pair,
    );
    await client.query("commit");
    return `Moved the pair ${hours}h back: ${clicks.rowCount ?? 0} click(s), ${mutuals.rowCount ?? 0} mutual(s), ${proposals.rowCount ?? 0} plan(s), ${suppressions.rowCount ?? 0} suppression(s). Run the sweep to let the clocks act.`;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function activeMutualId(context: DevPairContext): Promise<string | null> {
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");
  const result = await pool.query<{ id: string }>(
    `select id::text from mutual_clicks
      where user_a_id = least($1::uuid, $2::uuid) and user_b_id = greatest($1::uuid, $2::uuid)
        and status = 'active'
      order by created_at desc limit 1`,
    [context.a.id, context.b.id],
  );
  return result.rows[0]?.id ?? null;
}

/** /dev/coord/reveal_seen - the reveal marked seen, for one side or both. */
export async function markDevPairRevealSeen(
  context: DevPairContext,
  side: "a" | "b" | "both",
): Promise<string> {
  const mutualId = await activeMutualId(context);
  if (!mutualId) throw new Error("The pair has no live mutual click to reveal.");
  const sides = side === "both" ? [context.a, context.b] : [side === "a" ? context.a : context.b];
  const marked: string[] = [];
  for (const person of sides) {
    if (await markMutualSeen(testSession(person), mutualId)) marked.push(person.name);
  }
  return marked.length > 0 ? `Reveal marked seen for ${marked.join(" and ")}.` : "Nothing new to mark.";
}

export const DEV_STAGES = ["reveal", "suggest", "their_plan", "both_going", "connected", "released"] as const;
export type DevStage = (typeof DEV_STAGES)[number];
const STAGES_NEEDING_EVENT: ReadonlySet<DevStage> = new Set(["suggest", "their_plan", "both_going", "connected"]);

export function devStageNeedsEvent(stage: DevStage) {
  return STAGES_NEEDING_EVENT.has(stage);
}

/**
 * /dev/coord/set - jump the pair to a stage by walking the real flow as the two
 * test people, from a reset: a clicks b and b clicks a from today's picks
 * (reveal), a suggests the event (suggest) or b does (their plan), b confirms
 * and both take a seat (both going), then a closes it as connected - or a sets
 * the mutual down (released). A refusal anywhere is the app's own answer and
 * stops the walk. The mutual may open on Click's own pick (a test-created
 * event - pairPicksSql offers a test pair nothing else); suggesting then goes
 * the way the drawer's "Suggest this to [Name]" does, re-pointing that pick.
 */
export async function setDevPairStage(
  context: DevPairContext,
  stage: DevStage,
  eventSlug: string | null,
): Promise<string> {
  if (devStageNeedsEvent(stage) && !eventSlug) {
    throw new DevHookRefusedError(`"${stage}" needs a test-created event.`);
  }
  const pool = getPostgresPool();
  if (!pool) throw new Error("Database unavailable.");
  const a = testSession(context.a);
  const b = testSession(context.b);

  await resetDevPair(context);
  // An explore send only reaches the sender's picks for today - a fixture write,
  // like the harness's; the send's own gates still run, untouched.
  await pool.query(
    `insert into daily_picks (profile_id, picked_profile_id, pool_date, reason)
     values ($1::uuid, $2::uuid, (now() at time zone 'Australia/Sydney')::date, 'dev_hook'),
            ($2::uuid, $1::uuid, (now() at time zone 'Australia/Sydney')::date, 'dev_hook')
     on conflict do nothing`,
    [context.a.id, context.b.id],
  );
  await createUserClickForSession({ clickedProfileId: context.b.id, source: "explore" }, a);
  await createUserClickForSession({ clickedProfileId: context.a.id, source: "explore" }, b);
  const mutualId = await activeMutualId(context);
  if (!mutualId) {
    throw new Error("The two clicks did not form a mutual click - check both people pass every click gate.");
  }
  if (stage === "reveal") return "Mutual click formed; neither side has seen the reveal.";
  if (stage === "released") {
    await softReleaseMutualForSession(a, mutualId);
    return "Mutual click formed, then set down (released).";
  }

  const systemPick = await pool.query<{ id: string }>(
    `select id::text from click_proposals where mutual_click_id = $1::uuid and status = 'pending' limit 1`,
    [mutualId],
  );
  const proposer = stage === "their_plan" ? b : a;
  if (systemPick.rows[0]) {
    await proposeAlternativeForProposal(proposer, systemPick.rows[0].id, eventSlug!);
  } else {
    await suggestPlanForMutual(proposer, mutualId, eventSlug!);
  }
  if (stage === "suggest") return `${context.a.name} suggested ${eventSlug}.`;
  if (stage === "their_plan") return `${context.b.name} suggested ${eventSlug} - ${context.a.name}'s move.`;

  const proposal = await pool.query<{ id: string }>(
    `select id::text from click_proposals
      where mutual_click_id = $1::uuid and status = 'pending'
      order by created_at desc limit 1`,
    [mutualId],
  );
  const proposalId = proposal.rows[0]?.id;
  if (!proposalId) throw new Error("The suggestion did not leave a plan to confirm.");
  await confirmProposal(b, proposalId);
  await registerForEvent(eventSlug!, a);
  await registerForEvent(eventSlug!, b);
  if (stage === "both_going") return `Both are going to ${eventSlug}.`;

  await markMutualConnectedForSession(a, mutualId);
  return `Both went to ${eventSlug}; the mutual is closed as connected.`;
}

type HookPlan = { events: string[]; run: (context: DevPairContext) => Promise<string> };

/**
 * One route body for every hook: parse, guard (403), run, audit. A refusal by
 * the app itself partway through a stage walk answers 409 with its own message.
 */
export async function runDevHook(
  request: Request,
  hook: string,
  plan: (body: Record<string, unknown>) => HookPlan,
): Promise<Response> {
  const noStore = { "Cache-Control": "private, no-store" };
  // Admin first, before the body is even read: a refusal for anyone else is
  // logged, never written to audit_logs (see NotAdminError).
  const actorEmail = await adminBehindRequest();
  if (!actorEmail) {
    console.warn(`[dev-hooks] ${hook} refused: no admin behind the request`);
    return Response.json({ error: "Admin only." }, { status: 403, headers: noStore });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    await auditDevHook(hook, { actorEmail }, { outcome: "refused", error: "Expected a JSON body." });
    return Response.json({ error: "Expected a JSON body." }, { status: 400, headers: noStore });
  }
  const a = typeof body?.a === "string" ? body.a : "";
  const b = typeof body?.b === "string" ? body.b : "";
  try {
    const message = await runGuardedDevHook(hook, body, () => ({ a, b, ...plan(body) }));
    return Response.json({ ok: true, message }, { headers: noStore });
  } catch (error) {
    const refused = error instanceof DevHookRefusedError;
    const text = error instanceof Error ? error.message : "Hook failed.";
    if (error instanceof NotAdminError) {
      console.warn(`[dev-hooks] ${hook} refused: no admin behind the request`);
    } else if (!refused) {
      console.warn(`[dev-hooks] ${hook} failed`, error);
    }
    return Response.json({ error: text }, { status: refused ? 403 : 409, headers: noStore });
  }
}

/** The body's event slug, if one was named. */
export function eventSlugOf(body: Record<string, unknown>): string | null {
  const slug = typeof body.event === "string" ? body.event.trim() : "";
  return slug || null;
}
