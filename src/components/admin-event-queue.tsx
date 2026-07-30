"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { AdminEventRow } from "@/lib/event-repository";
import type { EventStatus } from "@/lib/click-data";
import type { Region } from "@/lib/geo";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";

// Skeleton sized to the real map shell (mt-6 card + h-[32rem] viewport) so the
// swap-in doesn't shift layout while mapbox-gl loads.
function MapSkeleton() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
      {/* Mirror the real map card's header strip so the swap-in doesn't shift. */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] bg-[color:var(--paper)] px-5 py-3">
        <Skeleton className="h-3.5 w-40 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-[32rem] w-full rounded-none" />
    </div>
  );
}

// Code-split mapbox-gl out of the initial bundle: the default view is the table,
// so the (hundreds of KB) map module only loads once a user switches to the map
// view. ssr:false because react-map-gl/mapbox-gl is browser-only.
const AdminEventsMap = dynamic(
  () => import("@/components/admin-events-map").then((m) => m.AdminEventsMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

type ViewMode = "table" | "map";
type StatusFilter = "all" | EventStatus;
type RegionFilter = "all" | Region;
type DateFilter = "all" | "upcoming" | "past";
type SortKey = "title" | "status" | "category" | "startsAt" | "createdAt" | "attendees";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

// --- URL <-> filter mapping ----------------------------------------------
// Every filter is mirrored in the query string so each combination is its own
// shareable URI (e.g. ?status=pending&region=sydney&when=past&q=jazz&page=2).
// Slugs are lowercase for clean URLs; defaults are OMITTED from the URL so the
// bare /admin/events stays canonical (Pending · upcoming · newest-first · p1).
const STATUS_DEFAULT: StatusFilter = "Pending";
const REGION_DEFAULT: RegionFilter = "all";
const WHEN_DEFAULT: DateFilter = "upcoming";
const VIEW_DEFAULT: ViewMode = "table";
const SORT_DEFAULT: { key: SortKey; dir: SortDir } = { key: "createdAt", dir: "desc" };

const STATUS_BY_SLUG: Record<string, StatusFilter> = {
  all: "all",
  pending: "Pending",
  live: "Live",
  featured: "Featured",
  waitlist: "Waitlist",
  locked: "Locked",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const SLUG_BY_STATUS: Record<StatusFilter, string> = {
  all: "all",
  Pending: "pending",
  Live: "live",
  Featured: "featured",
  Waitlist: "waitlist",
  Locked: "locked",
  Rejected: "rejected",
  Cancelled: "cancelled",
};

const REGION_BY_SLUG: Record<string, RegionFilter> = {
  all: "all",
  sydney: "Sydney",
  melbourne: "Melbourne",
  other: "Other",
};
const SLUG_BY_REGION: Record<RegionFilter, string> = {
  all: "all",
  Sydney: "sydney",
  Melbourne: "melbourne",
  Other: "other",
};

const SORT_KEYS: SortKey[] = ["title", "status", "category", "startsAt", "createdAt", "attendees"];

function parseWhen(value: string | null): DateFilter {
  return value === "past" || value === "all" ? value : WHEN_DEFAULT;
}

function parseSort(value: string | null): { key: SortKey; dir: SortDir } {
  if (value) {
    const [key, dir] = value.split(".");
    if ((SORT_KEYS as string[]).includes(key) && (dir === "asc" || dir === "desc")) {
      return { key: key as SortKey, dir };
    }
  }
  return SORT_DEFAULT;
}

function parsePage(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// Natural order for the Status pill — Pending first matches the queue's purpose
// (admins are usually triaging), then the live/featured states, then the cold tail.
const statusRank: Record<EventStatus, number> = {
  Pending: 0,
  Live: 1,
  Featured: 2,
  Waitlist: 3,
  Locked: 4,
  Rejected: 5,
  Cancelled: 6,
};

const regionOrder: RegionFilter[] = ["all", "Sydney", "Melbourne", "Other"];
const dateOrder: { value: DateFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

function regionTone(region: Region) {
  if (region === "Sydney") return "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]";
  if (region === "Melbourne") return "bg-[color:var(--lavender-200)] text-[color:var(--purple-700)]";
  return "bg-[color:var(--champagne-deep)] text-[color:var(--slate)]";
}

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// "Created" only needs the date — admins triage by recency, not the minute.
const createdFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Status dropdown options. Pending leads (and is the default) — the queue's whole
// purpose is triaging pending events; Live/Featured cover the published states;
// All escapes the facet. Waitlist/Locked/Rejected/Cancelled stay reachable via All.
const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "Live", label: "Live" },
  { value: "Featured", label: "Featured" },
  { value: "all", label: "All" },
];

function statusTone(status: EventStatus) {
  if (status === "Pending") return "bg-[color:var(--amber)]/15 text-[color:var(--amber-ink)]";
  if (status === "Live") return "bg-[color:var(--sage)]/15 text-[color:var(--sage-ink)]";
  if (status === "Featured") return "bg-[color:var(--lavender-100)] text-[color:var(--purple-700)]";
  if (status === "Waitlist") return "bg-[color:var(--amber)]/10 text-[color:var(--amber-ink)]";
  if (status === "Rejected") return "bg-[color:var(--coral)]/12 text-[color:var(--coral-ink)]";
  return "bg-[color:var(--champagne-deep)] text-[color:var(--slate)]";
}

export function AdminEventQueue({
  events,
  tagOptions = [],
}: {
  events: AdminEventRow[];
  tagOptions?: { slug: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState(events);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The event currently queued for a reject-with-reason confirmation. Drives the
  // branded <ConfirmDialog> (replaces the native window.prompt).
  const [rejectTarget, setRejectTarget] = useState<AdminEventRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminEventRow | null>(null);

  // The query string is the single source of truth for every filter, so the
  // browser Back/Forward buttons replay filter states and each combination is
  // its own shareable URI. We derive the live values from `searchParams` each
  // render; setters write them back via `writeParams`. Defaults match the bare
  // /admin/events (Pending · all regions · upcoming · newest-first · p1) and are
  // omitted from the URL to keep it canonical.
  const filter = STATUS_BY_SLUG[searchParams.get("status") ?? ""] ?? STATUS_DEFAULT;
  const regionFilter = REGION_BY_SLUG[searchParams.get("region") ?? ""] ?? REGION_DEFAULT;
  const dateFilter = parseWhen(searchParams.get("when"));
  const view: ViewMode = searchParams.get("view") === "map" ? "map" : "table";
  const { key: sortKey, dir: sortDir } = parseSort(searchParams.get("sort"));
  const page = parsePage(searchParams.get("page"));
  const urlQuery = searchParams.get("q") ?? "";

  // The search box keeps its own local state so typing stays instant; it's
  // debounced into the URL below. Seeded from the URL so a shared link lands
  // with the box pre-filled.
  const [query, setQuery] = useState(urlQuery);

  // Pull URL → box so Back/Forward (or a fresh link) updates the input text.
  // This is React's "adjust state during render when a value changes" pattern
  // (not an effect): when `urlQuery` shifts under us we reset the box to match.
  // It's a no-op while typing — the debounce write only changes `urlQuery` to a
  // value the box already holds, so the guard skips the reset.
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  // Merge updates into the current query string and replace the URL. `null`
  // (or a default-equal value passed as null by the caller) deletes the param.
  // router.replace (not push) means a single filter tweak doesn't bury the page
  // you arrived from under a pile of history entries — but Back still steps
  // through the distinct states you navigated to.
  function writeParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Debounce the search box into the URL: one navigation when typing settles,
  // not one per keystroke. We bail when the box already matches the URL so this
  // never fights the Back/Forward sync effect below (which pushes URL → box).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === urlQuery) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      params.delete("page"); // a new search resets to page 1
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, urlQuery, searchParams, pathname, router]);

  function toggleSort(key: SortKey) {
    let nextDir: SortDir;
    if (sortKey === key) {
      nextDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      // Dates default ascending (soonest first); everything else descending
      // (biggest counts / latest statuses on top is the more useful first glance).
      nextDir = key === "startsAt" || key === "title" || key === "category" ? "asc" : "desc";
    }
    const isDefault = key === SORT_DEFAULT.key && nextDir === SORT_DEFAULT.dir;
    writeParams({ sort: isDefault ? null : `${key}.${nextDir}`, page: null });
  }

  // Filter setters drop the page param so users never land on an empty page.
  function setFilterAndReset(v: StatusFilter) {
    writeParams({ status: v === STATUS_DEFAULT ? null : SLUG_BY_STATUS[v], page: null });
  }
  function setRegionAndReset(v: RegionFilter) {
    writeParams({ region: v === REGION_DEFAULT ? null : SLUG_BY_REGION[v], page: null });
  }
  function setDateAndReset(v: DateFilter) {
    writeParams({ when: v === WHEN_DEFAULT ? null : v, page: null });
  }
  function setViewMode(v: ViewMode) {
    writeParams({ view: v === VIEW_DEFAULT ? null : v });
  }
  function goToPage(p: number) {
    writeParams({ page: p > 1 ? String(p) : null });
  }

  // Faceted counts + filtered rows in one pass. Each facet's count reflects
  // every OTHER active filter (but not itself), so a badge never disagrees with
  // the table: e.g. with When=Upcoming active, the Pending badge counts only the
  // upcoming pending events — exactly what clicking it would show. (Previously
  // counts ignored all filters, so a past-dated pending event showed "Pending
  // (1)" over an empty table.)
  const { counts, regionCounts, filtered } = useMemo(() => {
    const search = query.trim().toLowerCase();
    // Snapshot "now" each time filters change. We don't need minute-level
    // freshness — admins reload often, and a stale boundary is harmless.
    // eslint-disable-next-line react-hooks/purity -- intentional snapshot inside memo
    const now = Date.now();

    const matchesStatus = (event: AdminEventRow) => filter === "all" || event.status === filter;
    const matchesRegion = (event: AdminEventRow) =>
      regionFilter === "all" || event.region === regionFilter;
    const matchesQuery = (event: AdminEventRow) =>
      !search ||
      event.title.toLowerCase().includes(search) ||
      event.host.toLowerCase().includes(search) ||
      event.category.toLowerCase().includes(search) ||
      (event.suburb?.toLowerCase().includes(search) ?? false);
    const matchesDate = (event: AdminEventRow) => {
      if (dateFilter === "all") return true;
      const startsMs = new Date(event.startsAt).getTime();
      // Unparseable dates are never excluded by the date facet — they're noise,
      // not a reason to hide a row from a reviewer.
      if (!Number.isFinite(startsMs)) return true;
      return dateFilter === "upcoming" ? startsMs >= now : startsMs < now;
    };

    const statusCounts = new Map<StatusFilter, number>();
    const regionCountsMap = new Map<RegionFilter, number>();
    const filteredRows: AdminEventRow[] = [];
    let statusAll = 0;
    let regionAll = 0;

    for (const event of rows) {
      const s = matchesStatus(event);
      const r = matchesRegion(event);
      const d = matchesDate(event);
      const q = matchesQuery(event);

      // Status facet ignores the status filter, region facet ignores the region
      // filter — standard faceted-search behaviour.
      if (r && d && q) {
        statusAll += 1;
        statusCounts.set(event.status, (statusCounts.get(event.status) ?? 0) + 1);
      }
      if (s && d && q) {
        regionAll += 1;
        regionCountsMap.set(event.region, (regionCountsMap.get(event.region) ?? 0) + 1);
      }
      if (s && r && d && q) {
        filteredRows.push(event);
      }
    }
    statusCounts.set("all", statusAll);
    regionCountsMap.set("all", regionAll);

    return { counts: statusCounts, regionCounts: regionCountsMap, filtered: filteredRows };
  }, [rows, filter, regionFilter, dateFilter, query]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const collator = new Intl.Collator("en-AU", { sensitivity: "base", numeric: true });
    // Copy before sorting — `filtered` is derived from `rows` state, mutating
    // it would scramble the source for the next memo run.
    return filtered.slice().sort((a, b) => {
      switch (sortKey) {
        case "title":
          return collator.compare(a.title, b.title) * dir;
        case "category":
          return collator.compare(a.category, b.category) * dir;
        case "status":
          return (statusRank[a.status] - statusRank[b.status]) * dir;
        case "attendees":
          return (a.attendees - b.attendees) * dir;
        case "startsAt": {
          // Unparseable dates sink to the bottom regardless of direction —
          // they're noise, not the answer to "soonest" or "latest".
          const at = new Date(a.startsAt).getTime();
          const bt = new Date(b.startsAt).getTime();
          if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0;
          if (!Number.isFinite(at)) return 1;
          if (!Number.isFinite(bt)) return -1;
          return (at - bt) * dir;
        }
        case "createdAt": {
          // Same missing-date handling as startsAt — rows without a created-at
          // timestamp (static fallback) always sink to the bottom.
          const at = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
          if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0;
          if (!Number.isFinite(at)) return 1;
          if (!Number.isFinite(bt)) return -1;
          return (at - bt) * dir;
        }
      }
    });
  }, [filtered, sortKey, sortDir]);

  // Clamp page if the filtered set shrank under us (e.g. approve flips a row
  // out of view). Cheap and deterministic — no effect needed.
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );
  const pageStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, sorted.length);

  async function approve(eventId: string) {
    setBusyId(eventId);

    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/approve`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { event?: { title?: string }; error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "Approval failed.");
        return;
      }

      setRows((current) =>
        current.map((event) =>
          event.id === eventId ? { ...event, status: "Live" } : event,
        ),
      );
      toast.success(`${payload.event?.title ?? "Event"} is now live.`);
    } finally {
      setBusyId(null);
    }
  }

  // Approve/reject a merchant's queued address change. Approve flips
  // pendingAddress onto the live address; reject discards it. Either way we clear
  // the banner by nulling pendingAddress on the row.
  async function decideAddress(eventId: string, decision: "approve" | "reject") {
    setBusyId(eventId);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/address`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        title?: string;
        address?: string | null;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not update the address change.");
        return;
      }
      setRows((current) =>
        current.map((event) =>
          event.id === eventId
            ? {
                ...event,
                pendingAddress: null,
                address:
                  decision === "approve" && payload.address !== undefined
                    ? payload.address
                    : event.address,
              }
            : event,
        ),
      );
      toast.success(
        decision === "approve"
          ? `Address updated for ${payload.title ?? "the event"}.`
          : `Address change declined for ${payload.title ?? "the event"}.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function saveTags(eventId: string, slugs: string[]) {
    setBusyId(eventId);
    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/tags`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs }),
        },
      );
      const payload = (await response.json()) as {
        tags?: { slug: string; label: string }[];
        error?: string;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Could not update tags.");
        return false;
      }
      setRows((current) =>
        current.map((event) =>
          event.id === eventId ? { ...event, tags: payload.tags ?? [] } : event,
        ),
      );
      toast.success("Interest tags updated.");
      return true;
    } finally {
      setBusyId(null);
    }
  }

  // Runs once the reject-reason dialog is confirmed. The reason rides through to
  // the event-rejected-merchant email + audit log (empty string is allowed — the
  // note is optional, matching the previous window.prompt behaviour).
  async function confirmReject(eventId: string, reason: string) {
    setBusyId(eventId);

    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const payload = (await response.json()) as { event?: { title?: string }; error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "Rejection failed.");
        return;
      }

      setRows((current) =>
        current.map((event) =>
          event.id === eventId ? { ...event, status: "Rejected" } : event,
        ),
      );
      toast.success(`${payload.event?.title ?? "Event"} was declined.`);
    } finally {
      setBusyId(null);
      setRejectTarget(null);
    }
  }

  async function confirmCancel(eventId: string, reason: string) {
    setBusyId(eventId);

    try {
      const response = await fetch(
        `/api/admin/events/${encodeURIComponent(eventId)}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      const payload = (await response.json()) as {
        eventTitle?: string;
        notified?: number;
        refunded?: number;
        alreadyCancelled?: boolean;
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "Cancellation failed.");
        return;
      }

      setRows((current) =>
        current.map((event) =>
          event.id === eventId ? { ...event, status: "Cancelled" } : event,
        ),
      );
      toast.success(
        payload.alreadyCancelled
          ? `${payload.eventTitle ?? "Event"} was already cancelled.`
          : `${payload.eventTitle ?? "Event"} cancelled · ${payload.notified ?? 0} notified · ${payload.refunded ?? 0} refunded.`,
      );
    } finally {
      setBusyId(null);
      setCancelTarget(null);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="eyebrow">
            Status
          </label>
          <select
            id="status-filter"
            value={filter}
            onChange={(event) => setFilterAndReset(event.target.value as StatusFilter)}
            className="rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-1.5 text-sm text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({counts.get(option.value) ?? 0})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] p-0.5">
            {(["table", "map"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={view === mode}
                className={`rounded-[9px] px-3 py-1 text-xs font-semibold transition ${
                  view === mode
                    ? "bg-[color:var(--purple)] text-[color:var(--champagne)]"
                    : "text-[color:var(--ink)] hover:bg-[color:var(--lavender-100)]"
                }`}
              >
                {mode === "table" ? "Table" : "Map"}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, host, suburb, category…"
            className="w-full rounded-xl border border-[color:var(--mist)] bg-[color:var(--paper)] px-4 py-2 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--slate)]/70 focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)] sm:w-72"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="eyebrow">When</span>
        {dateOrder.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDateAndReset(option.value)}
            aria-pressed={dateFilter === option.value}
            className={`ck-tag ck-tag--select ${dateFilter === option.value ? "ck-tag--selected" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="eyebrow">Region</span>
        {regionOrder.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRegionAndReset(option)}
            aria-pressed={regionFilter === option}
            className={`ck-tag ck-tag--select ${regionFilter === option ? "ck-tag--selected" : ""}`}
          >
            {option === "all" ? "All" : option}{" "}
            <span className="opacity-60">({regionCounts.get(option) ?? 0})</span>
          </button>
        ))}
      </div>

      {view === "map" ? (
        <AdminEventsMap events={sorted} />
      ) : (
        // overflow-visible so the row's 3-dot menu can render outside the card edge.
        <div className="mt-6 overflow-visible rounded-2xl border border-[color:var(--line)] bg-[color:var(--paper)]">
        {filtered.length > 0 ? (
          <div className="hidden grid-cols-[1.2fr_0.7fr_0.7fr_0.85fr_0.85fr_0.6fr_0.4fr] gap-4 border-b border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--slate)] md:grid">
            <SortHeader label="Event"    sortKey="title"     activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Status"   sortKey="status"    activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Category" sortKey="category"  activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Starts"   sortKey="startsAt"  activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Created"  sortKey="createdAt" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <SortHeader label="Going"    sortKey="attendees" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            <span className="text-right">Actions</span>
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <EmptyState
            bare
            eyebrow="Nothing to triage"
            title="No events match this filter."
            body="Try a different status, region, or date range — or clear the search to widen the queue."
            tone="peach"
          />
        ) : (
          pageRows.map((event) => {
            const isExpanded = expanded === event.id;
            const startsAt = new Date(event.startsAt);
            const startsLabel = Number.isNaN(startsAt.getTime())
              ? "—"
              : dateFormatter.format(startsAt);
            const createdAt = event.createdAt ? new Date(event.createdAt) : null;
            const createdLabel =
              createdAt && !Number.isNaN(createdAt.getTime())
                ? createdFormatter.format(createdAt)
                : "—";

            return (
              <div
                key={event.id}
                className="border-b border-[color:var(--line)] last:border-0"
              >
                <div className="grid gap-3 px-5 py-4 text-sm font-medium text-[color:var(--slate)] md:grid-cols-[1.2fr_0.7fr_0.7fr_0.85fr_0.85fr_0.6fr_0.4fr] md:items-center">
                  <div className="text-left">
                    <Link
                      href={`/events/${event.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--ink)] underline-offset-2 hover:underline"
                      title="Open event in a new tab"
                    >
                      {event.title}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        className="opacity-70"
                      >
                        <path
                          d="M14 5h5v5M19 5l-9 9M5 5h6M5 12v7h14v-7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="sr-only">(opens in a new tab)</span>
                    </Link>
                    <p className="text-xs font-medium text-[color:var(--slate)]">
                      Hosted by {event.host}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={`inline-flex rounded-lg px-2 py-0.5 ${regionTone(event.region)}`}
                      >
                        {event.region}
                      </span>
                      {event.suburb ? (
                        <span className="font-medium text-[color:var(--slate)]">· {event.suburb}</span>
                      ) : null}
                    </p>
                  </div>
                  <span className="flex flex-col items-start gap-1">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-semibold ${statusTone(event.status)}`}
                    >
                      {event.status}
                    </span>
                    {event.payoutsNotConnected ? (
                      <span
                        title="This event charges a price but the merchant hasn't connected Stripe payouts. Approving publishes an event no one can pay for until they finish payout setup."
                        className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--amber)]/15 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--amber-ink)]"
                      >
                        ⚠ No payouts
                      </span>
                    ) : null}
                  </span>
                  <span>{event.category}</span>
                  <span>{startsLabel}</span>
                  <span>{createdLabel}</span>
                  <span className="font-semibold text-[color:var(--ink)]">
                    {event.attendees}/{event.capacity}
                  </span>
                  <EventActions
                    event={event}
                    isExpanded={isExpanded}
                    isBusy={busyId === event.id}
                    onToggleExpand={() => setExpanded(isExpanded ? null : event.id)}
                    onApprove={() => approve(event.id)}
                    onReject={() => setRejectTarget(event)}
                    onCancel={() => setCancelTarget(event)}
                  />
                </div>
                {event.pendingAddress ? (
                  <div className="flex flex-col gap-3 border-t border-[color:var(--line)] bg-[color:var(--lavender-100)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-medium text-[color:var(--ink)]">
                      <p className="eyebrow">Address change awaiting review</p>
                      <p className="mt-1">
                        <span className="text-[color:var(--slate)] line-through">
                          {event.address ?? "No address set"}
                        </span>{" "}
                        → <span className="text-[color:var(--ink)]">{event.pendingAddress}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => decideAddress(event.id, "approve")}
                        disabled={busyId === event.id}
                        className="ck-btn ck-btn--primary ck-btn--sm"
                      >
                        Approve move
                      </button>
                      <button
                        type="button"
                        onClick={() => decideAddress(event.id, "reject")}
                        disabled={busyId === event.id}
                        className="ck-btn ck-btn--secondary ck-btn--sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : null}
                {isExpanded ? (
                  <dl className="grid gap-3 border-t border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-4 text-xs text-[color:var(--slate)] sm:grid-cols-4">
                    <div>
                      <dt className="font-semibold text-[color:var(--slate)]">Slug</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">{event.id}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[color:var(--slate)]">Booking model</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">{event.booking}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[color:var(--slate)]">Capacity</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">
                        {event.capacity} seats · {event.attendees} confirmed
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[color:var(--slate)]">Starts</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">{startsLabel}</dd>
                    </div>
                    <div className="sm:col-span-4">
                      <dt className="font-semibold text-[color:var(--slate)]">Where</dt>
                      <dd className="mt-1 text-[color:var(--ink)]">
                        <span className="font-semibold">{event.region}</span>
                        {event.suburb ? ` · ${event.suburb}` : ""}
                        {event.locationName ? ` · ${event.locationName}` : ""}
                      </dd>
                    </div>
                    <div className="sm:col-span-4">
                      <dt className="font-semibold text-[color:var(--slate)]">Interest tags</dt>
                      <dd className="mt-1.5 text-[color:var(--ink)]">
                        <EventTagEditor
                          eventTags={event.tags}
                          options={tagOptions}
                          disabled={busyId === event.id}
                          onSave={(slugs) => saveTags(event.id, slugs)}
                        />
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            );
          })
        )}
        {filtered.length > PAGE_SIZE ? (
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] bg-[color:var(--champagne)] px-5 py-3"
          >
            <p className="text-xs font-medium text-[color:var(--slate)]">
              Showing {pageStart}–{pageEnd} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="ck-btn ck-btn--secondary ck-btn--sm"
                aria-label="Previous page"
              >
                ← Prev
              </button>
              <span className="text-xs font-semibold tabular-nums text-[color:var(--ink)]">
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => goToPage(Math.min(pageCount, safePage + 1))}
                disabled={safePage >= pageCount}
                className="ck-btn ck-btn--secondary ck-btn--sm"
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          </nav>
        ) : null}
      </div>
      )}

      {/* Branded reject-reason prompt (replaces window.prompt). The reason is
          optional — empty confirms a reject with no note, as before. */}
      <ConfirmDialog
        open={rejectTarget !== null}
        title="Reject this event?"
        description={
          rejectTarget
            ? `"${rejectTarget.title}" will be declined and the merchant notified. They'll see your note below.`
            : undefined
        }
        badge="Reject"
        tone="rose"
        confirmLabel="Reject event"
        cancelLabel="Keep pending"
        busy={rejectTarget !== null && busyId === rejectTarget.id}
        promptLabel="Why is this event being declined? The merchant sees this note."
        promptPlaceholder="Optional — shared with the merchant"
        promptMultiline
        onConfirm={(reason) => {
          if (rejectTarget) confirmReject(rejectTarget.id, reason);
        }}
        onCancel={() => setRejectTarget(null)}
      />
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel and unpublish this event?"
        description={
          cancelTarget
            ? `"${cancelTarget.title}" will immediately disappear from public listings. Confirmed attendees and the host will be notified, and paid bookings will receive full refunds.`
            : undefined
        }
        badge="Live takedown"
        tone="rose"
        confirmLabel="Cancel event"
        cancelLabel="Keep event live"
        busy={cancelTarget !== null && busyId === cancelTarget.id}
        promptLabel="Why is Click cancelling this event? The host and attendees see this reason."
        promptPlaceholder="Required — be clear and factual"
        promptRequired
        promptMultiline
        onConfirm={(reason) => {
          if (cancelTarget) confirmCancel(cancelTarget.id, reason);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

function EventActions({
  event,
  isExpanded,
  isBusy,
  onToggleExpand,
  onApprove,
  onReject,
  onCancel,
}: {
  event: AdminEventRow;
  isExpanded: boolean;
  isBusy: boolean;
  onToggleExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Close the menu after firing — keeps the row's expand transition feeling
  // like the only thing that happened.
  function run(fn: () => void) {
    fn();
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex justify-start md:justify-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${event.title}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
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
          {event.status === "Pending" ? (
            <>
              {event.payoutsNotConnected ? (
                <p className="mb-1 rounded-lg bg-[color:var(--amber)]/15 px-3 py-2 text-[0.65rem] font-medium leading-snug text-[color:var(--amber-ink)]">
                  ⚠ Paid event, but the merchant hasn&rsquo;t connected payouts.
                  Approving publishes it; no one can pay until they finish setup.
                </p>
              ) : null}
              {!event.approvable ? (
                <p className="mb-1 rounded-lg bg-[color:var(--champagne)] px-3 py-2 text-[0.65rem] font-medium leading-snug text-[color:var(--slate)]">
                  This event has already passed, so it can no longer be approved.
                  Only upcoming events can go live.
                </p>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onApprove)}
                disabled={isBusy || !event.approvable}
                title={
                  event.approvable
                    ? undefined
                    : "This event has already passed and can no longer be approved."
                }
                className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? "Approving…" : "Approve event"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => run(onReject)}
                disabled={isBusy}
                className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger)]/10 disabled:opacity-60"
              >
                {isBusy ? "Working…" : "Reject event"}
              </button>
            </>
          ) : null}
          {(["Live", "Featured", "Waitlist", "Locked"] as EventStatus[]).includes(
            event.status,
          ) ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run(onCancel)}
              disabled={isBusy}
              className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger)]/10 disabled:opacity-60"
            >
              {isBusy ? "Working…" : "Cancel & unpublish"}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onToggleExpand)}
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            {isExpanded ? "Hide details" : "Inspect details"}
          </button>
          <Link
            href={`/events/${event.id}`}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--lavender-100)]"
          >
            Open in new tab ↗
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  // ▲/▼ glyphs are dim until the column is the active sort — keeps the row
  // visually quiet but still hints clickability.
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "▾";
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      aria-label={`${label}, ${active ? `sorted ${dir === "asc" ? "ascending" : "descending"}` : "not sorted"}`}
      className={`flex items-center gap-1 text-left uppercase tracking-[0.1em] transition hover:text-[color:var(--ink)] ${
        active ? "text-[color:var(--ink)]" : "text-[color:var(--slate)]"
      }`}
    >
      <span>{label}</span>
      <span className={`text-[0.7em] ${active ? "opacity-100" : "opacity-40"}`} aria-hidden="true">
        {arrow}
      </span>
    </button>
  );
}

// Inline interest-tag editor shown in an event's expanded admin row. Selected
// tags render as removable chips; an add-menu lists the remaining curated
// interest tags. Saving PUTs to /api/admin/events/[id]/tags. Click tags only —
// admins pick from existing options, never free-text.
function EventTagEditor({
  eventTags,
  options,
  disabled,
  onSave,
}: {
  eventTags: { slug: string; label: string }[];
  options: { slug: string; label: string }[];
  disabled: boolean;
  onSave: (slugs: string[]) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<{ slug: string; label: string }[]>(eventTags);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-sync if the row's tags change underneath us (e.g. after a save elsewhere)
  // using the "adjust state during render when a value changes" pattern rather
  // than an effect — keyed on the slug list so we don't loop on array identity.
  const tagsKey = eventTags.map((t) => t.slug).join("|");
  const [lastTagsKey, setLastTagsKey] = useState(tagsKey);
  if (tagsKey !== lastTagsKey) {
    setLastTagsKey(tagsKey);
    setSelected(eventTags);
  }

  const selectedSlugs = useMemo(() => new Set(selected.map((t) => t.slug)), [selected]);
  const dirty = useMemo(() => {
    const a = [...selected.map((t) => t.slug)].sort().join("|");
    const b = [...eventTags.map((t) => t.slug)].sort().join("|");
    return a !== b;
  }, [selected, eventTags]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selectedSlugs.has(o.slug))
      .filter((o) => !q || o.label.toLowerCase().includes(q))
      .slice(0, 24);
  }, [options, selectedSlugs, query]);

  const remove = (slug: string) =>
    setSelected((prev) => prev.filter((t) => t.slug !== slug));
  const add = (tag: { slug: string; label: string }) => {
    setSelected((prev) =>
      prev.some((t) => t.slug === tag.slug) ? prev : [...prev, tag],
    );
    setQuery("");
  };

  async function save() {
    setSaving(true);
    try {
      await onSave(selected.map((t) => t.slug));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 ? (
          <li className="text-xs font-medium text-[color:var(--slate)]">No interest tags yet.</li>
        ) : (
          selected.map((tag) => (
            <li key={tag.slug}>
              <span className="ck-tag">
                {tag.label}
                <button
                  type="button"
                  onClick={() => remove(tag.slug)}
                  aria-label={`Remove ${tag.label}`}
                  className="leading-none text-[color:var(--slate)] hover:text-[color:var(--ink)]"
                >
                  ×
                </button>
              </span>
            </li>
          ))
        )}
        <li>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="ck-tag ck-tag--select border-dashed"
          >
            {adding ? "Done adding" : "+ Add tag"}
          </button>
        </li>
      </ul>

      {adding ? (
        <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper)] p-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search interest tags…"
            className="mb-2 w-full rounded-lg border border-[color:var(--mist)] bg-[color:var(--paper)] px-2.5 py-1.5 text-xs text-[color:var(--ink)] focus:border-[color:var(--purple)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lavender-100)]"
          />
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {available.length === 0 ? (
              <span className="text-xs font-medium text-[color:var(--slate)]">
                No matching tags.
              </span>
            ) : (
              available.map((tag) => (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => add(tag)}
                  className="ck-tag ck-tag--select"
                >
                  + {tag.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {dirty ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={disabled || saving}
            className="ck-btn ck-btn--primary ck-btn--sm"
          >
            {saving ? "Saving…" : "Save tags"}
          </button>
          <button
            type="button"
            onClick={() => setSelected(eventTags)}
            disabled={saving}
            className="ck-btn ck-btn--ghost ck-btn--sm"
          >
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}
