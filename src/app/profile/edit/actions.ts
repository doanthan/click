"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateOwnProfile } from "@/lib/event-repository";

const VALID_INTENTS = new Set(["friendship", "dating", "networking", "exploring"]);

function strField(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function saveProfileEditAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/profile/edit");
  }

  const intents = formData
    .getAll("intent")
    .filter((v): v is string => typeof v === "string")
    .filter((v) => VALID_INTENTS.has(v));

  const ageRaw = strField(formData, "age").trim();
  const ageParsed = ageRaw ? Number.parseInt(ageRaw, 10) : null;

  await updateOwnProfile(session, {
    displayName: strField(formData, "display_name"),
    suburb: strField(formData, "suburb"),
    bio: strField(formData, "bio"),
    photoUrl: strField(formData, "photo_url"),
    age: Number.isFinite(ageParsed as number) && (ageParsed as number) >= 18 ? ageParsed : null,
    intents,
  });

  revalidatePath("/profile");
  redirect("/profile");
}
