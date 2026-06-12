"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  setMemberVerifiedAction,
  suspendMemberAction,
  unsuspendMemberAction,
} from "@/app/admin/actions";
import type { AdminMemberRow } from "@/lib/event-repository";

type RoleFilter = "all" | "attendee" | "merchant" | "admin";

type EventOption = { slug: string; title: string };

const PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const countFormatter = new Intl.NumberFormat("en-AU");

function roleTone(role: AdminMemberRow["role"]) {
  if (role === "admin") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (role === "merchant") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
}

const MAX_EVENT_CARDS = 4;

function EventCards({
  events,
  onSelect,
}: {
  events: AdminMemberRow["events"];
  onSelect?: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, MAX_EVENT_CARDS);
  const hidden = events.length - visible.length;

  return (
    <div className="mt-2">
      <p className="text-[0.6rem] font-black uppercase tracking-[0.16em] text-[color:var(--mauve)]/80">
        Events
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {visible.map((event) => (
          <button
            key={event.slug}
            type="button"
            onClick={() => onSelect?.(event.slug)}
            title={event.title}
            className="max-w-[14rem] truncate rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-2.5 py-1 text-[0.7rem] font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--peach)]"
          >
            {event.title}
          </button>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg border-2 border-dashed border-[color:var(--line)] bg-transparent px-2.5 py-1 text-[0.7rem] font-bold text-[color:var(--mauve)] transition-colors hover:bg-[color:var(--cream)]"
          >
            +{hidden} more
          </button>
        ) : null}
        {expanded && events.length > MAX_EVENT_CARDS ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-lg border-2 border-dashed border-[color:var(--line)] bg-transparent px-2.5 py-1 text-[0.7rem] font-bold text-[color:var(--mauve)] transition-colors hover:bg-[color:var(--cream)]"
          >
            Show less
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MemberActions({
  member,
  suspended,
  isPending,
  onSuspend,
  onUnsuspend,
  onToggleVerified,
}: {
  member: AdminMemberRow;
  suspended: boolean;
  isPending: boolean;
  onSuspend: (reason: string) => void;
  onUnsuspend: () => void;
  onToggleVerified: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex justify-start md:justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${member.displayName}`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--cream)]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-20 w-56 rounded-xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-2 text-left hard-shadow-sm"
        >
          <Link
            href={`/admin/members/${member.id}`}
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--cream)]"
          >
            View profile
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={isPending}
            onClick={() => {
              onToggleVerified();
              setOpen(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--cream)] disabled:opacity-60"
          >
            {member.photoVerified ? "Remove verified tick" : "Mark verified ✓"}
          </button>
          {suspended ? (
            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={() => {
                onUnsuspend();
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--peach)] disabled:opacity-60"
            >
              Unsuspend member
            </button>
          ) : confirming ? (
            <div className="grid gap-2 p-1">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason (shown in audit log)"
                className="rounded-md border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  onSuspend(reason);
                  setOpen(false);
                  setConfirming(false);
                }}
                className="rounded-lg border-2 border-[color:var(--line)] bg-[color:var(--rose)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--surface-deep)] hard-shadow-sm disabled:opacity-60"
              >
                Confirm suspend
              </button>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming(true)}
              className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[color:var(--rose)] transition-colors hover:bg-[color:var(--rose)]/10"
            >
              Suspend member
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  onEventSelect,
}: {
  member: AdminMemberRow;
  onEventSelect?: (slug: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const suspended = !!member.suspendedAt;
  const isSeed = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    member.id,
  );

  function suspend(reason: string) {
    const form = new FormData();
    form.set("profile_id", member.id);
    form.set("reason", reason);
    startTransition(async () => {
      try {
        await suspendMemberAction(form);
        toast.success(`Suspended ${member.displayName}.`);
      } catch {
        toast.error("Could not suspend. Try again.");
      }
    });
  }

  function unsuspend() {
    const form = new FormData();
    form.set("profile_id", member.id);
    startTransition(async () => {
      try {
        await unsuspendMemberAction(form);
        toast.success(`Restored ${member.displayName}.`);
      } catch {
        toast.error("Could not restore. Try again.");
      }
    });
  }

  function toggleVerified() {
    const next = !member.photoVerified;
    const form = new FormData();
    form.set("profile_id", member.id);
    form.set("verified", next ? "true" : "false");
    startTransition(async () => {
      try {
        await setMemberVerifiedAction(form);
        toast.success(
          next
            ? `${member.displayName} is now verified.`
            : `Removed ${member.displayName}'s verified tick.`,
        );
      } catch {
        toast.error("Could not update verification. Try again.");
      }
    });
  }

  return (
    <div
      className={`grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 md:grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_0.7fr_0.6fr_0.7fr] md:items-center ${
        suspended ? "bg-[color:var(--rose)]/10" : ""
      }`}
    >
      <div>
        {isSeed ? (
          <p className="font-black text-[color:var(--ink)]">{member.displayName}</p>
        ) : (
          <Link
            href={`/admin/members/${member.id}`}
            className="font-black text-[color:var(--ink)] hover:underline"
          >
            {member.displayName}
          </Link>
        )}
        <p className="text-xs font-medium text-[color:var(--mauve)]">{member.email}</p>
        {!member.onboardingComplete ? (
          <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--rose)]">
            Onboarding incomplete — not counted as attendee
          </p>
        ) : null}
        {member.intents.length > 0 ? (
          <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]/80">
            {member.intents.join(" · ")}
          </p>
        ) : null}
        <EventCards events={member.events} onSelect={onEventSelect} />
        {suspended && member.suspendedReason ? (
          <p className="mt-1 text-xs font-bold text-[color:var(--rose)]">
            Suspended: {member.suspendedReason}
          </p>
        ) : null}
      </div>
      <div>
        <span
          className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${roleTone(member.role)}`}
        >
          {member.role}
        </span>
      </div>
      <span>{member.suburb ?? "—"}</span>
      <span className="font-bold text-[color:var(--ink)]">
        {member.registrations} RSVP · {member.bookmarks} saved
      </span>
      <span className="text-xs font-bold uppercase tracking-wide">
        <span className={member.emailVerified ? "text-[color:var(--ink)]" : "text-[color:var(--mauve)]/70"}>
          Email{member.emailVerified ? " ✓" : " —"}
        </span>
        <span className="mx-1 opacity-30">·</span>
        <span className={member.photoVerified ? "text-[color:var(--ink)]" : "text-[color:var(--mauve)]/70"}>
          Photo{member.photoVerified ? " ✓" : " —"}
        </span>
      </span>
      <span>{dateFormatter.format(new Date(member.joinedAt))}</span>
      {isSeed ? (
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[color:var(--mauve)] md:text-right">
          seed data
        </span>
      ) : (
        <MemberActions
          member={member}
          suspended={suspended}
          isPending={isPending}
          onSuspend={suspend}
          onUnsuspend={unsuspend}
          onToggleVerified={toggleVerified}
        />
      )}
    </div>
  );
}

export function AdminMembersTable({
  members,
  eventOptions = [],
}: {
  members: AdminMemberRow[];
  eventOptions?: EventOption[];
}) {
  const [role, setRole] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState<number>(1);

  // Build a combined event list: every event we got from the page plus any
  // event present on a member but missing from the server list (defensive).
  const eventDropdownOptions = useMemo<EventOption[]>(() => {
    const map = new Map<string, EventOption>();
    for (const option of eventOptions) {
      map.set(option.slug, option);
    }
    for (const member of members) {
      for (const event of member.events) {
        if (!map.has(event.slug)) {
          map.set(event.slug, event);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [eventOptions, members]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return members.filter((member) => {
      if (role !== "all" && member.role !== role) return false;
      if (eventFilter !== "all" && !member.events.some((event) => event.slug === eventFilter)) {
        return false;
      }
      if (!search) return true;
      return (
        member.displayName.toLowerCase().includes(search) ||
        member.email.toLowerCase().includes(search) ||
        (member.suburb ?? "").toLowerCase().includes(search) ||
        member.events.some((event) => event.title.toLowerCase().includes(search))
      );
    });
  }, [members, role, query, eventFilter]);

  // Reset to page 1 whenever the filter result set changes shape.
  useEffect(() => {
    setPage(1);
  }, [role, query, eventFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const visible = filtered.slice(startIndex, endIndex);
  const startRow = filtered.length === 0 ? 0 : startIndex + 1;

  const roles: { value: RoleFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: members.length },
    { value: "attendee", label: "Attendees", count: members.filter((m) => m.role === "attendee").length },
    { value: "merchant", label: "Merchants", count: members.filter((m) => m.role === "merchant").length },
    { value: "admin", label: "Admins", count: members.filter((m) => m.role === "admin").length },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {roles.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRole(option.value)}
              className={`rounded-full border-2 border-[color:var(--line)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider hard-shadow-sm transition ${
                role === option.value
                  ? "bg-[color:var(--ink)] text-[color:var(--champagne)]"
                  : "bg-[color:var(--champagne)] text-[color:var(--ink)] hover:bg-[color:var(--cream)]"
              }`}
            >
              {option.label} <span className="opacity-60">({option.count})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="admin-members-event-filter">
            Filter by event
          </label>
          <select
            id="admin-members-event-filter"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
            className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-bold text-[color:var(--ink)] sm:w-64"
          >
            <option value="all">All events</option>
            {eventDropdownOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.title}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, suburb, event…"
            className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/70 sm:w-72"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="hidden grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_0.7fr_0.6fr_0.7fr] gap-4 rounded-t-2xl bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
          <span>Member</span>
          <span>Role</span>
          <span>Suburb</span>
          <span>Activity</span>
          <span>Verification</span>
          <span>Joined</span>
          <span>Moderation</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-bold text-[color:var(--mauve)]">
            No members match this filter.
          </p>
        ) : (
          visible.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onEventSelect={setEventFilter}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
          {filtered.length === 0
            ? "0 members"
            : `${countFormatter.format(startRow)}–${countFormatter.format(endIndex)} of ${countFormatter.format(filtered.length)}`}
        </p>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 font-mono text-[0.7rem] font-bold text-[color:var(--ink)]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)] transition-colors hover:bg-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <span className="font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)]">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            className="rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-1 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--ink)] transition-colors hover:bg-[color:var(--champagne)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
