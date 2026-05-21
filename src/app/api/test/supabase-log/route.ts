import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

type LogEntry = {
  id: string;
  table: string;
  createdAt: string;
  label: string;
  detail: string;
  entityId: string | null;
};

const PER_TABLE_LIMIT = 25;

type QuerySpec = {
  table: string;
  sql: string;
  toEntry: (row: Record<string, unknown>) => LogEntry;
};

const queries: QuerySpec[] = [
  {
    table: "profiles",
    sql: `
      select id::text as id, email::text as email, display_name, role::text as role, suburb,
             created_at
      from profiles
      order by created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `profiles:${row.id}`,
      table: "profiles",
      createdAt: String(row.created_at),
      label: String(row.display_name ?? row.email ?? "profile"),
      detail: `${row.email} · ${row.role}${row.suburb ? ` · ${row.suburb}` : ""}`,
      entityId: row.id ? String(row.id) : null,
    }),
  },
  {
    table: "merchant_profiles",
    sql: `
      select mp.id::text as id, mp.business_name, mp.contact_email::text as contact_email,
             mp.verification_status, mp.created_at, p.email::text as owner_email
      from merchant_profiles mp
      left join profiles p on p.id = mp.profile_id
      order by mp.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `merchant_profiles:${row.id}`,
      table: "merchant_profiles",
      createdAt: String(row.created_at),
      label: String(row.business_name ?? "merchant"),
      detail: `${row.contact_email} · ${row.verification_status}${row.owner_email ? ` · owner ${row.owner_email}` : ""}`,
      entityId: row.id ? String(row.id) : null,
    }),
  },
  {
    table: "events",
    sql: `
      select id::text as id, slug, title, status::text as status, suburb,
             price_cents, capacity, created_at
      from events
      order by created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => {
      const price = Number(row.price_cents ?? 0);
      const priceLabel = price > 0 ? `A$${(price / 100).toFixed(2)}` : "Free";
      return {
        id: `events:${row.id}`,
        table: "events",
        createdAt: String(row.created_at),
        label: String(row.title ?? row.slug ?? "event"),
        detail: `${row.status} · ${priceLabel} · cap ${row.capacity}${row.suburb ? ` · ${row.suburb}` : ""}`,
        entityId: row.id ? String(row.id) : null,
      };
    },
  },
  {
    table: "event_attendees",
    sql: `
      select ea.id::text as id, ea.status::text as status, ea.created_at,
             e.title as event_title, p.email::text as attendee_email
      from event_attendees ea
      left join events e on e.id = ea.event_id
      left join profiles p on p.id = ea.profile_id
      order by ea.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `event_attendees:${row.id}`,
      table: "event_attendees",
      createdAt: String(row.created_at),
      label: `RSVP · ${row.event_title ?? "event"}`,
      detail: `${row.attendee_email ?? "user"} · ${row.status}`,
      entityId: row.id ? String(row.id) : null,
    }),
  },
  {
    table: "event_waitlists",
    sql: `
      select ew.id::text as id, ew.created_at,
             e.title as event_title, p.email::text as attendee_email
      from event_waitlists ew
      left join events e on e.id = ew.event_id
      left join profiles p on p.id = ew.profile_id
      order by ew.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `event_waitlists:${row.id}`,
      table: "event_waitlists",
      createdAt: String(row.created_at),
      label: `Waitlist · ${row.event_title ?? "event"}`,
      detail: String(row.attendee_email ?? "user"),
      entityId: row.id ? String(row.id) : null,
    }),
  },
  {
    table: "bookmarks",
    sql: `
      select (b.event_id::text || ':' || b.profile_id::text) as id, b.created_at,
             e.title as event_title, p.email::text as attendee_email
      from bookmarks b
      left join events e on e.id = b.event_id
      left join profiles p on p.id = b.profile_id
      order by b.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `bookmarks:${row.id}`,
      table: "bookmarks",
      createdAt: String(row.created_at),
      label: `Bookmark · ${row.event_title ?? "event"}`,
      detail: String(row.attendee_email ?? "user"),
      entityId: row.id ? String(row.id) : null,
    }),
  },
  {
    table: "payment_transactions",
    sql: `
      select pt.id::text as id, pt.amount_cents, pt.currency, pt.status::text as status,
             pt.stripe_payment_intent_id, pt.created_at,
             e.title as event_title, p.email::text as buyer_email
      from payment_transactions pt
      left join events e on e.id = pt.event_id
      left join profiles p on p.id = pt.profile_id
      order by pt.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => {
      const amount = Number(row.amount_cents ?? 0);
      const amountLabel = `${row.currency ?? "AUD"} ${(amount / 100).toFixed(2)}`;
      return {
        id: `payment_transactions:${row.id}`,
        table: "payment_transactions",
        createdAt: String(row.created_at),
        label: `Payment · ${row.event_title ?? "event"}`,
        detail: `${amountLabel} · ${row.status} · ${row.buyer_email ?? "buyer"}`,
        entityId: row.id ? String(row.id) : null,
      };
    },
  },
  {
    table: "user_clicks",
    sql: `
      select uc.id::text as id, uc.status::text as status, uc.created_at,
             clicker.email::text as clicker_email, clicked.email::text as clicked_email
      from user_clicks uc
      left join profiles clicker on clicker.id = uc.clicker_profile_id
      left join profiles clicked on clicked.id = uc.clicked_profile_id
      order by uc.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `user_clicks:${row.id}`,
      table: "user_clicks",
      createdAt: String(row.created_at),
      label: "Click",
      detail: `${row.clicker_email ?? "?"} → ${row.clicked_email ?? "?"} · ${row.status}`,
      entityId: row.id ? String(row.id) : null,
    }),
  },
  {
    table: "audit_logs",
    sql: `
      select al.id::text as id, al.action, al.entity_table, al.entity_id::text as entity_id,
             al.created_at, p.email::text as actor_email
      from audit_logs al
      left join profiles p on p.id = al.actor_profile_id
      order by al.created_at desc
      limit ${PER_TABLE_LIMIT}
    `,
    toEntry: (row) => ({
      id: `audit_logs:${row.id}`,
      table: "audit_logs",
      createdAt: String(row.created_at),
      label: `Audit · ${row.action}`,
      detail: `${row.entity_table}${row.entity_id ? `#${String(row.entity_id).slice(0, 8)}` : ""}${row.actor_email ? ` · by ${row.actor_email}` : ""}`,
      entityId: row.id ? String(row.id) : null,
    }),
  },
];

export async function GET() {
  const pool = getPostgresPool();
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_URL is not set. Connect Postgres to see the log.",
        entries: [],
        tables: [],
      },
      { status: 503 },
    );
  }

  const entries: LogEntry[] = [];
  const tableErrors: { table: string; error: string }[] = [];

  await Promise.all(
    queries.map(async (spec) => {
      try {
        const result = await pool.query(spec.sql);
        for (const row of result.rows) {
          entries.push(spec.toEntry(row));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        tableErrors.push({ table: spec.table, error: message });
      }
    }),
  );

  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const tables = Array.from(new Set(entries.map((entry) => entry.table))).sort();

  return NextResponse.json({
    ok: tableErrors.length === 0,
    entries,
    tables,
    tableErrors,
    fetchedAt: new Date().toISOString(),
  });
}
