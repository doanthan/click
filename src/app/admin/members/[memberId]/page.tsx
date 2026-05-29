import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/click-ui";
import { getAdminMemberDetail } from "@/lib/event-repository";

export const metadata = {
  title: "Member Profile | Admin",
};

type AdminMemberDetailPageProps = {
  params: Promise<{ memberId: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD",
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

function transactionTone(status: string) {
  const s = status.toLowerCase();
  if (s === "paid" || s === "succeeded") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (s === "refunded" || s === "failed" || s === "cancelled")
    return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function roleTone(role: "attendee" | "merchant" | "admin") {
  if (role === "admin") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (role === "merchant") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
}

export default async function AdminMemberDetailPage({
  params,
}: AdminMemberDetailPageProps) {
  const { memberId } = await params;
  const member = await getAdminMemberDetail(memberId);
  if (!member) notFound();

  const tagGroups = member.tags.reduce<Record<string, typeof member.tags>>(
    (acc, tag) => {
      const key = tag.tagType || "interest";
      if (!acc[key]) acc[key] = [];
      acc[key].push(tag);
      return acc;
    },
    {},
  );
  const tagGroupEntries = Object.entries(tagGroups).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const intentMixEntries = member.persona
    ? Object.entries(member.persona.intentMix)
        .filter(([, value]) => Number.isFinite(value) && value > 0)
        .sort(([, a], [, b]) => b - a)
    : [];
  const intentMixTotal = intentMixEntries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="space-y-8 py-10">
      <Link
        href="/admin/members"
        className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
      >
        ← All members
      </Link>

      <header className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${roleTone(member.role)}`}
            >
              {member.role}
            </span>
            <h1 className="font-display mt-3 text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
              {member.displayName}
            </h1>
            <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {member.email}
            </p>
          </div>
          {member.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photoUrl}
              alt={member.displayName}
              className="size-24 rounded-2xl border-2 border-[color:var(--line)] object-cover hard-shadow-sm"
            />
          ) : null}
        </div>

        {member.suspendedAt ? (
          <div className="mt-5 rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--rose)]/30 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-[color:var(--surface-deep)]">
              Suspended {dateFormatter.format(new Date(member.suspendedAt))}
            </p>
            {member.suspendedReason ? (
              <p className="mt-1 text-sm font-medium text-[color:var(--ink)]">
                {member.suspendedReason}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Joined" value={dateFormatter.format(new Date(member.joinedAt))} />
          <Stat label="Suburb" value={member.suburb ?? "—"} />
          <Stat label="Age" value={member.age?.toString() ?? "—"} />
          <Stat
            label="Verification"
            value={`${member.emailVerified ? "Email ✓" : "Email —"} · ${member.photoVerified ? "Photo ✓" : "Photo —"}`}
          />
        </dl>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card title="Bio">
            <p className="text-base font-medium leading-7 text-[color:var(--ink)]">
              {member.bio ?? "This member hasn't written a bio yet."}
            </p>
          </Card>

          <Card title="Connection intents">
            <div className="flex flex-wrap gap-2">
              {member.intents.length > 0 ? (
                member.intents.map((intent) => (
                  <Pill key={intent} tone="peach">
                    {titleCase(intent)}
                  </Pill>
                ))
              ) : (
                <p className="text-sm font-medium text-[color:var(--mauve)]">
                  No intents selected.
                </p>
              )}
            </div>
          </Card>
        </div>

        <Card title="Personality quiz">
          {member.persona ? (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Click persona
                </p>
                <p className="mt-1 font-display text-3xl font-light leading-tight tracking-tight text-[color:var(--ink)]">
                  {member.persona.personaName}
                </p>
                <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  Taken{" "}
                  {dateTimeFormatter.format(new Date(member.persona.generatedAt))}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <PersonaTrait label="Social energy" value={member.persona.socialEnergy} />
                <PersonaTrait label="Pace" value={member.persona.pace} />
                <PersonaTrait label="Openness" value={member.persona.openness} />
                <PersonaTrait
                  label="Engagement"
                  value={member.persona.engagementFrequency}
                />
              </dl>

              {intentMixEntries.length > 0 ? (
                <div>
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                    Intent mix
                  </p>
                  <div className="mt-2 space-y-2">
                    {intentMixEntries.map(([key, value]) => {
                      const pct =
                        intentMixTotal > 0
                          ? Math.round((value / intentMixTotal) * 100)
                          : 0;
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between text-xs font-bold text-[color:var(--ink)]">
                            <span>{titleCase(key)}</span>
                            <span className="font-mono text-[color:var(--mauve)]">
                              {pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full border border-[color:var(--line)] bg-[color:var(--cream)]">
                            <div
                              className="h-full bg-[color:var(--rose)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              This member hasn't completed the personality quiz yet.
            </p>
          )}
        </Card>
      </section>

      <Card title={`Quiz tags & interests (${member.tags.length})`}>
        {tagGroupEntries.length > 0 ? (
          <div className="space-y-4">
            {tagGroupEntries.map(([type, items]) => (
              <div key={type}>
                <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  {titleCase(type)} · {items.length}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {items.map((tag) => (
                    <span
                      key={`${tag.tagType}-${tag.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 text-xs font-bold text-[color:var(--ink)]"
                      title={`source: ${tag.source}`}
                    >
                      {tag.label}
                      <span className="font-mono text-[0.6rem] uppercase tracking-wider text-[color:var(--mauve)]">
                        {tag.source}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-[color:var(--mauve)]">
            No tags recorded yet.
          </p>
        )}
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title={`RSVPs (${member.events.length})`}>
          {member.events.length === 0 ? (
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              No RSVPs yet.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line-soft)]">
              {member.events.map((event) => (
                <li key={event.slug} className="py-3">
                  <Link
                    href={`/events/${event.slug}`}
                    className="block font-bold text-[color:var(--ink)] hover:underline"
                  >
                    {event.title}
                  </Link>
                  <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                    {event.startsAt
                      ? dateFormatter.format(new Date(event.startsAt))
                      : "TBD"}{" "}
                    · {event.status}
                    {event.checkedInAt ? " · checked-in ✓" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Bookmarks (${member.bookmarks.length})`}>
          {member.bookmarks.length === 0 ? (
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              No bookmarks yet.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line-soft)]">
              {member.bookmarks.map((bookmark) => (
                <li key={bookmark.slug} className="py-3">
                  <Link
                    href={`/events/${bookmark.slug}`}
                    className="block font-bold text-[color:var(--ink)] hover:underline"
                  >
                    {bookmark.title}
                  </Link>
                  <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
                    Saved {dateFormatter.format(new Date(bookmark.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title={`Transaction history (${member.transactions.length})`}>
        {member.transactions.length === 0 ? (
          <p className="text-sm font-medium text-[color:var(--mauve)]">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Event</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Payment intent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line-soft)]">
                {member.transactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-[color:var(--mauve)] whitespace-nowrap">
                      {dateTimeFormatter.format(new Date(txn.createdAt))}
                    </td>
                    <td className="py-3 pr-4 font-bold text-[color:var(--ink)]">
                      {txn.eventSlug && txn.eventTitle ? (
                        <Link
                          href={`/events/${txn.eventSlug}`}
                          className="hover:underline"
                        >
                          {txn.eventTitle}
                        </Link>
                      ) : (
                        txn.eventTitle ?? "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 font-bold text-[color:var(--ink)] whitespace-nowrap">
                      {formatMoney(txn.amountCents, txn.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider ${transactionTone(txn.status)}`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[0.65rem] text-[color:var(--mauve)]">
                      {txn.stripePaymentIntentId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-[color:var(--ink)]">{value}</dd>
    </div>
  );
}

function PersonaTrait({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-bold text-[color:var(--ink)]">{titleCase(value)}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-5 hard-shadow-sm">
      <p className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[color:var(--rose)]">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
