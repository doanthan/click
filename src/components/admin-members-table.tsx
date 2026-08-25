"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  banMemberAction,
  setMemberVerifiedAction,
  suspendMemberAction,
  unbanMemberAction,
  unsuspendMemberAction,
} from "@/app/admin/actions";
import type { AdminMemberRow } from "@/lib/event-repository";
import { formatIntent } from "@/lib/click-data";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, type BadgeTone } from "@/components/ds";

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

function roleTone(role: AdminMemberRow["role"]): BadgeTone {
  if (role === "admin") return "lavender";
  if (role === "merchant") return "teal";
  return "neutral";
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
      <p className="text-[11px] font-semibold text-[color:var(--slate)]">
        Events
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {visible.map((event) => (
          <button
            key={event.slug}
            type="button"
            onClick={() => onSelect?.(event.slug)}
            title={event.title}
            className="max-w-[14rem] truncate rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2.5 py-1 text-xs font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            {event.title}
          </button>
        ))}
        {hidden > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg border border-dashed border-[color:var(--mist)] bg-transparent px-2.5 py-1 text-xs font-medium text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            +{hidden} more
          </button>
        ) : null}
        {expanded && events.length > MAX_EVENT_CARDS ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-lg border border-dashed border-[color:var(--mist)] bg-transparent px-2.5 py-1 text-xs font-medium text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)]"
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
  banned,
  isPending,
  onSuspend,
  onUnsuspend,
  onBan,
  onUnban,
  onToggleVerified,
}: {
  member: AdminMemberRow;
  suspended: boolean;
  banned: boolean;
  isPending: boolean;
  onSuspend: (reason: string) => void;
  onUnsuspend: () => void;
  onBan: (reason: string) => void;
  onUnban: () => void;
  onToggleVerified: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [banConfirming, setBanConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Only the menu's own state is reset here. The ban dialog is deliberately NOT:
  // it lives outside the menu (which is closed the moment it opens), so a stray
  // outside-click or Escape must never reach in and cancel it - ConfirmDialog
  // owns its own dismissal, and refuses it while the ban is in flight.
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
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--slate)] transition-colors hover:bg-[color:var(--lavender-100)] hover:text-[color:var(--ink)]"
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
          className="absolute right-0 top-10 z-20 w-56 rounded-xl bg-[color:var(--paper)] p-2 text-left shadow-[var(--shadow-md)]"
        >
          <Link
            href={`/admin/members/${member.id}`}
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
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
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)] disabled:opacity-60"
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
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)] disabled:opacity-60"
            >
              Unsuspend member
            </button>
          ) : confirming ? (
            <div className="grid gap-2 p-1">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason (shown in audit log)"
                className="rounded-lg border border-[color:var(--mist)] bg-white px-2 py-1.5 text-xs text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  onSuspend(reason);
                  setOpen(false);
                  setConfirming(false);
                }}
                className="ck-btn ck-btn--danger ck-btn--sm"
              >
                Confirm suspend
              </button>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming(true)}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger)]/10"
            >
              Suspend member
            </button>
          )}
          {/* SAFE-06 - permanent ban. This is not a heavier suspend: banMemberAsAdmin
              runs severAllCoordinationForUser, which invalidates every pending click
              the person sent or received, withdraws every live shared plan, and
              suppresses every active mutual click they are in. unbanMemberAsAdmin
              flips is_banned back and touches nothing else, so Lift ban restores
              none of that. A one-line input inside a dropdown was nowhere near the
              weight of that, and it never named what it was tearing down - so this
              goes through the same ConfirmDialog the account-delete control uses,
              with the reason required because the audit log is the only durable
              record of why a permanent action was taken. */}
          {banned ? (
            <button
              type="button"
              role="menuitem"
              disabled={isPending}
              onClick={() => {
                onUnban();
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)] disabled:opacity-60"
            >
              Lift ban
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setBanConfirming(true);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger)]/10"
            >
              Ban (permanent)
            </button>
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={banConfirming}
        title={`Ban ${member.displayName} permanently?`}
        description={`Every connection ${member.displayName} holds is torn down: each pending click invalidated, each mutual click suppressed, each live shared plan withdrawn. Lift ban only puts them back on the social surfaces - it brings none of that back.`}
        promptLabel="Why (saved to the audit log)"
        promptPlaceholder="e.g. three safety reports from attendees, escalated 25 Aug"
        promptRequired
        confirmLabel="Ban permanently"
        tone="rose"
        busy={isPending}
        onConfirm={(value) => {
          setBanConfirming(false);
          onBan(value);
        }}
        onCancel={() => setBanConfirming(false)}
      />
    </div>
  );
}

function MemberRow({
  member,
  joinedLabel,
  onEventSelect,
}: {
  member: AdminMemberRow;
  joinedLabel: string;
  onEventSelect?: (slug: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const suspended = !!member.suspendedAt;
  const banned = member.isBanned;
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

  function ban(reason: string) {
    const form = new FormData();
    form.set("profile_id", member.id);
    form.set("reason", reason);
    startTransition(async () => {
      try {
        await banMemberAction(form);
        toast.success(`Banned ${member.displayName} - clicks & plans torn down.`);
      } catch {
        toast.error("Could not ban. Try again.");
      }
    });
  }

  function unban() {
    const form = new FormData();
    form.set("profile_id", member.id);
    startTransition(async () => {
      try {
        await unbanMemberAction(form);
        toast.success(`Lifted ban on ${member.displayName}.`);
      } catch {
        toast.error("Could not lift ban. Try again.");
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
      className={`grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm text-[color:var(--slate)] last:border-0 md:grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_0.7fr_0.6fr_0.7fr] md:items-center ${
        banned ? "bg-[color:var(--ink)]/5" : suspended ? "bg-[color:var(--danger)]/5" : ""
      }`}
    >
      <div>
        {isSeed ? (
          <p className="font-semibold text-[color:var(--ink)]">{member.displayName}</p>
        ) : (
          <Link
            href={`/admin/members/${member.id}`}
            className="font-semibold text-[color:var(--ink)] hover:underline"
          >
            {member.displayName}
          </Link>
        )}
        <p className="text-xs text-[color:var(--slate)]">{member.email}</p>
        {/* Informational, not an error - most email-only signups sit here, so a
            red flag on every second row just reads as noise. */}
        {!member.onboardingComplete ? (
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            Onboarding incomplete · not counted as attendee
          </p>
        ) : null}
        {member.intents.length > 0 ? (
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            {member.intents.map(formatIntent).join(" · ")}
          </p>
        ) : null}
        <EventCards events={member.events} onSelect={onEventSelect} />
        {banned ? (
          <p className="mt-1 inline-flex">
            <Badge tone="coral">Banned · permanent</Badge>
          </p>
        ) : null}
        {suspended && member.suspendedReason ? (
          <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">
            Suspended: {member.suspendedReason}
          </p>
        ) : null}
      </div>
      <div>
        <Badge tone={roleTone(member.role)}>{member.role}</Badge>
      </div>
      <span>
        <span className="text-[11px] font-semibold text-[color:var(--slate)] md:hidden">
          Suburb:{" "}
        </span>
        {/* Words, not a bare em-dash - the same call admin-event-queue.tsx made.
            The DS bans the glyph outright, and a screen reader either says "em
            dash" or skips it, so an admin could not tell an unset suburb from a
            cell that failed to render. */}
        {member.suburb ?? "Not set"}
      </span>
      <span className="font-semibold text-[color:var(--ink)]">
        {member.registrations} RSVP · {member.bookmarks} saved
      </span>
      <span className="text-xs">
        <span className={member.emailVerified ? "font-semibold text-[color:var(--ink)]" : "text-[color:var(--slate)]"}>
          Email{member.emailVerified ? " ✓" : " not verified"}
        </span>
        <span className="mx-1 opacity-30">·</span>
        <span className={member.photoVerified ? "font-semibold text-[color:var(--ink)]" : "text-[color:var(--slate)]"}>
          Photo{member.photoVerified ? " ✓" : " not verified"}
        </span>
      </span>
      <span>
        <span className="text-[11px] font-semibold text-[color:var(--slate)] md:hidden">
          Joined:{" "}
        </span>
        {joinedLabel}
      </span>
      {isSeed ? (
        <span className="text-[11px] font-semibold text-[color:var(--slate)] md:text-right">
          seed data
        </span>
      ) : (
        <MemberActions
          member={member}
          suspended={suspended}
          banned={banned}
          isPending={isPending}
          onSuspend={suspend}
          onUnsuspend={unsuspend}
          onBan={ban}
          onUnban={unban}
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

  // Filter against a deferred copy of the search term so typing stays snappy on
  // the row cap; the input itself stays bound to the immediate `query`.
  const deferredQuery = useDeferredValue(query);

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

  // Per-role pill counts in ONE pass over the members (was a filter() per pill).
  const roleCounts = useMemo(() => {
    const counts = { attendee: 0, merchant: 0, admin: 0 } as Record<
      AdminMemberRow["role"],
      number
    >;
    for (const member of members) {
      counts[member.role] += 1;
    }
    return counts;
  }, [members]);

  // Precompute the formatted join date + a lowercased search haystack per row,
  // so render and filtering read precomputed values instead of re-parsing the
  // date and lowercasing every field on each keystroke.
  const displayRows = useMemo(() => {
    return members.map((member) => ({
      member,
      joinedLabel: dateFormatter.format(new Date(member.joinedAt)),
      haystack: [
        member.displayName,
        member.email,
        member.suburb ?? "",
        ...member.events.map((event) => event.title),
      ]
        .join(" ")
        .toLowerCase(),
    }));
  }, [members]);

  const filtered = useMemo(() => {
    const search = deferredQuery.trim().toLowerCase();
    return displayRows.filter((d) => {
      const member = d.member;
      if (role !== "all" && member.role !== role) return false;
      if (eventFilter !== "all" && !member.events.some((event) => event.slug === eventFilter)) {
        return false;
      }
      if (!search) return true;
      return d.haystack.includes(search);
    });
  }, [displayRows, role, deferredQuery, eventFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const visible = filtered.slice(startIndex, endIndex);
  const startRow = filtered.length === 0 ? 0 : startIndex + 1;

  const roles: { value: RoleFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: members.length },
    { value: "attendee", label: "Attendees", count: roleCounts.attendee },
    { value: "merchant", label: "Merchants", count: roleCounts.merchant },
    { value: "admin", label: "Admins", count: roleCounts.admin },
  ];

  const filtersActive = role !== "all" || eventFilter !== "all" || query.trim() !== "";

  function clearFilters() {
    setRole("all");
    setEventFilter("all");
    setQuery("");
    setPage(1);
  }

  function selectEvent(value: string) {
    setEventFilter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {roles.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setRole(option.value);
                setPage(1);
              }}
              className={`ck-tag ck-tag--select ${role === option.value ? "ck-tag--selected" : ""}`}
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
            onChange={(event) => selectEvent(event.target.value)}
            className="w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-64"
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
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, suburb, event…"
            className="w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--slate)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-72"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
        <div className="hidden grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr_0.7fr_0.6fr_0.7fr] gap-4 border-b border-[color:var(--line)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] md:grid">
          <span>Member</span>
          <span>Role</span>
          <span>Suburb</span>
          <span>Activity</span>
          <span>Verification</span>
          <span>Joined</span>
          <span>Moderation</span>
        </div>
        {visible.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              bare
              eyebrow="No members"
              title="No members match this filter."
              body={
                filtersActive
                  ? "Nothing here for the current role, event or search. Clear the filters to see everyone."
                  : "No members to show yet."
              }
              action={
                filtersActive ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ck-btn ck-btn--secondary ck-btn--sm"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          visible.map((d) => (
            <MemberRow
              key={d.member.id}
              member={d.member}
              joinedLabel={d.joinedLabel}
              onEventSelect={selectEvent}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[color:var(--slate)]">
          {filtered.length === 0
            ? "0 members"
            : `${countFormatter.format(startRow)}-${countFormatter.format(endIndex)} of ${countFormatter.format(filtered.length)}`}
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[color:var(--slate)]">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-[color:var(--mist)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
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
            className="ck-btn ck-btn--secondary ck-btn--sm"
          >
            Prev
          </button>
          <span className="text-xs font-semibold text-[color:var(--ink)]">
            {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            className="ck-btn ck-btn--secondary ck-btn--sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
