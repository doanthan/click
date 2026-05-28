import { NextResponse } from "next/server";
import { getTableRows } from "@/lib/table-data";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ table: string }>;
};

function errorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return NextResponse.json({ error: "Unable to read table." }, { status: 500 });
  }
  if (error.name === "NotFoundError") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.name === "DatabaseUnavailableError") {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { error: error.message || "Unable to read table." },
    { status: 500 },
  );
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request, context: RouteContext) {
  const { table } = await context.params;
  const { searchParams } = new URL(request.url);

  try {
    const result = await getTableRows(table, {
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), 25),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
