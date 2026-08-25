import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateMerchantEventDetails } from "@/lib/event-repository";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

function responseForError(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unknown error updating event." }, { status: 500 });
  }
  const code = (error as { code?: string }).code;
  if (error.name === "AggregateError" || code === "ECONNREFUSED") {
    return NextResponse.json(
      { error: "Postgres is unavailable. Start the database before editing." },
      { status: 503 },
    );
  }
  if (error.name === "AuthRequiredError") {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error.name === "ForbiddenError") {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "ValidationError") {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json({ error: error.message || "Failed to update event." }, { status: 500 });
}

export async function PUT(request: Request, context: RouteContext) {
  const { eventId } = await context.params;
  const session = await auth();

  try {
    const body = (await request.json().catch(() => null)) as {
      title?: unknown;
      description?: unknown;
      relationshipGoal?: unknown;
      tagSlugs?: unknown;
      address?: unknown;
      images?: unknown;
      category?: unknown;
      startsAt?: unknown;
      durationMinutes?: unknown;
      capacity?: unknown;
      priceCents?: unknown;
    } | null;

    const title = typeof body?.title === "string" ? body.title : "";
    const description = typeof body?.description === "string" ? body.description : "";
    const relationshipGoal =
      typeof body?.relationshipGoal === "string" ? body.relationshipGoal : undefined;
    const tagSlugs = Array.isArray(body?.tagSlugs)
      ? body!.tagSlugs.filter((s): s is string => typeof s === "string")
      : [];
    const address = typeof body?.address === "string" ? body.address : undefined;
    const images = Array.isArray(body?.images)
      ? body!.images.filter((u): u is string => typeof u === "string")
      : undefined;

    // The terms fields. Passed through as-is; updateMerchantEventDetails is the
    // gate that decides whether they apply (only while the event is neither
    // published nor holding a seat), so a hand-rolled request cannot reprice or
    // move an event somebody has booked.
    const category = typeof body?.category === "string" ? body.category : undefined;
    const startsAt = typeof body?.startsAt === "string" ? body.startsAt : undefined;
    const numberOrUndefined = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : undefined;
    const durationMinutes = numberOrUndefined(body?.durationMinutes);
    const capacity = numberOrUndefined(body?.capacity);
    const priceCents = numberOrUndefined(body?.priceCents);

    const event = await updateMerchantEventDetails(
      eventId,
      {
        title,
        description,
        relationshipGoal,
        tagSlugs,
        address,
        images,
        category,
        startsAt,
        durationMinutes,
        capacity,
        priceCents,
      },
      session,
    );
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return responseForError(error);
  }
}
