import Link from "next/link";

// Persistent "add a profile photo" banner for members who've RSVP'd but have
// no photo yet (bug board #111). The event page already nudges on the
// ?booked=1 confirmation; this keeps the prompt visible on the surfaces they
// return to (dashboard, confirmed events) until a photo is set.
export function ProfilePhotoNudge() {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--peach)]/40 p-5 hard-shadow-sm">
      <div>
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
          ✷ Add a profile photo
        </p>
        <p className="mt-1.5 max-w-xl text-sm font-medium leading-6 text-[color:var(--mauve)]">
          You&apos;re booked in — add a photo so the people you meet can
          recognise you at the event.
        </p>
      </div>
      <Link
        href="/profile/edit"
        className="inline-flex shrink-0 items-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--ink)] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-[color:var(--champagne)] hard-shadow-sm hover:bg-[color:var(--rose)] hover:text-[color:var(--surface-deep)]"
      >
        Add a photo →
      </Link>
    </section>
  );
}
