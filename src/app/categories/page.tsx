import Link from "next/link";
import { CatGlyph, Icon, categoryGlyphKey } from "@/components/ds";
import { getEventCategories } from "@/lib/event-repository";

export const metadata = {
  title: "Categories",
  description:
    "Browse Click events by category - and the tags that quietly power who you meet.",
};

// Event and tag counts are read live from Postgres, so never statically cache.
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getEventCategories();

  return (
    <main className="min-h-screen bg-[color:var(--champagne)] pb-24 text-[color:var(--ink)]">
      <div className="ck-page pt-8">
        <h1 className="font-display max-w-[720px] text-[length:var(--text-h1)] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--ink)]">
          Every category of getting out.
        </h1>
        <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-[color:var(--slate)] sm:text-base">
          Click sorts Sydney&apos;s social calendar into a handful of honest categories, and tags the vibe underneath
          each one. Pick a lane to see what&apos;s on.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const shownTags = category.tags.slice(0, 4);
            const extraTags = category.tags.length - shownTags.length;

            return (
              <Link
                key={category.slug}
                href={`/discover?category=${encodeURIComponent(category.name)}`}
                className="group flex flex-col rounded-[var(--radius-xl)] border border-[color:var(--line-soft)] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* The ONE category treatment - a purple line glyph on a
                      lavender disc. Never an emoji, never a per-category colour. */}
                  <span className="flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lavender)_18%,var(--champagne))] text-[color:var(--purple)]">
                    <CatGlyph name={categoryGlyphKey(category.name)} size={26} />
                  </span>
                  <span className="ck-badge bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]">
                    {category.eventCount} {category.eventCount === 1 ? "event" : "events"}
                  </span>
                </div>

                <h3 className="font-display mt-4 text-[1.3rem] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
                  {category.name}
                </h3>
                {category.description ? (
                  <p className="mt-1.5 text-sm leading-6 text-[color:var(--ink-soft)]">{category.description}</p>
                ) : null}

                {shownTags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {shownTags.map((tag) => (
                      <span key={tag} className="ck-tag ck-tag--dense">
                        {tag}
                      </span>
                    ))}
                    {extraTags > 0 ? (
                      <span className="ck-tag ck-tag--dense text-[color:var(--slate)]">+{extraTags}</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between border-t border-[color:var(--mist)] pt-4">
                  <span className="text-[12.5px] font-medium text-[color:var(--slate)]">
                    {category.tagCount} {category.tagCount === 1 ? "tag" : "tags"}
                  </span>
                  <span className="font-display inline-flex items-center gap-1 text-[13.5px] font-semibold text-[color:var(--purple)]">
                    Browse
                    <Icon name="arrowR" size={15} stroke={2.2} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-[color:var(--slate)]">
          Looking for something specific?{" "}
          <Link href="/discover" className="font-semibold text-[color:var(--purple)] hover:underline">
            Search every event in Discover →
          </Link>
        </p>
      </div>
    </main>
  );
}
