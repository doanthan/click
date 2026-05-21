import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTagForAdmin } from "@/lib/event-repository";

const allowedTagTypes = new Set(["interest", "music", "vibe"]);

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown tag error." }, { status: 500 });
  }

  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  return NextResponse.json({ error: error.message || "Tag update failed." }, { status: 500 });
}

export async function POST(request: Request) {
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    categoryName?: string;
    tagType?: string;
  };

  if (!body.tagType || !allowedTagTypes.has(body.tagType)) {
    return NextResponse.json({ error: "Valid tag type is required." }, { status: 400 });
  }

  try {
    const tag = await createTagForAdmin(
      {
        label: body.label ?? "",
        categoryName: body.categoryName ?? "",
        tagType: body.tagType as "interest" | "music" | "vibe",
      },
      session,
    );

    return NextResponse.json({ ok: true, tag });
  } catch (error) {
    return errorResponse(error);
  }
}
