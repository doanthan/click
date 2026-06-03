import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { getOwnProfile, getProfileTagOptions } from "@/lib/event-repository";

export const metadata = {
  title: "Edit profile | Click",
};

export default async function EditProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile/edit");
  }

  const profile = await getOwnProfile(session);
  if (!profile) {
    redirect("/onboarding");
  }

  const tagOptions = await getProfileTagOptions();

  return (
    <main className="paper-noise min-h-screen bg-[color:var(--champagne)] px-4 py-8 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-4xl">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          Edit profile
        </span>

        <ProfileEditForm profile={profile} tagOptions={tagOptions} />
      </section>
    </main>
  );
}
