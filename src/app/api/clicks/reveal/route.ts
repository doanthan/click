import { auth } from "@/auth";
import { getUnseenMutualReveal } from "@/lib/event-repository";

// The one-time mutual reveal for MutualRevealHost, which asks here on every
// client-side navigation and straight after any click send. A separate read on
// purpose: §6.1 keeps the send's own reply identical whether or not it formed a
// mutual, so the reveal can only ever come from here, after that send committed.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { reveal: null },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return Response.json(
    { reveal: await getUnseenMutualReveal(session) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
