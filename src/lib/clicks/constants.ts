// Click-mechanic tunables (TECH/21_CLICK_MECHANIC.md v9). Centralised so the two
// coincidental 48-hour constants (§B3.2) and the two distinct 7-day clocks (§5) can be
// tuned independently and never silently move each other. The spec frames these as
// platform_settings keys; until a settings table exists they live here as the single
// source of truth shared across the send layer, detection, and coordination handshake.

// ── Send layer (§5) ────────────────────────────────────────────────────────────────
/** Discovery click (Process 1) stays live this long from creation, then silently expires. */
export const DISCOVERY_CLICK_WINDOW_DAYS = 7;
/** Post-event click (Process 2) stays live until event_end + this many hours. */
export const POST_EVENT_CLICK_WINDOW_HOURS = 48;

// ── Budgets (§2 rule 5) ──────────────────────────────────────────────────────────────
/** Max post-event clicks per user per attended event. */
export const POST_EVENT_CLICK_CAP = 3;
/** Rolling cap on live (pending) discovery clicks a user may hold — silent (never shown). */
export const DISCOVERY_CLICK_CAP = 20;

// ── Mutual lifecycle (§B2) ───────────────────────────────────────────────────────────
/** The mutual's own relationship clock — distinct from the discovery click's 7d window. */
export const MUTUAL_CLOCK_DAYS = 7;
/** Soft cap on *actionable* (open/proposed) active mutuals before down-ranking (§B7.2). */
export const ACTIVE_MUTUAL_SOFT_CAP = 8;
/** "Not feeling it" suppression window (§B7.1). */
export const PAIR_SUPPRESSION_DAYS = 90;
/** Rediscovery cooldown after a soft release (§B7.9). */
export const REDISCOVERY_COOLDOWN_DAYS = 30;

// ── Coordination handshake (§B4 / §B3.2 - one 48h timer) ─────────────────────────────
// No PROPOSAL_RESPONSE_WINDOW_HOURS. The spec's §B4.2 48-hour proposal clock was never
// shipped: both writers stamp `expires_at = now() + interval '${MUTUAL_CLOCK_DAYS} days'`,
// so a sent proposal runs the mutual's 7 days. The constant sat unreferenced beside the
// code contradicting it - wiring it up would have silently cut every live proposal from
// 7 days to 48 hours. Change the two writers first if the spec is meant to win.
/** Events sooner than this are never *suggested* (manual propose still allowed) (§B3.2). */
export const SUGGESTION_LEADTIME_FLOOR_HOURS = 48;
/** Suggestion ceiling — the load-spreader (§B3.2). */
export const SUGGESTION_WINDOW_DAYS = 30;
/** Joint counter-propose budget per coordination attempt (§B4 / legacy proposal cap). */
export const PROPOSAL_ALTERNATIVES_CAP = 3;

// ── No-show suppression (§B7.3) ──────────────────────────────────────────────────────
// "count(*) free-event no-shows in last 90d >= 2 → post_event_click_suppressed_until
// = now()+30d". Payment is the commitment, so this only ever looks at FREE events -
// a paid no-show already cost the person something.
//
// The spec's own caveat, kept here because it is easy to mistake for a bug: the signal
// is event_attendees.checked_in_at, which is only ever written when the merchant runs
// the optional door list. On an event nobody was checked into, no attendee can be
// distinguished from a no-show, so the guard deliberately does not fire at all rather
// than invent one. 21 §6.4 accepts that for MVP - making it stricter would make
// check-in load-bearing, which is banned.
/** Free-event no-shows inside the lookback that trip the suppression. */
export const NO_SHOW_SUPPRESSION_THRESHOLD = 2;
/** How far back the no-show count reaches. */
export const NO_SHOW_LOOKBACK_DAYS = 90;
/** How long the post-event click surface is withheld once tripped. */
export const NO_SHOW_SUPPRESSION_DAYS = 30;

// ── Re-engagement / liveness (§B7.4b) ────────────────────────────────────────────────
/** No app open for this long and the profile is down-ranked in discovery (never removed). */
export const INACTIVE_DOWNRANK_DAYS = 30;
/** Still gone this long after the click-triggered re-engagement mail -> fully hidden. */
export const REENGAGEMENT_GRACE_DAYS = 14;

// ── Post-event prompt (§6.8) ─────────────────────────────────────────────────────────
/** "Did you click with someone?" fires at event_end + this many hours (supersedes 12h). */
export const POST_EVENT_PROMPT_DELAY_HOURS = 2;

// ── Probing-attack defence (§6.1 / 21A) ──────────────────────────────────────────────
/** Constant response-time floor for send-click so the mutual path isn't timing-extractable. */
export const SEND_CLICK_FLOOR_MS = 350;
/**
 * Hard ceiling on send-click attempts per account per hour, enforced in
 * createUserClickForSession so it binds the two server actions as well as
 * /api/clicks. Well above any human's use of a 3-per-event / 20-live budget, and
 * low enough that walking the profile table one refusal at a time is not viable.
 */
export const SEND_CLICK_HOURLY_LIMIT = 40;

// ── Age gate (§6.7b) ─────────────────────────────────────────────────────────────────
/** The platform minimum; the click layer asserts this independently of the signup gate. */
export const MIN_CLICK_AGE = 18;

/** A click send's outcome, byte-identical across receiver states by design (§6.1). */
export type SendClickOutcome = "ok" | "not_eligible" | "cap" | "photo";

// ── Anonymity copy (CLICK_LANGUAGE §5 + §5b) ────────────────────────────────────────
//
// §5b bans the "if they click you back" construction on sight: it plants the
// could-be-no and frames a one-way click as a pending rejection, which is exactly
// the fear that stops the people Click is for from clicking at all. The rule is to
// lead with what IS true and let safety be felt, never named as a risk.
//
// One constant rather than an edit per surface: the same sentence had drifted across
// five components and two server actions, so "fixing the copy" meant finding all of
// them. Now the lock lives in one place and every click surface reads it.

/** The anonymity helper shown ONCE at the top of a click surface, never per card. */
export const CLICK_ANONYMITY_LINE =
  "🔒 Clicking is anonymous - we'll only show you if it's mutual.";

/** The confirmation after a click is sent. */
export const CLICK_SENT_LINE = "Sent privately. We'll only show you if it's mutual.";
