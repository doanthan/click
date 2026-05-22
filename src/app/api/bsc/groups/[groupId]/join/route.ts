import { NextResponse } from "next/server";
import { requestJoinBscGroup } from "@/lib/bible-study";

type RouteContext = { params: Promise<{ groupId: string }> };

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
  if (error.name === "ProfileIncompleteError" || error.name === "AgeVerificationError") return NextResponse.json({ error: error.message }, { status: 428 });
  if (error.name === "InviteCodeRequiredError") return NextResponse.json({ error: error.message }, { status: 403 });
  if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { inviteCode?: string };
  try {
    const result = await requestJoinBscGroup(groupId, body.inviteCode);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
