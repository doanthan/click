import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { BugStatus } from "@/lib/support-repository";
import { editTicket, markTicketFixed, reopenTicketForRefix } from "@/lib/support-repository";

const BUG_STATUSES: BugStatus[] = ["open", "ai_fixed", "fixed", "not_issue"];

export const runtime = "nodejs";

// PATCH /api/support/ticket/<ticketRef>
//   { status: "fixed" }              → tick a bug off the per-page checklist:
//                                       flips it fixed + recolours the Sheet green.
//   { status: "open", note: "..." }  → "Not fixed": clears ai_fixed, appends the
//                                       tester's note, recolours the Sheet red so
//                                       the AI fixer picks it up again.
//   { status: "edit", message, expected?, bugStatus? } → edit the bug's
//                                       description in place; bugStatus optionally
//                                       moves it to open|ai_fixed|fixed|not_issue.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketRef: string }> },
) {
  // Pre-launch: signed-out testers can tick a bug off / send it back too.
  const session = await auth();
  const { ticketRef } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    note?: string;
    message?: string;
    expected?: string;
    bugStatus?: string;
  };

  try {
    if (body.status === "fixed") {
      const changed = await markTicketFixed(ticketRef, session);
      return NextResponse.json({ success: true, changed });
    }

    if (body.status === "edit") {
      const message = (body.message ?? "").trim();
      if (!message) {
        return NextResponse.json(
          { error: "Describe what's wrong." },
          { status: 400 },
        );
      }
      const bugStatus = BUG_STATUSES.includes(body.bugStatus as BugStatus)
        ? (body.bugStatus as BugStatus)
        : undefined;
      const changed = await editTicket(
        ticketRef,
        { message, expected: body.expected ?? null, status: bugStatus },
        session,
      );
      return NextResponse.json({ success: true, changed });
    }

    if (body.status === "open") {
      const note = (body.note ?? "").trim();
      if (!note) {
        return NextResponse.json(
          { error: "Add a note describing what's still wrong." },
          { status: 400 },
        );
      }
      const changed = await reopenTicketForRefix(ticketRef, note, session);
      return NextResponse.json({ success: true, changed });
    }

    return NextResponse.json(
      { error: "Only { status: 'fixed' }, { status: 'open', note } or { status: 'edit', message } is supported." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[support] ticket update failed:", error);
    return NextResponse.json({ error: "Couldn't update the bug." }, { status: 500 });
  }
}
