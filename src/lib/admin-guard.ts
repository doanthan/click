import { notFound } from "next/navigation";
import { auth, isAdminEmail } from "@/auth";

/**
 * The page-level admin boundary. Call it first in every
 * src/app/admin/**\/page.tsx.
 *
 * src/app/admin/layout.tsx checks too, but a layout is NOT a security boundary
 * in the App Router: it renders once per segment entry, not per navigation, and
 * an RSC request carrying a crafted Next-Router-State-Tree resumes rendering at
 * the first mismatched segment - so a nested admin page can execute without the
 * layout's check ever running. The header is shape-checked, not authenticated,
 * and anyone can mint a session through the open magic-link signup.
 *
 * The admin WRITE paths were already safe (they route through
 * requireAdminProfile). What this closes is read exposure: signed-URL access to
 * the private merchant-documents KYC bucket, every member's email address, and
 * the live payment ledger.
 *
 * notFound() rather than redirect(): an admin console should not confirm it
 * exists to someone who has no business there. Signed-in non-admins arriving
 * through a normal navigation still get the layout's friendlier "Access denied"
 * page, because the layout returns before it renders children.
 */
export async function requireAdminPage() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) notFound();
  return session;
}
