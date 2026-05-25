import { MetricCard, SectionIntro } from "@/components/click-ui";
import { getDatabaseTables } from "@/lib/database-tables";

export const metadata = {
  title: "Database tables | Click",
  description: "Every table in the Click Postgres schema, with columns, types, and live row counts.",
};

// Schema + row counts are read live from Postgres, so never statically cache.
export const dynamic = "force-dynamic";

function formatCount(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-AU").format(value);
}

export default async function TablesPage() {
  const { source, tables } = await getDatabaseTables();
  const isLive = source === "database";
  const totalColumns = tables.reduce((sum, table) => sum + table.columns.length, 0);
  const totalRows = tables.reduce(
    (sum, table) => sum + (table.rowCount ?? 0),
    0,
  );

  return (
    <main className="paper-noise min-h-screen overflow-hidden text-[color:var(--ink)]">
      <section className="relative overflow-hidden bg-[color:var(--champagne)] px-4 pb-12 pt-16 sm:px-6 lg:pt-20">
        <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
        <div className="relative z-10 mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            {isLive ? "Live schema" : "Schema reference"}
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-light leading-[0.94] tracking-tight sm:text-7xl">
            The <span className="italic"><span className="peach-highlight">tables</span></span>{" "}
            behind Click.
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-7 text-[color:var(--mauve)] sm:text-lg">
            {isLive
              ? "Every base table in the Click Postgres schema, introspected live with its columns, types, primary keys, and current row counts."
              : "Every base table in the Click Postgres schema. Connect a database (set DATABASE_URL) to see live columns, types, and row counts."}
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Tables" value={String(tables.length)} tone="rose" />
            <MetricCard label="Columns" value={String(totalColumns)} tone="peach" />
            <MetricCard
              label="Rows"
              value={isLive ? formatCount(totalRows) : "—"}
              tone="ink"
            />
          </div>
        </div>
      </section>

      <section className="border-t-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow={`${tables.length} tables`}
            title="The full schema."
            body="Defined across the migrations in database/. Click-managed events, RSVPs, payments, anonymous Clicks, messaging, and admin tooling all live here."
          />

          {!isLive ? (
            <p className="mt-8 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)] p-4 text-sm font-bold text-[color:var(--surface-deep)] hard-shadow-sm">
              Showing the static table list — no database is connected. Set{" "}
              <code className="font-mono">DATABASE_URL</code> to introspect live
              columns, types, and row counts.
            </p>
          ) : null}

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {tables.map((table) => (
              <article
                key={table.name}
                className="flex flex-col rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-mono text-lg font-bold tracking-tight text-[color:var(--ink)] break-words">
                      {table.name}
                    </h3>
                    {table.description ? (
                      <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                        {table.description}
                      </p>
                    ) : null}
                  </div>
                  {isLive ? (
                    <span className="shrink-0 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)]">
                      {formatCount(table.rowCount)} rows
                    </span>
                  ) : null}
                </div>

                {isLive ? (
                  <ul className="mt-5 divide-y divide-[color:var(--line)]/40 border-t-2 border-[color:var(--line)]/40">
                    {table.columns.map((column) => (
                      <li
                        key={column.name}
                        className="flex items-baseline justify-between gap-3 py-2"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="truncate font-mono text-sm font-bold text-[color:var(--ink)]">
                            {column.name}
                          </span>
                          {column.isPrimaryKey ? (
                            <span className="shrink-0 rounded border border-[color:var(--line)] bg-[color:var(--rose)] px-1.5 text-[0.6rem] font-bold uppercase tracking-wider text-[color:var(--surface-deep)]">
                              PK
                            </span>
                          ) : null}
                          {!column.nullable && !column.isPrimaryKey ? (
                            <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                              not null
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-xs font-semibold text-[color:var(--mauve)]">
                          {column.dataType}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 border-t-2 border-[color:var(--line)]/40 pt-4 font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                    {table.columns.length} columns
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
