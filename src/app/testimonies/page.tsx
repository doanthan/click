import { BscTestimonyForm } from "@/components/bsc-action-forms";
import { Pill, SectionIntro } from "@/components/click-ui";
import { listBscTestimonies } from "@/lib/bible-study";

export const metadata = {
  title: "Testimonies | Bible Study Connect",
};

export default async function TestimoniesPage() {
  const testimonies = await listBscTestimonies();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] px-4 py-12 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Testimonies"
          title="Stories of faith, reviewed before publishing."
          body="Members can submit testimonies anonymously, with first name only, or with full name. Admin approval is required before public display."
        />
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-5">
          {testimonies.map((testimony) => (
            <article key={testimony.id} className="rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--cream)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-3xl font-light leading-tight">{testimony.title}</h2>
                <Pill tone="peach">{testimony.likeCount} likes</Pill>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--mauve)]">{testimony.story}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                Shared by {testimony.authorName}
              </p>
            </article>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-[color:var(--line-soft)] bg-[color:var(--champagne-deep)] p-5">
          <h2 className="font-display text-3xl font-light leading-tight">Submit testimony</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--mauve)]">
            New testimonies stay pending until an admin approves them.
          </p>
          <div className="mt-5">
            <BscTestimonyForm />
          </div>
        </aside>
      </section>
    </main>
  );
}
