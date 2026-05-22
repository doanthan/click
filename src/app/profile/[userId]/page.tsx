import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProfileView } from "@/components/profile-view";
import { getPublicProfile } from "@/lib/event-repository";

export const metadata = {
  title: "Member profile | Click",
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await auth();
  const profile = await getPublicProfile(userId, session);

  if (!profile) notFound();

  return <ProfileView profile={profile} />;
}
