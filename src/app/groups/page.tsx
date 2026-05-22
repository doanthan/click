import Link from "next/link";
import { BscGroupForm } from "@/components/bsc-action-forms";
import { Pill, SectionIntro } from "@/components/click-ui";
import { listBscGroups } from "@/lib/bible-study";

type GroupsPageProps = {
  searchParams?: Promise<{
    q?: string;
    location?: string;
    meeting?: string;
    day?: string;
    denomination?: string;
  }>;
};

export const metadata = {
  title: "Groups | Bible Study Connect",
};

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = (await searchParams) ?? {};
  const groups = await listBscGroups({
    query: params.q,
    location: params.location,
    meetingType: params.meeting,
    day: params.day,
    denomination: params.denomination,
  });

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Groups"
          title="Browse Bible studies near you."
          body="Search public groups by keyword, location, meeting type, denomination, day of week, age group, and tags. Private group content stays hidden from non-members."
        />

        <form className="mt-8 grid gap-3 rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-4 md:grid-cols-5">
          <input name="q" defaultValue={params.q} placeholder="Keyword" className={inputClass} />
          <input name="location" defaultValue={params.location} placeholder="Suburb, city, postcode" className={inputClass} />
          <select name="meeting" defaultValue={params.meeting ?? ""} className={inputClass}>
            <option value="">Any meeting type</option>
            <option value="in_person">In person</option>
            <option value="online">Online</option>
            <option value="both">Both</option>
          </select>
          <input name="day" defaultValue={params.day} placeholder="Day of week" className={inputClass} />
          <button className="rounded-xl bg-[color:var(--ink)] px-4 py-3 text-sm font-bold text-[color:var(--champagne)]">
            Search
          </button>
        </form>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-5">
          {groups.map((group) => (
            <article key={group.id} className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                    {group.suburb ?? group.city} · {group.dayOfWeek ?? "Flexible"}
                  </p>
                  <h2 className="font-display mt-2 text-3xl font-light leading-tight">
                    <Link href={`/groups/${group.slug}`}>{group.name}</Link>
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[color:var(--mauve)]">
                    {group.description}
                  </p>
                </div>
                <Pill tone={group.visibility === "private" ? "ink" : "peach"}>
                  {group.visibility}
                </Pill>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Pill>{group.meetingType.replace("_", " ")}</Pill>
                <Pill>{group.memberCount} members</Pill>
                {group.denomination ? <Pill>{group.denomination}</Pill> : null}
                {group.tags.slice(0, 4).map((tag) => (
                  <Pill key={tag} tone="rose">
                    {tag}
                  </Pill>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)] p-5">
          <h2 className="font-display text-3xl font-light leading-tight">Create a group</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            Requires sign in, a display name, and age verification. The creator becomes the group leader.
          </p>
          <div className="mt-5">
            <BscGroupForm />
          </div>
        </aside>
      </section>
    </main>
  );
}

const inputClass =
  "rounded-xl border border-[color:var(--line-soft)] bg-[color:var(--champagne)] px-4 py-3 text-sm font-semibold outline-none";
