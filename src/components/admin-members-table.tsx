"use client";

import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  banMemberAction,
  setMemberVerifiedAction,
  suspendMemberAction,
  unbanMemberAction,
  unsuspendMemberAction,
} from "@/app/admin/actions";
import type { AdminMemberRow, AdminMembersPage } from "@/lib/event-repository";
import { PILOT_AREA_LABEL } from "@/lib/geo";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge, type BadgeTone } from "@/components/ds";

/** The list's filters, as they sit in the URL (see src/app/admin/members/page.tsx). */
export type MembersFilters = {
  q: string;
  role: "all" | AdminMemberRow["role"];
  event: string;
  area: "all" | "outside";
};

type EventOption = { slug: string; title: string };

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

// Every filter lives in the URL, so a pill, a page link and the form all build
// the same address. Defaults are left out to keep the links short.
function membersHref(filters: MembersFilters, page = 1) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role !== "all") params.set("role", filters.role);
  if (filters.event) params.set("event", filters.event);
  if (filters.area !== "all") params.set("area", filters.area);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/members?${query}` : "/admin/members";
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

// One line per member (bug board #274). Intents, event history and bookmarks are
// on the member's own page, one tap away through the name.
function MemberRow({ member }: { member: AdminMemberRow }) {
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
      className={`grid gap-2 border-b border-[color:var(--line)] px-5 py-3 text-sm text-[color:var(--slate)] last:border-0 md:grid-cols-[1.8fr_0.6fr_0.9fr_0.5fr_0.7fr_2.5rem] md:items-center md:gap-4 ${
        banned ? "bg-[color:var(--ink)]/5" : suspended ? "bg-[color:var(--danger)]/5" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          {isSeed ? (
            <span className="font-semibold text-[color:var(--ink)]">{member.displayName}</span>
          ) : (
            <Link
              href={`/admin/members/${member.id}`}
              className="font-semibold text-[color:var(--ink)] hover:underline"
            >
              {member.displayName}
            </Link>
          )}
          {member.photoVerified ? <Badge tone="sage">Verified</Badge> : null}
          {banned ? <Badge tone="coral">Banned</Badge> : null}
        </p>
        <p className="truncate text-xs">{member.email}</p>
        {/* Informational, not an error - most email-only signups sit here, so a
            red flag on every second row just reads as noise. */}
        {!member.onboardingComplete ? (
          <p className="mt-0.5 text-xs">Onboarding incomplete · not counted as attendee</p>
        ) : null}
        {suspended ? (
          <p className="mt-0.5 text-xs font-semibold text-[color:var(--danger)]">
            Suspended{member.suspendedReason ? `: ${member.suspendedReason}` : ""}
          </p>
        ) : null}
      </div>
      <div>
        <Badge tone={roleTone(member.role)}>{member.role}</Badge>
      </div>
      <span>
        <span className="text-[11px] font-semibold md:hidden">Suburb: </span>
        {/* Words, not a bare em-dash - the same call admin-event-queue.tsx made.
            The DS bans the glyph outright, and a screen reader either says "em
            dash" or skips it, so an admin could not tell an unset suburb from a
            cell that failed to render. */}
        {member.suburb ?? "Not set"}
      </span>
      <span className="font-semibold text-[color:var(--ink)]">
        {member.registrations} {member.registrations === 1 ? "RSVP" : "RSVPs"}
      </span>
      <span>
        <span className="text-[11px] font-semibold md:hidden">Joined: </span>
        {dateFormatter.format(new Date(member.joinedAt))}
      </span>
      {isSeed ? (
        <span className="text-[11px] font-semibold md:text-right">seed data</span>
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
  page,
  pageSize,
  filters,
  eventOptions = [],
}: {
  page: AdminMembersPage;
  pageSize: number;
  filters: MembersFilters;
  eventOptions?: EventOption[];
}) {
  const currentPage = Math.floor(page.offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(page.total / pageSize));
  const firstRow = page.total === 0 ? 0 : page.offset + 1;
  const lastRow = page.offset + page.rows.length;
  const filtersActive =
    filters.q !== "" || filters.role !== "all" || filters.event !== "" || filters.area !== "all";

  const roles: { value: MembersFilters["role"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: "attendee", label: "Attendees" },
    { value: "merchant", label: "Merchants" },
    { value: "admin", label: "Admins" },
  ];
  const areas: { value: MembersFilters["area"]; label: string }[] = [
    { value: "all", label: "Every area" },
    { value: "outside", label: "Out of area" },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {roles.map((option) => (
            <Link
              key={option.value}
              href={membersHref({ ...filters, role: option.value })}
              aria-current={filters.role === option.value ? "true" : undefined}
              className={`ck-tag ck-tag--select ${filters.role === option.value ? "ck-tag--selected" : ""}`}
            >
              {option.label}{" "}
              <span className="opacity-60">({countFormatter.format(page.roleCounts[option.value])})</span>
            </Link>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-[color:var(--mist)]" />
          {areas.map((option) => (
            <Link
              key={option.value}
              href={membersHref({ ...filters, area: option.value })}
              aria-current={filters.area === option.value ? "true" : undefined}
              className={`ck-tag ck-tag--select ${filters.area === option.value ? "ck-tag--selected" : ""}`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        {/* A GET form: the search and the event picker become the URL, so the
            server filters every member, not just a loaded window. Keyed on the
            filters so a pill or "Clear filters" resets what the inputs show. */}
        <Form
          key={JSON.stringify(filters)}
          action="/admin/members"
          role="search"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          {filters.role !== "all" ? <input type="hidden" name="role" value={filters.role} /> : null}
          {filters.area !== "all" ? <input type="hidden" name="area" value={filters.area} /> : null}
          <label className="sr-only" htmlFor="admin-members-event-filter">
            Filter by event
          </label>
          <select
            id="admin-members-event-filter"
            name="event"
            defaultValue={filters.event}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-56"
          >
            <option value="">All events</option>
            {eventOptions.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="admin-members-search">
            Search members
          </label>
          <input
            id="admin-members-search"
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Name, email or suburb"
            className="w-full rounded-xl border border-[color:var(--mist)] bg-white px-4 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--slate)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-60"
          />
          <button type="submit" className="ck-btn ck-btn--secondary ck-btn--sm">
            Search
          </button>
        </Form>
      </div>

      {filters.area === "outside" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color:var(--paper)] p-4 shadow-[var(--shadow-sm)]">
          <p className="max-w-[640px] text-sm leading-6 text-[color:var(--slate)]">
            Members whose saved suburb is outside {PILOT_AREA_LABEL}. Onboarding told them
            we&apos;d be in touch when Click reaches them - this is that list. A few suburb names
            exist in Sydney and elsewhere (Richmond, Epping); those count as Sydney.
          </p>
          {/* Everyone out of area, whatever the search or role above. */}
          <a
            href="/api/admin/members/out-of-area"
            download
            className="ck-btn ck-btn--secondary ck-btn--sm"
          >
            Download the full list (CSV)
          </a>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl bg-[color:var(--paper)] shadow-[var(--shadow-sm)]">
        <div className="hidden grid-cols-[1.8fr_0.6fr_0.9fr_0.5fr_0.7fr_2.5rem] gap-4 border-b border-[color:var(--line)] px-5 py-3 text-xs font-semibold text-[color:var(--slate)] md:grid">
          <span>Member</span>
          <span>Role</span>
          <span>Suburb</span>
          <span>RSVPs</span>
          <span>Joined</span>
          <span className="sr-only">Moderation</span>
        </div>
        {page.rows.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState
              bare
              eyebrow="No members"
              title="No members match this filter."
              body={
                filtersActive
                  ? "Nothing here for the current search, role, event or area. Clear the filters to see everyone."
                  : "No members to show yet."
              }
              action={
                filtersActive ? (
                  <Link href="/admin/members" className="ck-btn ck-btn--secondary ck-btn--sm">
                    Clear filters
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          page.rows.map((member) => <MemberRow key={member.id} member={member} />)
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[color:var(--slate)]">
          {page.total === 0
            ? "0 members"
            : `${countFormatter.format(firstRow)}-${countFormatter.format(lastRow)} of ${countFormatter.format(page.total)}`}
        </p>
        <nav aria-label="Member pages" className="flex items-center gap-2">
          {currentPage > 1 ? (
            <Link href={membersHref(filters, currentPage - 1)} className="ck-btn ck-btn--secondary ck-btn--sm">
              Prev
            </Link>
          ) : (
            <button type="button" disabled className="ck-btn ck-btn--secondary ck-btn--sm">
              Prev
            </button>
          )}
          <span className="text-xs font-semibold text-[color:var(--ink)]">
            {currentPage} / {pageCount}
          </span>
          {currentPage < pageCount ? (
            <Link href={membersHref(filters, currentPage + 1)} className="ck-btn ck-btn--secondary ck-btn--sm">
              Next
            </Link>
          ) : (
            <button type="button" disabled className="ck-btn ck-btn--secondary ck-btn--sm">
              Next
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
