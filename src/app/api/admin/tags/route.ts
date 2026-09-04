import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createTagForAdmin,
  deleteTagForAdmin,
  updateTagForAdmin,
} from "@/lib/event-repository";

// Surfaces that render the tag taxonomy. /profile/edit + /onboarding are
// dynamic (cookie-gated) so they refresh on their own, but the public browse
// pages can be cached - revalidate them all so an admin-added tag shows up
// everywhere immediately instead of only after the next deploy.
function revalidateTagSurfaces() {
  for (const path of ["/admin/tags", "/profile/edit", "/onboarding", "/categories", "/discover"]) {
    revalidatePath(path);
  }
}

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
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
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

    revalidateTagSurfaces();
    return NextResponse.json({ ok: true, tag });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    categoryName?: string;
    tagType?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "Tag id is required." }, { status: 400 });
  }
  if (!body.tagType || !allowedTagTypes.has(body.tagType)) {
    return NextResponse.json({ error: "Valid tag type is required." }, { status: 400 });
  }

  try {
    const tag = await updateTagForAdmin(
      {
        id: body.id,
        label: body.label ?? "",
        categoryName: body.categoryName ?? "",
        tagType: body.tagType as "interest" | "music" | "vibe",
      },
      session,
    );

    revalidateTagSurfaces();
    return NextResponse.json({ ok: true, tag });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  const id = new URL(request.url).searchParams.get("id") ?? "";

  if (!id) {
    return NextResponse.json({ error: "Tag id is required." }, { status: 400 });
  }

  try {
    const result = await deleteTagForAdmin(id, session);
    revalidateTagSurfaces();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
