import Image from "next/image";
import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
import { formatCapacity } from "@/lib/click-matching";
import { Pill } from "./click-ui";
import { EventRegistrationButton } from "./event-registration-button";

export function EventCard({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  const fullness = Math.min((event.attendees / event.capacity) * 100, 100);
  const statusTone =
    event.status === "Waitlist"
      ? "bg-[color:var(--rose)] text-[color:var(--champagne)]"
      : event.status === "Locked"
        ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
        : "bg-[color:var(--peach)] text-[color:var(--ink)]";

  return (
    <article className="group relative overflow-hidden rounded-2xl border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.4deg] hard-shadow-sm hover:[box-shadow:8px_8px_0_0_var(--ink)]">
      <div className={`relative overflow-hidden border-b-2 border-[color:var(--ink)] ${compact ? "h-44" : "h-60"}`}>
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes="(min-width: 1024px) 32vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ink)]/30 via-transparent to-transparent" />
        <span
          className={`absolute left-3 top-3 rounded-full border-2 border-[color:var(--ink)] ${statusTone} px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider hard-shadow-sm`}
        >
          {event.status}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm">
          {event.booking}
        </span>
      </div>
      <div className="p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--rose)]">
          {event.date} · {event.time}
        </p>
        <h3 className="font-display mt-2 text-[1.65rem] font-light leading-[1.04] text-[color:var(--ink)]">
          {event.title}
        </h3>
        <p className="mt-1 text-sm font-semibold text-[color:var(--mauve)]">
          Hosted by {event.host} <span className="opacity-50">·</span> {event.group}
        </p>
        <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--mauve)]">
          {event.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {event.tags.slice(0, compact ? 3 : 5).map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>

        <div className="mt-5 rounded-xl border-2 border-dashed border-[color:var(--ink)] bg-[color:var(--cream)] p-3">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
            why it feels easy ✷
          </p>
          <p className="mt-1 text-sm font-bold leading-5 text-[color:var(--ink)]">{event.fomo}</p>
        </div>

        <div className="mt-5">
          <div className="flex justify-between gap-4 text-xs font-bold text-[color:var(--mauve)]">
            <span>{event.location}</span>
            <span>{formatCapacity(event)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full border border-[color:var(--ink)] bg-[color:var(--champagne)]">
            <div className="h-full rounded-full bg-[color:var(--rose)]" style={{ width: `${fullness}%` }} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <EventRegistrationButton eventId={event.id} />
          <Link
            href="/dashboard"
            className="rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--champagne)] px-4 py-3 text-center text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
          >
            Save
          </Link>
        </div>
      </div>
    </article>
  );
}
