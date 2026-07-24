"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  confirmProposal,
  declineProposalForSession,
  markMutualSeen,
  proposeAlternativeForProposal,
  suggestPlanForMutual,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProposalActionState = { ok: boolean; error: string | null };

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Something went wrong. Please try again.";
}

export async function confirmProposalAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/proposals");

  const id = formData.get("proposal_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return { ok: false, error: "Couldn't find that proposal." };
  }

  try {
    await confirmProposal(session, id);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/proposals");
  return { ok: true, error: null };
}

// §4: mark the one-time mutual reveal as seen for the current user. Best-effort -
// a failed stamp only risks the reveal showing once more, never blocks the drawer,
// so it never throws into the client. No revalidate: the drawer drives itself.
export async function markMutualSeenAction(mutualId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  if (typeof mutualId !== "string" || !UUID_RE.test(mutualId)) return;
  try {
    await markMutualSeen(session, mutualId);
  } catch {
    /* best-effort */
  }
}

export async function proposeAlternativeAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/proposals");

  const id = formData.get("proposal_id");
  const slug = formData.get("event_slug");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return { ok: false, error: "Couldn't find that proposal." };
  }
  if (typeof slug !== "string" || !slug) {
    return { ok: false, error: "Pick an event from the catalogue first." };
  }

  try {
    await proposeAlternativeForProposal(session, id, slug);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/proposals");
  return { ok: true, error: null };
}

// §B6: decline the current plan - returns the mutual to `open`, no blame surfaced.
export async function declineProposalAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/proposals");

  const id = formData.get("proposal_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return { ok: false, error: "Couldn't find that proposal." };
  }

  try {
    await declineProposalForSession(session, id);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/proposals");
  return { ok: true, error: null };
}

// §B4 (`open` step): suggest a fresh plan for a mutual that has none pending.
export async function suggestPlanAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/proposals");

  const mutualId = formData.get("mutual_id");
  const slug = formData.get("event_slug");
  if (typeof mutualId !== "string" || !UUID_RE.test(mutualId)) {
    return { ok: false, error: "Couldn't find that connection." };
  }
  if (typeof slug !== "string" || !slug) {
    return { ok: false, error: "Pick an event from the catalogue first." };
  }

  try {
    await suggestPlanForMutual(session, mutualId, slug);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/proposals");
  return { ok: true, error: null };
}
