import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge, ckBtn } from "@/components/ds";
import { requireAdminPage } from "@/lib/admin-guard";
import { getLaunchWaitlistForAdmin, type LaunchWaitlistEntry } from "@/lib/launch-waitlist";

export const metadata = {
  title: "Launch Waitlist | Admin",
};

// Sydney, like every other date the admin console prints.
const sydneyDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

// The success screen promises it: three friends in = a spot in the first round.
const FIRST_ROUND_REFERRALS = 3;

const AREA_LABEL: Record<LaunchWaitlistEntry["area"], string> = {
  pilot: "Sydney",
  outside: "Elsewhere",
  unknown: "Unrecognised",
};

function AreaBadge({ area }: { area: LaunchWaitlistEntry["area"] }) {
  return <Badge tone={area === "pilot" ? "lavender" : "neutral"}>{AREA_LABEL[area]}</Badge>;
}

function Referrals({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold text-[color:var(--ink)] tabular-nums">{count}</span>
      {count >= FIRST_ROUND_REFERRALS ? <Badge tone="sage">First round</Badge> : null}
    </span>
  );
}

export default async function AdminLaunchWaitlistPage() {
  const session = await requireAdminPage();

  let entries: LaunchWaitlistEntry[] = [];
  let problem: string | null = null;
  try {
    entries = await getLaunchWaitlistForAdmin(session);
  } catch (error) {
    problem =
      (error as { code?: string } | null)?.code === "42P01"
        ? "This database has no launch_waitlist table yet - migration 072 hasn't been applied."
        : "Couldn't read the waitlist just now. Try again in a moment.";
  }

  const inSydney = entries.filter((e) => e.area === "pilot").length;
  const viaLink = entries.filter((e) => e.referredBy).length;

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Pre-launch"
        title="Launch Waitlist"
        description="Everyone who requested an invite at /waitlist, in invite order: most friends brought in first, then first come, first served. Three or more is a promised first-round spot."
        action={
          entries.length > 0 ? (
            <a href="/api/admin/launch-waitlist" download className={ckBtn("secondary", "sm")}>
              Download CSV
            </a>
          ) : null
        }
      />

      <section className="overflow-hidden rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
        {problem ? (
          <p role="alert" className="p-6 text-sm leading-6 text-[color:var(--danger)]">
            {problem}
          </p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm leading-6 text-[color:var(--slate)]">
            No invite requests yet. Share{" "}
            <Link href="/waitlist" className="font-semibold text-[color:var(--purple)] underline">
              /waitlist
            </Link>{" "}
            and they&apos;ll land here.
          </p>
        ) : (
          <>
            <p className="border-b border-[color:var(--line)] px-5 py-3.5 text-sm text-[color:var(--slate)]">
              <strong className="text-[color:var(--ink)] tabular-nums">{entries.length}</strong>{" "}
              request{entries.length === 1 ? "" : "s"} · {inSydney} in Sydney ·{" "}
              {entries.length - inSydney} elsewhere · {viaLink} on a friend&apos;s link
            </p>

            {/* Mobile (< md): stacked rows instead of a wide table. */}
            <ol className="divide-y divide-[color:var(--line)] md:hidden">
              {entries.map((e, i) => (
                <li key={e.id} className="space-y-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={`mailto:${e.email}`}
                      className="min-w-0 truncate font-semibold text-[color:var(--ink)] hover:text-[color:var(--purple)]"
                    >
                      <span className="mr-2 text-[color:var(--slate)] tabular-nums">{i + 1}.</span>
                      {e.email}
                    </a>
                    <AreaBadge area={e.area} />
                  </div>
                  <p className="text-sm text-[color:var(--ink)]">{e.place}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--slate)]">
                    <span>
                      Brought in <Referrals count={e.referrals} />
                    </span>
                    <span>{e.referredBy ? `Via ${e.referredBy}` : "Direct"}</span>
                    <span>{sydneyDate.format(new Date(e.createdAt))}</span>
                  </p>
                </li>
              ))}
            </ol>

            {/* Desktop (md+): the full table. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-[color:var(--line)]">
                  <tr className="text-xs font-semibold text-[color:var(--slate)]">
                    <th className="w-12 px-4 py-3">#</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Suburb or postcode</th>
                    <th className="px-4 py-3">Brought in</th>
                    <th className="px-4 py-3">Came via</th>
                    <th className="px-4 py-3">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {entries.map((e, i) => (
                    <tr key={e.id} className="align-middle">
                      <td className="px-4 py-3 text-[color:var(--slate)] tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${e.email}`}
                          className="font-semibold text-[color:var(--ink)] hover:text-[color:var(--purple)]"
                        >
                          {e.email}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5 text-[color:var(--ink)]">
                          {e.place}
                          <AreaBadge area={e.area} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Referrals count={e.referrals} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[color:var(--slate)]">
                        {e.referredBy ?? "Direct"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[color:var(--slate)]">
                        {sydneyDate.format(new Date(e.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
