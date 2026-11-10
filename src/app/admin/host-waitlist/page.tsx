import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge, Tag, ckBtn } from "@/components/ds";
import { requireAdminPage } from "@/lib/admin-guard";
import {
  eventTypeLabel,
  getHostWaitlistForAdmin,
  mailtoHref,
  websiteHref,
  type HostWaitlistEntry,
} from "@/lib/host-waitlist";

export const metadata = {
  title: "Host Waitlist | Admin",
};

// Sydney, like every other date the admin console prints.
const sydneyDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const AREA_LABEL: Record<NonNullable<HostWaitlistEntry["area"]>, string> = {
  pilot: "Sydney",
  outside: "Elsewhere",
  unknown: "Unrecognised",
};

function AreaBadge({ area }: { area: HostWaitlistEntry["area"] }) {
  if (!area) return null;
  return <Badge tone={area === "pilot" ? "lavender" : "neutral"}>{AREA_LABEL[area]}</Badge>;
}

const QUIET = <span className="text-[color:var(--slate)]">-</span>;

/** The typed website or handle: a link only when it is plainly http(s), text otherwise. */
function Website({ value }: { value: string | null }) {
  if (!value) return QUIET;
  const href = websiteHref(value);
  if (!href) return <span className="break-all text-[color:var(--ink)]">{value}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-all text-[color:var(--purple)] underline-offset-2 hover:underline"
    >
      {value}
    </a>
  );
}

function EventTypes({ keys }: { keys: string[] }) {
  if (keys.length === 0) return QUIET;
  return (
    <span className="flex flex-wrap gap-1.5">
      {keys.map((key) => (
        <Tag key={key} dense>
          {eventTypeLabel(key)}
        </Tag>
      ))}
    </span>
  );
}

export default async function AdminHostWaitlistPage() {
  const session = await requireAdminPage();

  let entries: HostWaitlistEntry[] = [];
  let problem: string | null = null;
  try {
    entries = await getHostWaitlistForAdmin(session);
  } catch (error) {
    problem =
      (error as { code?: string } | null)?.code === "42P01"
        ? "This database has no host_waitlist table yet - migration 081 hasn't been applied."
        : "Couldn't read the host waitlist just now. Try again in a moment.";
  }

  const inSydney = entries.filter((e) => e.area === "pilot").length;
  const elsewhere = entries.filter((e) => e.area === "outside" || e.area === "unknown").length;
  const noPlace = entries.length - inSydney - elsewhere;

  return (
    <div className="space-y-8 py-10">
      <AdminPageHeader
        eyebrow="Pre-launch"
        title="Host Waitlist"
        description="Businesses and people who left their details in the homepage's For hosts section, first come first served. Not merchants yet - instant-access signups are under Merchants."
        action={
          entries.length > 0 ? (
            <a href="/api/admin/host-waitlist" download className={ckBtn("secondary", "sm")}>
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
            No hosts on the list yet. The form is in the{" "}
            <Link href="/#hosts" className="font-semibold text-[color:var(--purple)] underline">
              For hosts
            </Link>{" "}
            section of the homepage.
          </p>
        ) : (
          <>
            <p className="border-b border-[color:var(--line)] px-5 py-3.5 text-sm text-[color:var(--slate)]">
              <strong className="text-[color:var(--ink)] tabular-nums">{entries.length}</strong>{" "}
              host{entries.length === 1 ? "" : "s"} · {inSydney} in Sydney · {elsewhere} elsewhere
              {noPlace > 0 ? ` · ${noPlace} didn't say where` : ""}
            </p>

            {/* Mobile (< md): stacked rows instead of a wide table. */}
            <ol className="divide-y divide-[color:var(--line)] md:hidden">
              {entries.map((e, i) => (
                <li key={e.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-semibold text-[color:var(--ink)]">
                      <span className="mr-2 text-[color:var(--slate)] tabular-nums">{i + 1}.</span>
                      {e.businessName}
                    </p>
                    <AreaBadge area={e.area} />
                  </div>
                  <p className="text-sm text-[color:var(--ink)]">
                    {e.contactName ? `${e.contactName} · ` : ""}
                    <a href={mailtoHref(e.email)} className="break-all hover:text-[color:var(--purple)]">
                      {e.email}
                    </a>
                    {e.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${e.phone}`} className="hover:text-[color:var(--purple)]">
                          {e.phone}
                        </a>
                      </>
                    ) : null}
                  </p>
                  {e.eventTypes.length > 0 ? <EventTypes keys={e.eventTypes} /> : null}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--slate)]">
                    {e.place ? <span>{e.place}</span> : null}
                    {e.website ? <Website value={e.website} /> : null}
                    <span>{sydneyDate.format(new Date(e.createdAt))}</span>
                  </p>
                </li>
              ))}
            </ol>

            {/* Desktop (md+): the full table. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-[color:var(--line)]">
                  <tr className="text-xs font-semibold text-[color:var(--slate)]">
                    <th className="w-12 px-4 py-3">#</th>
                    <th className="px-4 py-3">Business or venue</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Where they host</th>
                    <th className="px-4 py-3">Would host</th>
                    <th className="px-4 py-3">Website or Instagram</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {entries.map((e, i) => (
                    <tr key={e.id} className="align-top">
                      <td className="px-4 py-3 text-[color:var(--slate)] tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[color:var(--ink)]">{e.businessName}</span>
                        {e.contactName ? (
                          <span className="mt-0.5 block text-xs text-[color:var(--slate)]">{e.contactName}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={mailtoHref(e.email)}
                          className="block text-[color:var(--ink)] hover:text-[color:var(--purple)]"
                        >
                          {e.email}
                        </a>
                        {e.phone ? (
                          <a
                            href={`tel:${e.phone}`}
                            className="mt-0.5 block text-xs text-[color:var(--slate)] hover:text-[color:var(--purple)]"
                          >
                            {e.phone}
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {e.place ? (
                          <span className="flex flex-wrap items-center gap-2 text-[color:var(--ink)]">
                            {e.place}
                            <AreaBadge area={e.area} />
                          </span>
                        ) : (
                          QUIET
                        )}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <EventTypes keys={e.eventTypes} />
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-xs">
                        <Website value={e.website} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-[color:var(--slate)]">
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
