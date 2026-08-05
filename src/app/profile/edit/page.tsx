import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Icon } from "@/components/ds";
import { ProfileEditForm } from "@/components/profile-edit-form";
import {
  getOwnProfile,
  getProfileCompletion,
  getProfileTagOptions,
} from "@/lib/event-repository";

export const metadata = {
  title: "Edit profile",
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

  // The same checklist the dashboard shows. Four of its five items are edited on
  // this page, so it belongs here too - the form re-answers those four against
  // live state and leaves the rest of the definition to the repository.
  const [tagOptions, completion] = await Promise.all([
    getProfileTagOptions(),
    getProfileCompletion(session),
  ]);

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-8 text-[color:var(--ink)]">
      <div className="ck-page pt-6">
        {/* Sub-page: ONE quiet "back" link, top-left on its own row. */}
        <Link
          href="/profile"
          className="font-display -ml-1 inline-flex items-center gap-1.5 px-1 py-1.5 text-[14px] font-semibold text-[color:var(--slate)] hover:text-[color:var(--ink)]"
        >
          <Icon name="chevL" size={18} stroke={2.4} />
          Back to profile
        </Link>

        {/* Narrow page: capped, LEFT-aligned at the container gutter. */}
        <div className="max-w-[720px]">
          <h1 className="font-display mt-1.5 text-[length:var(--text-h1)] font-semibold leading-tight tracking-[-0.02em]">
            Edit profile
          </h1>
          <p className="mt-1.5 text-[15px] text-[color:var(--slate)]">
            Your photos, your words, and the things you&apos;re into.
          </p>

          <ProfileEditForm profile={profile} tagOptions={tagOptions} completion={completion} />
        </div>
      </div>
    </main>
  );
}
