import Link from "next/link";

export const metadata = {
  title: "Lost the plot · 404 | Click",
  description: "That page slipped through the cracks.",
};

export default function NotFoundPage() {
  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <div className="confetti-field absolute inset-0 opacity-20" aria-hidden />
      <section className="relative z-10 mx-auto max-w-2xl rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-10 text-center hard-shadow">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          404 · lost the plot
        </span>
        <h1 className="font-display mt-6 text-5xl font-light leading-[0.96] tracking-tight sm:text-6xl">
          That page didn’t <span className="italic">click</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          The link may be old, mistyped, or the event you were chasing has
          ended. Try one of these instead.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--surface-deep)] hard-shadow-sm hover:bg-[color:var(--ink)] hover:text-[color:var(--on-deep)]"
          >
            Home
          </Link>
          <Link
            href="/events"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--peach)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--cream)]"
          >
            Browse events
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Your dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
