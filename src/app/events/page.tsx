import { redirect } from "next/navigation";

// /events and /discover used to render the identical explorer. They're now
// consolidated onto /discover (which also carries the personalized rail), so
// this route just forwards - preserving any ?tag= / ?category= / ?search=
// deep links that still point here (homepage chips, emails, old bookmarks).
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
    else if (value != null) query.set(key, value);
  }
  const queryString = query.toString();
  redirect(queryString ? `/discover?${queryString}` : "/discover");
}
