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
