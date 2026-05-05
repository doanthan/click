import Image from "next/image";
import Link from "next/link";
import type { EventItem } from "@/lib/click-data";
import { formatCapacity } from "@/lib/click-matching";
import { Pill } from "./click-ui";

export function EventCard({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  const fullness = Math.min((event.attendees / event.capacity) * 100, 100);
  const statusTone =
    event.status === "Waitlist"
      ? "bg-[#FF6978]"
      : event.status === "Locked"
        ? "bg-white"
        : "bg-[#B1EDE8]";

  return (
    <article className="group overflow-hidden rounded-lg border-2 border-[#340068] bg-white shadow-[7px_7px_0_#340068]">
      <div className={`relative overflow-hidden border-b-2 border-[#340068] ${compact ? "h-40" : "h-56"}`}>
        <Image
          src={event.image}
          alt={event.imageAlt}
          fill
          sizes="(min-width: 1024px) 32vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <span
          className={`absolute left-3 top-3 rounded-full border-2 border-[#340068] ${statusTone} px-3 py-2 text-xs font-black text-[#340068] shadow-[3px_3px_0_#340068]`}
        >
          {event.status}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full border-2 border-[#340068] bg-[#FFFCF9] px-3 py-2 text-xs font-black text-[#340068]">
          {event.booking}
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm font-black text-[#FF6978]">
          {event.date} at {event.time}
        </p>
        <h3 className="mt-2 font-display text-3xl font-black leading-[0.98] text-[#340068]">
          {event.title}
        </h3>
        <p className="mt-2 text-sm font-bold leading-6 text-[#340068]/58">
          Hosted by {event.group}
        </p>
        <p className="mt-3 text-sm font-bold leading-6 text-[#340068]/68">
          {event.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {event.tags.slice(0, compact ? 3 : 5).map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>

        <div className="mt-5 rounded-lg border-2 border-[#340068] bg-[#FFFCF9] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#340068]/45">
            FOMO signal
          </p>
          <p className="mt-1 text-sm font-black leading-5 text-[#340068]">{event.fomo}</p>
        </div>

        <div className="mt-5">
          <div className="flex justify-between gap-4 text-xs font-black text-[#340068]/58">
            <span>{event.location}</span>
            <span>{formatCapacity(event)}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-[#340068] bg-white">
            <div className="h-full rounded-full bg-[#B1EDE8]" style={{ width: `${fullness}%` }} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href="/onboarding"
            className="rounded-full bg-[#340068] px-4 py-3 text-center text-sm font-black text-white"
          >
            RSVP
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border-2 border-[#340068] px-4 py-3 text-center text-sm font-black text-[#340068]"
          >
            Save
          </Link>
        </div>
      </div>
    </article>
  );
}
