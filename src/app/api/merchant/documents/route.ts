import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteMerchantDocument,
  ensureProfileForSession,
  recordMerchantDocument,
  type MerchantDocumentType,
} from "@/lib/event-repository";
import {
  StorageNotConfiguredError,
  getSupabaseAdmin,
} from "@/utils/supabase/admin";

// Multipart endpoint used by the merchant signup wizard Step 3.
//
// Expected form fields:
//   document_type - one of: abn_certificate | public_liability_insurance | liquor_licence
//   file - the file blob (PDF/JPG/PNG, max 5MB)
//
// Flow:
//   1. Validate session + file constraints.
//   2. Upload to private Supabase Storage bucket "merchant-documents" via
//      the service-role admin client.
//   3. Record metadata in merchant_documents (keyed off profile_id - the
//      merchant_profiles row may not exist yet because Step 4 hasn't run).
//
// DELETE ?document_type=… takes one back off the pile: same two calls the
// replace path makes (drop the row, drop the object), because a host who picked
// the wrong file could previously only paper over it with another one.
//
// If SUPABASE_SERVICE_ROLE_KEY is unset, returns a 503 with a clear message
// rather than a stack trace.

const BUCKET = "merchant-documents";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const ALLOWED_TYPES: ReadonlyArray<MerchantDocumentType> = [
  "abn_certificate",
  "public_liability_insurance",
  "liquor_licence",
];

function extensionFor(mimeType: string, fallback: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  // Fall back to whatever extension the file name had.
  return fallback || "bin";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const documentType = String(form.get("document_type") ?? "") as MerchantDocumentType;
  if (!ALLOWED_TYPES.includes(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "File must be PDF, JPG, or PNG." },
      { status: 400 },
    );
  }

  // Scope the object path by profile UUID. This used to read
  // `session.user.id ?? `auth:${session.user.email}`` - but src/auth.ts sets no
  // session callback, so session.user.id is ALWAYS undefined and the fallback
  // was the only branch that ever ran. Every KYC document therefore landed at
  // `auth%3Asomeone%40example.com/...`, i.e. the applicant's email address
  // written into the storage key, signed URLs and every bucket listing - the
  // opposite of what the comment here used to claim. ensureProfileForSession is
  // request-cached and recordMerchantDocument below calls it anyway, so
  // resolving the real id costs nothing.
  const profile = await ensureProfileForSession(session);
  const profileId = profile.id;
  const dotIdx = file.name.lastIndexOf(".");
  const fallbackExt = dotIdx >= 0 ? file.name.slice(dotIdx + 1).toLowerCase() : "";
  const ext = extensionFor(file.type, fallbackExt);
  const objectKey = `${encodeURIComponent(profileId)}/${documentType}/${randomUUID()}.${ext}`;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  // Uint8Array, not a Node Buffer: storage-js on Node 18+/24 hands a Buffer
  // body straight to undici's fetch, which fails with an opaque "fetch failed".
  // A Uint8Array view of the same bytes uploads correctly.
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectKey, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    // Most common case: bucket doesn't exist yet. Surface a useful message.
    const msg = uploadError.message ?? "Storage upload failed.";
    const status = /bucket/i.test(msg) ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  try {
    const row = await recordMerchantDocument(
      {
        documentType,
        filePath: objectKey,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
      session,
    );
    // The metadata row is replaced on re-upload, so the object it used to point
    // at is now unreachable. Drop it, or every re-pick leaves a 5 MB orphan in
    // the private bucket. Best-effort: a failed cleanup must not fail the
    // upload the user just completed.
    if (row.previousFilePath && row.previousFilePath !== objectKey) {
      await supabase.storage
        .from(BUCKET)
        .remove([row.previousFilePath])
        .catch(() => undefined);
    }
    return NextResponse.json({ ok: true, document: row });
  } catch (error) {
    // Best-effort: try to remove the orphan object so the bucket doesn't
    // collect failed uploads. Swallow errors - the metadata error is what
    // matters for the user.
    await supabase.storage.from(BUCKET).remove([objectKey]).catch(() => undefined);
    if (error instanceof Error) {
      const status = error.name === "ValidationError" ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Document record failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "You need to log in first." }, { status: 401 });
  }

  const documentType = String(
    new URL(request.url).searchParams.get("document_type") ?? "",
  ) as MerchantDocumentType;
  if (!ALLOWED_TYPES.includes(documentType)) {
    return NextResponse.json(
      { error: `document_type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  let removed: { filePath: string } | null;
  try {
    removed = await deleteMerchantDocument(documentType, session);
  } catch (error) {
    if (error instanceof Error) {
      const status =
        error.name === "ValidationError"
          ? 400
          : error.name === "AuthRequiredError"
            ? 401
            : error.name === "DatabaseUnavailableError"
              ? 503
              : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Removing that document failed." }, { status: 500 });
  }

  // Nothing on file is the state the caller asked for, so it is a success - the
  // row is gone either way and the wizard's row should end up empty.
  if (!removed) return NextResponse.json({ ok: true });

  // Best-effort, exactly like the replace path: the metadata row is already
  // gone, so a storage hiccup leaves an orphan object rather than a document the
  // host thinks they removed and hasn't.
  try {
    await getSupabaseAdmin()
      .storage.from(BUCKET)
      .remove([removed.filePath])
      .catch(() => undefined);
  } catch (error) {
    if (!(error instanceof StorageNotConfiguredError)) throw error;
  }

  return NextResponse.json({ ok: true });
}
