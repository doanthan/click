/**
 * Curated profile prompts (Hinge-style icebreakers).
 *
 * Single source of truth for the prompt catalogue, shared by the /profile/edit
 * picker (client) and the server-side sanitiser. Answers persist on
 * `profiles.prompts` as jsonb `[{ id, answer }]` (migration 042) — only the id
 * is stored, so a label tweak here updates every profile retroactively.
 *
 * Keep this file dependency-free: it's imported by client components and must
 * not pull server-only modules into the bundle.
 */

export type ProfilePromptAnswer = {
  id: string;
  answer: string;
};

export const MAX_PROFILE_PROMPTS = 3;
export const MAX_PROMPT_ANSWER_LENGTH = 300;

export const PROFILE_PROMPTS: { id: string; label: string }[] = [
  { id: "two-truths-and-a-lie", label: "Two truths and a lie" },
  { id: "perfect-sunday", label: "My perfect Sunday looks like" },
  { id: "talk-to-me-about", label: "Talk to me about" },
  { id: "at-an-event", label: "At an event you'll find me" },
  { id: "unpopular-opinion", label: "My most unpopular opinion" },
  { id: "never-shut-up-about", label: "I'll never shut up about" },
  { id: "go-to-karaoke", label: "My go-to karaoke song" },
  { id: "bucket-list", label: "Top of my bucket list" },
  { id: "simple-pleasures", label: "My simple pleasures" },
  { id: "best-event-ever", label: "The best event I've ever been to" },
];

const LABEL_BY_ID = new Map(PROFILE_PROMPTS.map((p) => [p.id, p.label]));

export function promptLabel(id: string): string | null {
  return LABEL_BY_ID.get(id) ?? null;
}

/**
 * Normalises untrusted prompt input (form JSON or a raw jsonb column value)
 * into the stored shape: known prompt ids only, deduped, answers trimmed and
 * capped, empty answers dropped, at most MAX_PROFILE_PROMPTS entries.
 */
export function sanitizeProfilePrompts(raw: unknown): ProfilePromptAnswer[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const cleaned: ProfilePromptAnswer[] = [];

  for (const entry of raw) {
    if (cleaned.length >= MAX_PROFILE_PROMPTS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const { id, answer } = entry as { id?: unknown; answer?: unknown };
    if (typeof id !== "string" || !LABEL_BY_ID.has(id) || seen.has(id)) continue;
    if (typeof answer !== "string") continue;
    const trimmed = answer.trim().slice(0, MAX_PROMPT_ANSWER_LENGTH);
    if (!trimmed) continue;
    seen.add(id);
    cleaned.push({ id, answer: trimmed });
  }

  return cleaned;
}

/** Stored prompts → display shape (label resolved, unknown ids dropped). */
export function resolveProfilePrompts(
  raw: unknown,
): { id: string; label: string; answer: string }[] {
  return sanitizeProfilePrompts(raw).map((p) => ({
    id: p.id,
    label: LABEL_BY_ID.get(p.id)!,
    answer: p.answer,
  }));
}
