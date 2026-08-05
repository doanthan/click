"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateOwnProfile } from "@/lib/event-repository";
import {
  sanitizeProfilePrompts,
  type ProfilePromptAnswer,
} from "@/lib/profile-prompts";

const VALID_INTENTS = new Set([
  "friendship",
  "dating",
  "networking",
  "exploring",
  "hobbies",
  "wellness",
  "community",
  "new_in_town",
]);

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

  // Curated tag slugs from the interest / music pickers. The repository matches
  // these against existing admin tags (unknown slugs are dropped) and replaces
  // the user's tags of each type, so an empty array clears that group.
  const strList = (key: string) =>
    formData.getAll(key).filter((v): v is string => typeof v === "string" && v.trim() !== "");

  const ageRaw = strField(formData, "age").trim();
  const ageParsed = ageRaw ? Number.parseInt(ageRaw, 10) : null;

  // Blank or under-18 input leaves the stored age untouched - the same
  // "absent field → leave unchanged" idiom as boolField below.
  //
  // This must never write NULL. Onboarding is what populates `age` (from the
  // required DOB), the field here is labelled "Optional", and the click gate
  // reads the column directly: `(sender?.age ?? 0) < MIN_CLICK_AGE` in
  // event-repository.ts. Clearing an optional field therefore used to lock the
  // user out of clicking with *everyone*, with the refusal worded as though the
  // other person were unavailable.
  const age =
    ageParsed !== null && Number.isFinite(ageParsed) && ageParsed >= 18 ? ageParsed : undefined;

  // Blank suburb means "leave the stored suburb alone", not "clear it" - the
  // same "absent field → leave unchanged" idiom as `age` above.
  //
  // The suburb <select> can only be filled from the postcode lookup beside it,
  // and that lookup is a client-side fetch. With scripting off - or simply
  // before the lookup lands - the select posts "", and updateOwnProfile turns
  // "" into NULL (`params.push(input.suburb.trim() || null)`), so someone
  // editing only their bio silently wiped their suburb, taking profile
  // completion and the `same_suburb` matching feature down with it. This form
  // has no way to clear a suburb on purpose either (its empty <option> is
  // `disabled`), so treating blank as "unchanged" costs no capability. The
  // client-side pair check in profile-edit-form.tsx is the friendly first line;
  // this is the belt that holds when there is no JavaScript to run it.
  const suburb = strField(formData, "suburb").trim();

  // Discovery toggles submit a hidden "true"/"false" field each. Absent field
  // (e.g. dating toggle hidden because dating isn't selected) → leave unchanged.
  const boolField = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v === "true" : undefined;
  };

  // Prompts ride in one hidden JSON field. Absent or unparseable → leave the
  // stored prompts unchanged; present → full replace (empty array clears).
  let prompts: ProfilePromptAnswer[] | undefined;
  const promptsRaw = formData.get("prompts_json");
  if (typeof promptsRaw === "string") {
    try {
      prompts = sanitizeProfilePrompts(JSON.parse(promptsRaw));
    } catch {
      prompts = undefined;
    }
  }

  await updateOwnProfile(session, {
    displayName: strField(formData, "display_name"),
    suburb: suburb || undefined,
    bio: strField(formData, "bio"),
    photoUrl: strField(formData, "photo_url"),
    age,
    intents,
    interestTags: strList("interest_tag"),
    musicTags: strList("music_tag"),
    datingVisible: boolField("dating_visible"),
    flexibleDiscovery: boolField("flexible_discovery"),
    prompts,
  });

  // Revalidate every surface that reflects profile completeness — not just
  // /profile. The dashboard's "profile completion %" reads bio/suburb/photo, so
  // without busting it the saved bio looks like it "hasn't been updated yet".
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/dashboard");
  redirect("/profile");
}
