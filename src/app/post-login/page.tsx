import { redirect } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";
import { getProfileStatus } from "@/lib/event-repository";

export const metadata = {
  title: "Signing you in… | Click",
};

const KNOWN_PORTAL_ROOTS = ["/dashboard", "/admin", "/merchant", "/onboarding"];

function safeNext(value: string | undefined | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (KNOWN_PORTAL_ROOTS.some((root) => value === root)) return null;
  return value;
}

type PostLoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function PostLoginPage({ searchParams }: PostLoginPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/post-login");
  }

  // Admins always go to /admin, even if a deep-link callback (?next=…) tried
  // to send them somewhere else. This runs before the explicit-next branch so
  // an admin who clicked a "Log in" link off, say, /events/foo still lands on
  // the admin console.
  if (isAdminEmail(session.user.email)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const explicitNext = safeNext(params?.next);
  if (explicitNext) {
    redirect(explicitNext);
  }

  const status = await getProfileStatus(session);

  if (status.merchantProfile) {
    redirect("/merchant");
  }

  if (!status.onboardingComplete) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
