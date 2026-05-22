import { NextResponse } from "next/server";
import { createBscUploadToken } from "@/lib/bible-study";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    objectKey?: string;
    acl?: string;
    maxBytes?: number;
  };
  try {
    const token = await createBscUploadToken({
      objectKey: body.objectKey ?? "",
      acl: body.acl === "private" ? "private" : "public",
      maxBytes: body.maxBytes,
    });
    return NextResponse.json({ ok: true, token });
  } catch (error) {
    if (!(error instanceof Error)) return NextResponse.json({ error: "Unknown error." }, { status: 500 });
    if (error.name === "AuthRequiredError") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.name === "DatabaseUnavailableError") return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
