import { notFound } from "next/navigation";
import { Pill, SectionIntro } from "@/components/click-ui";
import { getBscGroup } from "@/lib/bible-study";

type GroupPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { slug } = await params;
  const group = await getBscGroup(slug);
  if (!group) notFound();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <SectionIntro
          eyebrow={`${group.visibility} group`}
          title={group.name}
          body={group.description}
        />
        <div className="mt-8 flex flex-wrap gap-2">
          <Pill>{group.meetingType.replace("_", " ")}</Pill>
          <Pill>{group.schedule ?? "Schedule to confirm"}</Pill>
          <Pill>{group.suburb ?? group.city ?? "Location flexible"}</Pill>
          <Pill>{group.memberCount} members</Pill>
          {group.tags.map((tag) => (
            <Pill key={tag} tone="rose">
              {tag}
            </Pill>
          ))}
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Discussion board", "Posts with title, content, category, and comments for group members."],
            ["Group chat", "Ephemeral group messages can be stored with optional expiry."],
            ["Group events", "Events can be linked to this group and made visible only to members."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5">
              <h2 className="font-display text-2xl font-light leading-tight">{title}</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
