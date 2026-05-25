"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getOrCreateConversation,
  sendMessage,
} from "@/lib/event-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startConversationAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/messages");
  }
  const other = formData.get("other_profile_id");
  if (typeof other !== "string" || !UUID_RE.test(other)) {
    redirect("/messages");
  }
  const id = await getOrCreateConversation(session, other as string);
  if (!id) {
    redirect("/messages");
  }
  revalidatePath("/messages");
  redirect(`/messages?id=${id}`);
}

export async function sendMessageAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/messages");
  }
  const conversationId = formData.get("conversation_id");
  const body = formData.get("body");
  if (
    typeof conversationId !== "string" ||
    !UUID_RE.test(conversationId) ||
    typeof body !== "string"
  ) {
    return;
  }

  await sendMessage(session, conversationId, body);
  revalidatePath("/messages");
  redirect(`/messages?id=${conversationId}`);
}
