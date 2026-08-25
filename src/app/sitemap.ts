import type { MetadataRoute } from "next";
import { categories, categorySlug } from "@/lib/click-data";
import { getEventsForExplore } from "@/lib/event-repository";

const SITE_URL = "https://www.letsclick.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/discover`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    // The per-category landing pages are prerendered by generateStaticParams and
    // carry their own title/description, but nothing linked them and they were
    // absent here too - so the one set of pages built to be found had neither a
    // crawl path nor a sitemap entry. The index is linked from the footer now;
    // these are the leaves it does not link directly.
    { url: `${SITE_URL}/categories`, changeFrequency: "weekly", priority: 0.6 },
    ...categories
      .filter((category) => category !== "All")
      .map((category) => ({
        url: `${SITE_URL}/categories/${categorySlug(category)}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    { url: `${SITE_URL}/safety`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/refund-policy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/security`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const events = await getEventsForExplore();
    return [
      ...staticRoutes,
      ...events.map((event) => ({
        url: `${SITE_URL}/events/${encodeURIComponent(event.id)}`,
        lastModified: new Date(event.startsAt),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
