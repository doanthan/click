// Dev-only "fake send" — renders an email scenario through the same builder
// the /email preview page uses and inserts the resulting HTML into the
// `email_events` table so it shows up in the Supabase writes drawer.
//
// No SMTP, no Resend, no network. Body shape:
//   { scenario: "<id from src/lib/email-templates/index.ts>", to?: "x@y.z" }
// `to` defaults to the scenario's bundled fixture address — handy from the
// /email page where the recipient is just whatever the persona is.

import { NextResponse } from "next/server";

import { getPostgresPool } from "@/lib/postgres";
import { findScenario, scenarios } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_MODE !== "DEVELOPMENT") {
    return NextResponse.json(
      { ok: false, error: "Fake email sending is only enabled in DEVELOPMENT mode." },
      { status: 403 },
    );
  }

  const pool = getPostgresPool();
  if (!pool) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not set." },
      { status: 503 },
    );
  }

  let body: { scenario?: string; to?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // empty body is fine — we'll fall back to defaults
  }

  // We deliberately don't trust an arbitrary `template` value; the caller
  // picks a known scenario by id. Unknown ids resolve to the first scenario
  // (mirroring `/email`'s "search-param healing" behaviour).
  const scenario = findScenario(body.scenario);
  if (!scenario) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown scenario "${body.scenario}". Available: ${scenarios.map((s) => s.id).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const toEmail = (body.to ?? scenario.to).trim();

  let built;
  try {
    built = scenario.build();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to build "${scenario.id}": ${error instanceof Error ? error.message : "unknown"}`,
      },
      { status: 500 },
    );
  }

  try {
    const result = await pool.query<{ id: string; created_at: string }>(
      `
        insert into email_events (template, to_email, subject, html, vars)
        values ($1, $2, $3, $4, $5::jsonb)
        returning id::text as id, created_at
      `,
      [
        scenario.id,
        toEmail,
        built.subject,
        built.html,
        // We don't pass the raw fixture here because it's typed object trees
        // (Date, nested records) the column would have to re-serialise. The
        // scenario id + label is enough breadcrumb to recreate it.
        JSON.stringify({ scenario: scenario.id, label: scenario.label }),
      ],
    );

    return NextResponse.json({
      ok: true,
      id: result.rows[0]?.id ?? null,
      createdAt: result.rows[0]?.created_at ?? null,
      scenario: scenario.id,
      subject: built.subject,
      to: toEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Insert failed.",
      },
      { status: 500 },
    );
  }
}
