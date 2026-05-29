import { getPostgresPool } from "./postgres";

// Mirrors the DatabaseUnavailableError name used elsewhere (test-cases.ts,
// event-repository) so API routes can map a missing DATABASE_URL to a 503.
export class DatabaseUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Connect Postgres to browse table data.");
    this.name = "DatabaseUnavailableError";
  }
}

// Thrown when a requested table isn't a known public base table. Routes map
// this to a 404 (the name is matched the same way as the merchant routes).
export class TableNotFoundError extends Error {
  constructor(name: string) {
    super(`Table "${name}" was not found in the public schema.`);
    this.name = "NotFoundError";
  }
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type TableRowsResult = {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

// Double-quote a Postgres identifier so it can be interpolated safely. The
// name is also whitelisted against information_schema before we get here, so
// this is belt-and-braces against SQL injection via the table parameter.
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function isPublicBaseTable(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  name: string,
): Promise<boolean> {
  const result = await pool.query(
    `select 1
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name = $1`,
    [name],
  );
  return (result.rowCount ?? 0) > 0;
}

async function primaryKeyColumns(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  name: string,
): Promise<string[]> {
  const result = await pool.query<{ column_name: string }>(
    `select kcu.column_name
       from information_schema.table_constraints tc
       join information_schema.key_column_usage kcu
         on kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
      where tc.constraint_type = 'PRIMARY KEY'
        and tc.table_schema = 'public'
        and tc.table_name = $1
      order by kcu.ordinal_position asc`,
    [name],
  );
  return result.rows.map((row) => row.column_name);
}

// Pick a "newest first" sort column. Most of our tables have created_at; a
// few use inserted_at / updated_at. We probe in that order and return the
// first match, so callers can sort by it descending.
async function newestSortColumn(
  pool: NonNullable<ReturnType<typeof getPostgresPool>>,
  name: string,
): Promise<string | null> {
  const candidates = ["created_at", "inserted_at", "updated_at"];
  const result = await pool.query<{ column_name: string }>(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name = any($2::text[])`,
    [name, candidates],
  );
  const found = new Set(result.rows.map((row) => row.column_name));
  return candidates.find((c) => found.has(c)) ?? null;
}

export async function getTableRows(
  tableName: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<TableRowsResult> {
  const pool = getPostgresPool();
  if (!pool) throw new DatabaseUnavailableError();

  if (!(await isPublicBaseTable(pool, tableName))) {
    throw new TableNotFoundError(tableName);
  }

  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  const offset = (page - 1) * pageSize;

  const ident = quoteIdent(tableName);
  // Show newest rows first. Prefer created_at / inserted_at / updated_at
  // (desc, nulls last), then break ties on the primary key (desc) for stable
  // pagination. If neither is available, fall back to ctid desc — always
  // present, cheap, and gives a "physically newest first" approximation.
  const [pkColumns, newestColumn] = await Promise.all([
    primaryKeyColumns(pool, tableName),
    newestSortColumn(pool, tableName),
  ]);
  const pkSort = pkColumns.map((c) => `${quoteIdent(c)} desc`).join(", ");
  let orderBy: string;
  if (newestColumn) {
    orderBy = `order by ${quoteIdent(newestColumn)} desc nulls last${
      pkSort ? `, ${pkSort}` : ""
    }`;
  } else if (pkSort) {
    orderBy = `order by ${pkSort}`;
  } else {
    orderBy = "order by ctid desc";
  }

  const [rowsResult, countResult] = await Promise.all([
    pool.query(
      `select * from ${ident} ${orderBy} limit $1 offset $2`,
      [pageSize, offset],
    ),
    pool.query<{ total: string }>(`select count(*)::bigint as total from ${ident}`),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);

  return {
    table: tableName,
    columns: rowsResult.fields.map((field) => field.name),
    rows: rowsResult.rows as Record<string, unknown>[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
