import { auth } from "@/auth";
import { getUnreadNotificationCount } from "@/lib/event-repository";

// The header bell's live count. The bell renders in the root layout, and a
// layout does not re-render on client-side navigation, so HeaderNotificationsBell
// asks here instead: on every navigation and whenever the tab comes back.
// A read, like api/session-state: never cached, never refreshes the session.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Sign in to see your notifications." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return Response.json(await getUnreadNotificationCount(session), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
