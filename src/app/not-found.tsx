import Link from "next/link";
import { LinkButton } from "@/components/click-ui";

export const metadata = {
  title: "Not found | Click",
  description: "We couldn't find that page.",
};

export default function NotFound() {
  return (
    <main className="paper-noise min-h-[70vh] bg-[color:var(--champagne)] px-4 py-20 text-[color:var(--ink)] sm:px-6">
      <section className="mx-auto max-w-3xl text-center">
        <span className="sticker sticker--peach tilt-l-2 inline-flex">
          <span className="size-2 rounded-full bg-[color:var(--rose)] pulse-ring" />
          404
        </span>
        <h1 className="font-display mt-6 text-6xl font-light leading-[0.96] tracking-tight sm:text-7xl">
          That page <span className="italic">slipped past us.</span>
        </h1>
        <p className="mt-5 text-base font-medium leading-7 text-[color:var(--mauve)]">
          The link is broken, the event was unpublished, or it never existed.
          Head back and try a fresh one.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/">Back home</LinkButton>
          <Link
            href="/events"
            className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-6 text-sm font-bold tracking-wide hard-shadow-sm hover:bg-[color:var(--peach)]"
          >
            Browse events <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
