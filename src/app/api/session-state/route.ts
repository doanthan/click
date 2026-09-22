import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  // This is a read, so it must not refresh a potentially stale session cookie.
  return Response.json(
    { version: session?.sessionVersion ?? session?.user?.email ?? "anon" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
