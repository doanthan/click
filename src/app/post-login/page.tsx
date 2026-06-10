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
  // The marketing home page is never a meaningful post-login destination —
  // logging in from "/" should hand off to the role dispatch below (dashboard /
  // merchant / admin) rather than bouncing the user straight back to home.
  if (value === "/") return null;
  if (KNOWN_PORTAL_ROOTS.some((root) => value === root)) return null;
  return value;
}

type PostLoginPageProps = {
  searchParams?: Promise<{ next?: string; portal?: string }>;
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

  // Logins that started on the merchant surface (/merchant/login passes
  // ?portal=merchant) land on the host portal — /merchant itself gates
  // pending/non-merchants onto the right holding page. Main-surface logins
  // always land on the ATTENDEE side, even for users who also hold a merchant
  // profile: routing every merchant-capable account to /merchant surprised
  // dual-role users who logged in from the customer page expecting their
  // attendee dashboard (they can still switch portals from the header menu).
  if (params?.portal === "merchant") {
    redirect("/merchant");
  }

  const status = await getProfileStatus(session);

  if (!status.onboardingComplete) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
