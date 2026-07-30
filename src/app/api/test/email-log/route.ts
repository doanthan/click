// Sibling of /api/test/supabase-log, but for the rendered-email log. The dev
// drawer polls this on a 5s interval to surface fake sends. Returning the
// full `html` blob isn't cheap, but the table is capped at ~25 rows here and
// it lets the drawer render an inline iframe without a second roundtrip.

import { NextResponse } from "next/server";

import { getPostgresPool } from "@/lib/postgres";
import { internalApiNotFound } from "@/lib/runtime-mode";

export const dynamic = "force-dynamic";

type EmailLogEntry = {
  id: string;
  template: string;
  toEmail: string;
  toProfileId: string | null;
  subject: string;
  html: string;
  vars: Record<string, unknown>;
  createdAt: string;
};

const ROW_LIMIT = 25;

export async function GET() {
  const blocked = internalApiNotFound();
  if (blocked) return blocked;
  const pool = getPostgresPool();
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL is not set. Connect Postgres to see the log.",
        entries: [],
      },
      { status: 503 },
    );
  }

  try {
    const result = await pool.query<{
      id: string;
      template: string;
      to_email: string;
      to_profile_id: string | null;
      subject: string;
      html: string;
      vars: Record<string, unknown> | null;
      created_at: string;
    }>(
      `
        select id::text as id, template, to_email::text as to_email,
               to_profile_id::text as to_profile_id, subject, html, vars,
               created_at
        from email_events
        order by created_at desc
        limit $1
      `,
      [ROW_LIMIT],
    );

    const entries: EmailLogEntry[] = result.rows.map((row) => ({
      id: row.id,
      template: row.template,
      toEmail: row.to_email,
      toProfileId: row.to_profile_id,
      subject: row.subject,
      html: row.html,
      vars: row.vars ?? {},
      // pg gives us a Date at runtime; emit ISO so the client's lexical/Date
      // conversions are unambiguous (matches the sibling supabase-log endpoint).
      // `new Date()` accepts both Date and the formatted string variant.
      createdAt: new Date(row.created_at as unknown as string | Date).toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      entries,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Most likely cause: migration `012_email_events.sql` hasn't been run on
    // this database yet. Surfacing the message verbatim lands the fix where
    // the dev is already looking.
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Query failed.",
        entries: [],
      },
      { status: 500 },
    );
  }
}
