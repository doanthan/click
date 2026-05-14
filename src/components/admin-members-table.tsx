"use client";

import { useMemo, useState } from "react";
import type { AdminMemberRow } from "@/lib/event-repository";

type RoleFilter = "all" | "attendee" | "merchant" | "admin";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function roleTone(role: AdminMemberRow["role"]) {
  if (role === "admin") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (role === "merchant") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
}

export function AdminMembersTable({ members }: { members: AdminMemberRow[] }) {
  const [role, setRole] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return members.filter((member) => {
      if (role !== "all" && member.role !== role) return false;
      if (!search) return true;
      return (
        member.displayName.toLowerCase().includes(search) ||
        member.email.toLowerCase().includes(search) ||
        (member.suburb ?? "").toLowerCase().includes(search)
      );
    });
  }, [members, role, query]);

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
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, suburb…"
          className="w-full rounded-full border-2 border-[color:var(--line)] bg-[color:var(--champagne)] px-4 py-2 text-sm font-medium text-[color:var(--ink)] placeholder:text-[color:var(--mauve)]/70 sm:w-72"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] hard-shadow-sm">
        <div className="hidden grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_0.8fr_0.7fr] gap-4 bg-[color:var(--surface-deep)] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[color:var(--on-deep)] md:grid">
          <span>Member</span>
          <span>Role</span>
          <span>Suburb</span>
          <span>Activity</span>
          <span>Verification</span>
          <span>Joined</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm font-bold text-[color:var(--mauve)]">
            No members match this filter.
          </p>
        ) : (
          filtered.map((member) => (
            <div
              key={member.id}
              className="grid gap-3 border-b border-[color:var(--line)] px-5 py-4 text-sm font-medium text-[color:var(--mauve)] last:border-0 md:grid-cols-[1.4fr_0.7fr_0.9fr_0.9fr_0.8fr_0.7fr] md:items-center"
            >
              <div>
                <p className="font-black text-[color:var(--ink)]">{member.displayName}</p>
                <p className="text-xs font-medium text-[color:var(--mauve)]">{member.email}</p>
                {member.intents.length > 0 ? (
                  <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]/80">
                    {member.intents.join(" · ")}
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
