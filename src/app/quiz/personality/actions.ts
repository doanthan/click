"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  savePersonalityQuiz,
  type PersonalityQuizInput,
} from "@/lib/event-repository";

const SOCIAL: PersonalityQuizInput["socialEnergy"][] = ["introvert", "ambivert", "extrovert"];
const PACE: PersonalityQuizInput["pace"][] = ["relaxed", "balanced", "fast_moving"];
const OPENNESS: PersonalityQuizInput["openness"][] = ["cautious", "curious", "ready"];
const FREQ: PersonalityQuizInput["engagementFrequency"][] = ["occasional", "active", "enthusiastic"];

function pickEnum<T extends string>(value: FormDataEntryValue | null, allowed: T[]): T | null {
  if (typeof value !== "string") return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

const PERSONAS: { code: string; name: string }[] = [
  { code: "the-spark", name: "The Spark" },
  { code: "the-anchor", name: "The Anchor" },
  { code: "the-flâneur", name: "The Flâneur" },
  { code: "the-explorer", name: "The Explorer" },
];

export async function submitPersonalityQuizAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/quiz/personality");
  }

  const socialEnergy = pickEnum(formData.get("social_energy"), SOCIAL);
  const pace = pickEnum(formData.get("pace"), PACE);
  const openness = pickEnum(formData.get("openness"), OPENNESS);
  const frequency = pickEnum(formData.get("frequency"), FREQ);

  if (!socialEnergy || !pace || !openness || !frequency) {
    redirect("/quiz/personality?error=incomplete");
  }

  const intentMix = {
    friendship: Number(formData.get("intent_friendship") ?? 0),
    dating: Number(formData.get("intent_dating") ?? 0),
    networking: Number(formData.get("intent_networking") ?? 0),
    exploring: Number(formData.get("intent_exploring") ?? 0),
  };

  let personaCode = "the-explorer";
  if (socialEnergy === "extrovert" && frequency === "enthusiastic") personaCode = "the-spark";
  else if (socialEnergy === "introvert" && pace === "relaxed") personaCode = "the-anchor";
  else if (openness === "curious") personaCode = "the-flâneur";
  const personaName = PERSONAS.find((p) => p.code === personaCode)?.name ?? "The Explorer";

  await savePersonalityQuiz(session, {
    personaName,
    socialEnergy: socialEnergy as PersonalityQuizInput["socialEnergy"],
    pace: pace as PersonalityQuizInput["pace"],
    openness: openness as PersonalityQuizInput["openness"],
    engagementFrequency: frequency as PersonalityQuizInput["engagementFrequency"],
    intentMix,
  });

  revalidatePath("/quiz");
  redirect("/quiz?from=personality");
}
