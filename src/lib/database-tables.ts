import { getPostgresPool } from "./postgres";

export type TableColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
};

export type DatabaseTable = {
  name: string;
  description: string | null;
  rowCount: number | null;
  columns: TableColumn[];
};

export type TablesResult = {
  source: "database" | "fallback";
  tables: DatabaseTable[];
};

// One-line notes shown next to each table. Keyed by table name so they apply
// whether the schema is read live or served from the fallback below.
const TABLE_NOTES: Record<string, string> = {
  profiles: "Every account — attendees, merchants, and admins.",
  merchant_profiles: "Business details + ABN verification status for hosts.",
  tag_categories: "Groupings that organise the tag taxonomy.",
  tags: "Interest / life / music / vibe tags applied to people and events.",
  user_tags: "Join table linking profiles to their tags.",
  click_personas: "Generated personality profile from the Life Quiz.",
  events: "Public and merchant-created events powering Explore and RSVP.",
  event_tags: "Join table linking events to their tags.",
  event_attendees: "RSVPs and their status (confirmed, waitlisted, etc.).",
  event_waitlists: "Waitlist queue with spot-offer windows.",
  bookmarks: "Saved events per profile.",
  user_clicks: "Anonymous one-way Clicks between people.",
  mutual_clicks: "Reciprocated Clicks created by trigger; unlocks a suggestion.",
  payment_transactions: "Stripe payment records for paid events.",
  notifications: "In-app and email notifications per profile.",
  audit_logs: "Admin and system actions for moderation history.",
  conversations: "Pairwise 1-to-1 message threads.",
  messages: "Append-only messages inside a conversation.",
  system_settings: "Runtime KV flags admins can flip without a redeploy.",
  test_cases: "Editable QA test cases people add/remove on the /test page.",
  test_case_comments: "Comment threads attached to a test case.",
};

// Known column counts from database/*.sql, used so the fallback list still
// conveys table shape when there is no live database to introspect.
const FALLBACK_TABLES: { name: string; columnCount: number }[] = [
  { name: "profiles", columnCount: 22 },
  { name: "merchant_profiles", columnCount: 10 },
  { name: "tag_categories", columnCount: 5 },
  { name: "tags", columnCount: 7 },
  { name: "user_tags", columnCount: 4 },
  { name: "click_personas", columnCount: 9 },
  { name: "events", columnCount: 29 },
  { name: "event_tags", columnCount: 3 },
  { name: "event_attendees", columnCount: 8 },
  { name: "event_waitlists", columnCount: 6 },
  { name: "bookmarks", columnCount: 3 },
  { name: "user_clicks", columnCount: 7 },
  { name: "mutual_clicks", columnCount: 5 },
  { name: "payment_transactions", columnCount: 10 },
  { name: "notifications", columnCount: 8 },
  { name: "audit_logs", columnCount: 6 },
  { name: "conversations", columnCount: 6 },
  { name: "messages", columnCount: 6 },
  { name: "system_settings", columnCount: 4 },
  { name: "test_cases", columnCount: 7 },
  { name: "test_case_comments", columnCount: 5 },
];

function fallbackTables(): TablesResult {
  return {
    source: "fallback",
    tables: FALLBACK_TABLES.map((table) => ({
      name: table.name,
      description: TABLE_NOTES[table.name] ?? null,
      rowCount: null,
      // Placeholder column rows so the count reads correctly; live introspection
      // (DATABASE_URL set) fills in real names, types, and keys.
      columns: Array.from({ length: table.columnCount }, () => ({
        name: "",
        dataType: "",
        nullable: false,
        default: null,
        isPrimaryKey: false,
      })),
    })),
  };
}

// Turn information_schema's data_type/udt_name pair into a readable label:
// arrays become `enumname[]`, enums and other user-defined types use udt_name.
function friendlyType(dataType: string, udtName: string): string {
  if (dataType === "ARRAY") return `${udtName.replace(/^_/, "")}[]`;
  if (dataType === "USER-DEFINED") return udtName;
  return dataType;
}

export async function getDatabaseTables(): Promise<TablesResult> {
  const pool = getPostgresPool();
  if (!pool) return fallbackTables();

  try {
    const [columnsResult, pkResult, countsResult] = await Promise.all([
      pool.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
        column_default: string | null;
      }>(`
        select
          c.table_name,
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema
          and t.table_name = c.table_name
        where c.table_schema = 'public'
          and t.table_type = 'BASE TABLE'
        order by c.table_name asc, c.ordinal_position asc
      `),
      pool.query<{ table_name: string; column_name: string }>(`
        select tc.table_name, kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_name = tc.constraint_name
          and kcu.table_schema = tc.table_schema
        where tc.constraint_type = 'PRIMARY KEY'
          and tc.table_schema = 'public'
      `),
      pool.query<{ table_name: string; row_count: string }>(`
        select relname as table_name, n_live_tup as row_count
        from pg_stat_user_tables
        where schemaname = 'public'
      `),
    ]);

    if (columnsResult.rows.length === 0) return fallbackTables();

    const primaryKeys = new Set(
      pkResult.rows.map((row) => `${row.table_name}.${row.column_name}`),
    );
    const rowCounts = new Map(
      countsResult.rows.map((row) => [row.table_name, Number(row.row_count)]),
    );

    const tableMap = new Map<string, DatabaseTable>();
    for (const row of columnsResult.rows) {
      let table = tableMap.get(row.table_name);
      if (!table) {
        table = {
          name: row.table_name,
          description: TABLE_NOTES[row.table_name] ?? null,
          rowCount: rowCounts.has(row.table_name)
            ? rowCounts.get(row.table_name)!
            : null,
          columns: [],
        };
        tableMap.set(row.table_name, table);
      }
      table.columns.push({
        name: row.column_name,
        dataType: friendlyType(row.data_type, row.udt_name),
        nullable: row.is_nullable === "YES",
        default: row.column_default,
        isPrimaryKey: primaryKeys.has(`${row.table_name}.${row.column_name}`),
      });
    }

    return {
      source: "database",
      tables: Array.from(tableMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  } catch (error) {
    if (process.env.CLICK_DB_DEBUG === "true") {
      console.warn("Falling back to static table list; Postgres unavailable.", error);
    }
    return fallbackTables();
  }
}
