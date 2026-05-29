"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { confirmProposal, proposeAlternativeForProposal } from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function confirmProposalAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/proposals");

  const id = formData.get("proposal_id");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;

  try {
    await confirmProposal(session, id);
  } catch {
    // Swallow; rerender reflects current state (e.g. expired).
  }
  revalidatePath("/proposals");
}

export async function proposeAlternativeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/proposals");

  const id = formData.get("proposal_id");
  const slug = formData.get("event_slug");
  if (typeof id !== "string" || !UUID_RE.test(id)) return;
  if (typeof slug !== "string" || !slug) return;

  try {
    await proposeAlternativeForProposal(session, id, slug);
  } catch {
    // Swallow; rerender reflects current state (e.g. limit reached).
  }
  revalidatePath("/proposals");
}
