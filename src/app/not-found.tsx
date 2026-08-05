import Link from "next/link";

export const metadata = {
  title: "Lost the plot · 404",
  description: "That page slipped through the cracks.",
};

export default function NotFoundPage() {
  return (
    <main className="paper-noise relative min-h-screen overflow-hidden px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <section className="relative z-10 mx-auto max-w-2xl rounded-[20px] bg-[color:var(--paper)] p-10 text-center shadow-[var(--shadow-sm)]">
        <p className="eyebrow">404 · lost the plot</p>
        <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
          That page didn’t <span className="text-[color:var(--purple)]">click</span>.
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          The link may be old, mistyped, or the event you were chasing has
          ended. Try one of these instead.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="ck-btn ck-btn--primary ck-btn--md">
            Home
          </Link>
          <Link href="/events" className="ck-btn ck-btn--secondary ck-btn--md">
            Browse events
          </Link>
          <Link href="/dashboard" className="ck-btn ck-btn--secondary ck-btn--md">
            Your dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
