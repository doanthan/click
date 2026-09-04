import { getPostgresPool } from "./postgres";

export const TEST_CASE_STATUSES = [
  "todo",
  "passing",
  "failing",
  "blocked",
] as const;

export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];

export function isTestCaseStatus(value: unknown): value is TestCaseStatus {
  return (
    typeof value === "string" &&
    (TEST_CASE_STATUSES as readonly string[]).includes(value)
  );
}

export type TestComment = {
  id: string;
  author: string | null;
  body: string;
  createdAt: string;
};

export type TestCase = {
  id: string;
  title: string;
  description: string;
  status: TestCaseStatus;
  author: string | null;
  createdAt: string;
  updatedAt: string;
  comments: TestComment[];
};

// Thrown when DATABASE_URL is unset so callers can return a 503 instead of a
// generic 500 - mirrors how the rest of the app treats a missing database.
export class DatabaseUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Connect Postgres to manage test cases.");
    this.name = "DatabaseUnavailableError";
  }
}

function requirePool() {
  const pool = getPostgresPool();
  if (!pool) throw new DatabaseUnavailableError();
  return pool;
}

type CaseRow = {
  id: string;
  title: string;
  description: string;
  status: TestCaseStatus;
  author: string | null;
  created_at: string;
  updated_at: string;
};

type CommentRow = {
  id: string;
  test_case_id: string;
  author: string | null;
  body: string;
  created_at: string;
};

function toComment(row: CommentRow): TestComment {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    createdAt: String(row.created_at),
  };
}

/** All test cases (newest first) with their comment threads (oldest first). */
export async function listTestCases(): Promise<TestCase[]> {
  const pool = requirePool();

  const [casesResult, commentsResult] = await Promise.all([
    pool.query<CaseRow>(`
      select id::text, title, description, status, author, created_at, updated_at
      from test_cases
      order by created_at desc
    `),
    pool.query<CommentRow>(`
      select id::text, test_case_id::text, author, body, created_at
      from test_case_comments
      order by created_at asc
    `),
  ]);

  const commentsByCase = new Map<string, TestComment[]>();
  for (const row of commentsResult.rows) {
    const list = commentsByCase.get(row.test_case_id) ?? [];
    list.push(toComment(row));
    commentsByCase.set(row.test_case_id, list);
  }

  return casesResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    author: row.author,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    comments: commentsByCase.get(row.id) ?? [],
  }));
}

export async function createTestCase(input: {
  title: string;
  description?: string;
  status?: TestCaseStatus;
  author?: string | null;
}): Promise<TestCase> {
  const pool = requirePool();
  const status = isTestCaseStatus(input.status) ? input.status : "todo";

  const result = await pool.query<CaseRow>(
    `
      insert into test_cases (title, description, status, author)
      values ($1, $2, $3, $4)
      returning id::text, title, description, status, author, created_at, updated_at
    `,
    [
      input.title.trim(),
      (input.description ?? "").trim(),
      status,
      input.author?.trim() || null,
    ],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    author: row.author,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    comments: [],
  };
}

/** Update a case's editable fields. Returns null if the id doesn't exist. */
export async function updateTestCase(
  id: string,
  patch: { title?: string; description?: string; status?: TestCaseStatus },
): Promise<CaseRow | null> {
  const pool = requirePool();

  const result = await pool.query<CaseRow>(
    `
      update test_cases
      set title = coalesce($2, title),
          description = coalesce($3, description),
          status = coalesce($4, status),
          updated_at = now()
      where id = $1
      returning id::text, title, description, status, author, created_at, updated_at
    `,
    [
      id,
      patch.title?.trim() ?? null,
      patch.description?.trim() ?? null,
      isTestCaseStatus(patch.status) ? patch.status : null,
    ],
  );

  return result.rows[0] ?? null;
}

/** Returns true if a row was deleted. Comments cascade away. */
export async function deleteTestCase(id: string): Promise<boolean> {
  const pool = requirePool();
  const result = await pool.query(`delete from test_cases where id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function addComment(
  caseId: string,
  input: { body: string; author?: string | null },
): Promise<TestComment | null> {
  const pool = requirePool();

  const result = await pool.query<CommentRow>(
    `
      insert into test_case_comments (test_case_id, author, body)
      select $1, $2, $3
      where exists (select 1 from test_cases where id = $1)
      returning id::text, test_case_id::text, author, body, created_at
    `,
    [caseId, input.author?.trim() || null, input.body.trim()],
  );

  const row = result.rows[0];
  return row ? toComment(row) : null;
}

export async function deleteComment(id: string): Promise<boolean> {
  const pool = requirePool();
  const result = await pool.query(
    `delete from test_case_comments where id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
