"use server";

import { auth } from "@/auth";
import type { ClickQuizState } from "@/lib/click-quiz";
import {
  getClickQuizForSession,
  getPersonalizedDiscovery,
  getProfileStatus,
  saveClickQuiz,
} from "@/lib/event-repository";

// The Click quiz's server calls, shared by the modal (life-quiz-modal.tsx) and
// the /quiz/life page. None of them redirects or revalidates. The modal can be
// open over /dashboard, where the quiz row it hangs off disappears the moment
// the quiz counts as done, so a revalidating save would unmount the finish
// screen before anyone saw it. The modal refreshes the page it closes onto
// instead.

/**
 * Throws when signed out or the database is unreachable, so the modal shows
 * "couldn't open" rather than a blank board a Finish would save over.
 */
export async function loadClickQuizAction(): Promise<ClickQuizState> {
  return getClickQuizForSession(await auth());
}

/** Every step's autosave, and Finish. The payload is untrusted: saveClickQuiz
    sanitises the answers against the taxonomy and clamps the step. */
export async function saveClickQuizAction(input: {
  answers: unknown;
  step: number;
  finish: boolean;
}): Promise<{ completed: boolean }> {
  return saveClickQuiz(await auth(), {
    answers: input?.answers,
    step: Number(input?.step),
    finish: input?.finish === true,
  });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The finish screen's strip: the member's own ranking, read after the save so
 * it already leans on the new answers, cut to the next seven days so "this
 * week" is true. `popular` means the ranker fell back to its cold-start feed,
 * which the strip then says out loud. Never throws - the finish screen stands
 * without the strip.
 */
export async function loadQuizSuggestionsAction() {
  try {
    const session = await auth();
    const [discovery, status] = await Promise.all([
      getPersonalizedDiscovery(session, 24),
      getProfileStatus(session),
    ]);
    if (!discovery) return null;
    const now = Date.now();
    const events = discovery.events
      .filter((event) => {
        const startsAt = Date.parse(event.startsAt);
        return startsAt > now && startsAt - now <= WEEK_MS;
      })
      .slice(0, 3);
    return { popular: discovery.fallback, events, bookmarkedIds: status.bookmarkedEventIds };
  } catch {
    return null;
  }
}
