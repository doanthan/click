/**
 * The one draft slot the personality quiz uses - the full 5-step wizard on this
 * route. It was shared with a four-tap teaser on the homepage until the Click
 * persona came off the landing page (bug board #308).
 *
 * Why "local" and not "session": sign-in is a magic link, so the round trip can
 * land in a different tab. sessionStorage is per-tab and would lose the answers
 * precisely when they matter most.
 */
export const PERSONALITY_DRAFT = {
  key: "click:quiz-personality:v1",
  version: 1,
  storage: "local",
} as const;

/** Question name → chosen option value. Intent mix is deliberately NOT stored:
    it has meaningful defaults (25 each) and lives on one screen. */
export type PersonalityDraft = { answers: Record<string, string> };

/** Storage is user-writable, so nothing coming out of it is trusted to be the
    shape we wrote. Anything odd degrades to "no draft", never to a crash. */
export function readPersonalityAnswers(saved: PersonalityDraft | null | undefined): Record<string, string> {
  const raw = saved?.answers;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "string") out[name] = value;
  }
  return out;
}
