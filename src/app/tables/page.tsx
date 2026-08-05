import { MetricCard, SectionIntro } from "@/components/click-ui";
import { notFound } from "next/navigation";
import { TablesExplorer } from "@/components/tables-explorer";
import { getDatabaseTables } from "@/lib/database-tables";
import { isProductionDeployment } from "@/lib/runtime-mode";

export const metadata = {
  title: "Database tables",
  description: "Every table in the Click Postgres schema, with columns, types, and live row counts.",
};

// Schema + row counts are read live from Postgres, so never statically cache.
export const dynamic = "force-dynamic";

function formatCount(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-AU").format(value);
}

export default async function TablesPage() {
  if (isProductionDeployment()) notFound();
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
        <div className="relative z-10 mx-auto max-w-6xl">
          <span className="sticker sticker--peach tilt-l-2 inline-flex">
            <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
            {isLive ? "Live schema" : "Schema reference"}
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-bold leading-[0.94] tracking-[-0.025em] sm:text-7xl">
            The <span className="text-[color:var(--coral)]">tables</span>{" "}
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

          <TablesExplorer tables={tables} isLive={isLive} />
        </div>
      </section>
    </main>
  );
}
