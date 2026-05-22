import { BscPrayerForm } from "@/components/bsc-action-forms";
import { Pill, SectionIntro } from "@/components/click-ui";
import { listBscPrayerPosts } from "@/lib/bible-study";

export const metadata = {
  title: "Prayer Wall | Bible Study Connect",
};

export default async function PrayerPage() {
  const posts = await listBscPrayerPosts();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Prayer wall"
          title="Pray with the community."
          body="Post prayer requests, praise reports, answered prayers, and comments. Praise posts use a warm amber treatment."
        />
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-5">
          {posts.map((post) => (
            <article
              key={post.id}
              className={`rounded-2xl border border-[color:var(--line-soft)] p-5 shadow-sm ${
                post.kind === "praise" ? "bg-[#fff1c8]" : "bg-[color:var(--cream)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Pill tone={post.kind === "praise" ? "rose" : "peach"}>
                    {post.kind === "praise" ? "Praise report" : "Prayer request"}
                  </Pill>
                  <h2 className="font-display mt-3 text-3xl font-light leading-tight">{post.title}</h2>
                </div>
                <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[color:var(--mauve)]">
                  {post.prayedCount} prayed
                </p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{post.content}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                Shared by {post.authorName} {post.groupName ? `in ${post.groupName}` : ""}
              </p>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)] p-5">
          <h2 className="font-display text-3xl font-light leading-tight">Post prayer or praise</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            Posting is gated by profile completion and age verification.
          </p>
          <div className="mt-5">
            <BscPrayerForm />
          </div>
        </aside>
      </section>
    </main>
  );
}
