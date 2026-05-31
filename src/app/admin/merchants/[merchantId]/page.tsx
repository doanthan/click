import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMerchantAutoApprove } from "@/components/admin-merchant-auto-approve";
import { getAdminMerchantDetail } from "@/lib/event-repository";
import type { AdminMerchantDetailEvent } from "@/lib/event-repository";

export const metadata = {
  title: "Merchant Profile | Admin",
};

type AdminMerchantDetailPageProps = {
  params: Promise<{ merchantId: string }>;
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
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (s === "rejected") return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
}

function eventStatusTone(status: string) {
  const s = status.toLowerCase();
  if (s === "live" || s === "featured")
    return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (s === "cancelled" || s === "locked")
    return "bg-[color:var(--ink)] text-[color:var(--champagne)]";
  if (s === "pending") return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

function transactionTone(status: string) {
  const s = status.toLowerCase();
  if (s === "paid" || s === "succeeded")
    return "bg-[color:var(--peach)] text-[color:var(--surface-deep)]";
  if (s === "refunded" || s === "failed" || s === "cancelled")
    return "bg-[color:var(--rose)] text-[color:var(--surface-deep)]";
  return "bg-[color:var(--cream)] text-[color:var(--ink)]";
}

function socialUrl(platform: string | null, handle: string): string | null {
  const clean = handle.replace(/^@/, "").trim();
  if (!clean) return null;
  // If the merchant pasted a full URL, trust it.
  if (/^https?:\/\//i.test(handle)) return handle;
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${clean}`;
    case "tiktok":
      return `https://tiktok.com/@${clean}`;
    case "facebook":
      return `https://facebook.com/${clean}`;
    case "youtube":
      return `https://youtube.com/@${clean}`;
    case "x":
      return `https://x.com/${clean}`;
    default:
      return null;
  }
}

// ABR (Australian Business Register) public lookup. There is also a free SOAP/JSON
// ABR Web Services API (requires a registered GUID via abr.business.gov.au/Tools/
// WebServices) for automated verification — for now we deep-link the admin to the
// official record so they can eyeball the entity name, status and GST registration.
function abrSearchUrl(abn: string): string {
  const digits = abn.replace(/\s+/g, "");
  return `https://abr.business.gov.au/ABN/View?abn=${encodeURIComponent(digits)}`;
}

function fullAddress(merchant: {
  addressStreet: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  addressPostcode: string | null;
}) {
  const parts = [
    merchant.addressStreet,
    merchant.addressSuburb,
    merchant.addressState,
    merchant.addressPostcode,
  ].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function AdminMerchantDetailPage({
  params,
}: AdminMerchantDetailPageProps) {
  const { merchantId } = await params;
  const merchant = await getAdminMerchantDetail(merchantId);
  if (!merchant) notFound();

  const address = fullAddress(merchant);
  const socials = Object.entries(merchant.socials ?? {})
    .filter(([, handle]) => handle)
    .map(([platform, handle]) => ({
      platform,
      handle,
      label: `${titleCase(platform)} · ${handle}`,
      url: socialUrl(platform, handle),
    }));

  return (
    <div className="space-y-8 py-10">
      <Link
        href="/admin/merchants"
        className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] hard-shadow-sm hover:bg-[color:var(--peach)]"
      >
        ← All merchants
      </Link>

      <header className="rounded-3xl border-2 border-[color:var(--line)] bg-[color:var(--champagne)] p-6 hard-shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider ${statusTone(merchant.verificationStatus)}`}
            >
              {merchant.verificationStatus}
            </span>
            <h1 className="font-display mt-3 text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
              {merchant.businessName}
            </h1>
            {merchant.tradingName && merchant.tradingName !== merchant.businessName ? (
              <p className="mt-1 text-sm font-medium text-[color:var(--mauve)]">
                Trading as {merchant.tradingName}
              </p>
            ) : null}
            <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
              {merchant.contactEmail}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {merchant.websiteUrl ? (
                <a
                  href={merchant.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] underline"
                >
                  {merchant.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
              {socials.map((social) =>
                social.url ? (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-bold uppercase tracking-wider text-[color:var(--ink)] underline"
                  >
                    {social.label}
                  </a>
                ) : (
                  <span
                    key={social.platform}
                    className="inline-block text-xs font-bold uppercase tracking-wider text-[color:var(--mauve)]"
                  >
                    {social.label}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Joined" value={dateFormatter.format(new Date(merchant.createdAt))} />
          <Stat
            label="Submitted"
            value={
              merchant.submittedAt
                ? dateFormatter.format(new Date(merchant.submittedAt))
                : "—"
            }
          />
          <Stat
            label="ABN"
            value={merchant.abn ?? "—"}
            action={
              merchant.abn ? (
                <a
                  href={abrSearchUrl(merchant.abn)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--rose)] underline"
                >
                  Verify on ABR ↗
                </a>
              ) : null
            }
          />
          <Stat label="ACN" value={merchant.acn ?? "—"} />
          <Stat
            label="Business type"
            value={merchant.businessType ? titleCase(merchant.businessType) : "—"}
          />
          <Stat
            label="Socials"
            value={socials.length ? socials.map((s) => s.label).join(" · ") : "—"}
          />
          <Stat label="Phone" value={merchant.phone ?? "—"} />
          <Stat label="Address" value={address ?? "—"} />
          <Stat
            label="Stripe Connect"
            value={merchant.stripeConnectAccountId ?? "Not connected"}
          />
        </dl>
      </header>

      <AdminMerchantAutoApprove
        merchantId={merchant.id}
        initial={merchant.autoApproveEvents}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Owner">
          <div className="flex items-start gap-4">
            {merchant.owner.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={merchant.owner.photoUrl}
                alt={merchant.owner.displayName}
                className="size-16 rounded-2xl border-2 border-[color:var(--line)] object-cover hard-shadow-sm"
              />
            ) : null}
            <div className="min-w-0">
              <Link
                href={`/admin/members/${merchant.owner.id}`}
                className="font-display text-2xl font-light leading-tight tracking-tight text-[color:var(--ink)] hover:underline"
              >
                {merchant.owner.displayName}
              </Link>
              <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
                {merchant.owner.email}
              </p>
              <Link
                href={`/admin/members/${merchant.owner.id}`}
                className="mt-3 inline-flex rounded-full border-2 border-[color:var(--line)] bg-[color:var(--cream)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--ink)] hover:bg-[color:var(--peach)]"
              >
                View attendee profile →
              </Link>
            </div>
          </div>
        </Card>

        <Card title="Totals">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            <Metric
              label="Upcoming events"
              value={merchant.totals.upcomingEvents.toString()}
            />
            <Metric
              label="Past events"
              value={merchant.totals.pastEvents.toString()}
            />
            <Metric
              label="Bookings"
              value={`${merchant.totals.paidBookings}/${merchant.totals.totalBookings}`}
              hint="paid / total"
            />
            <Metric
              label="Total revenue"
              value={formatMoney(merchant.totals.totalRevenueCents, "AUD")}
            />
            <Metric
              label="Paid"
              value={formatMoney(merchant.totals.paidRevenueCents, "AUD")}
              tone="peach"
            />
            <Metric
              label="Pending"
              value={formatMoney(merchant.totals.pendingRevenueCents, "AUD")}
              tone="cream"
            />
            <Metric
              label="Refunded"
              value={formatMoney(merchant.totals.refundedRevenueCents, "AUD")}
              tone="rose"
            />
            <Metric
              label="Event focus"
              value={
                merchant.eventCategories.length > 0
                  ? `${merchant.eventCategories.length} cat.`
                  : "—"
              }
              hint={merchant.eventCategories.join(" · ") || undefined}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title={`Upcoming events (${merchant.upcomingEvents.length})`}>
          {merchant.upcomingEvents.length === 0 ? (
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              No upcoming events scheduled.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line-soft)]">
              {merchant.upcomingEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Past events (${merchant.pastEvents.length})`}>
          {merchant.pastEvents.length === 0 ? (
            <p className="text-sm font-medium text-[color:var(--mauve)]">
              No past events yet.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line-soft)]">
              {merchant.pastEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title={`Transactions (${merchant.transactions.length})`}>
        {merchant.transactions.length === 0 ? (
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
                  <th className="pb-2 pr-4">Attendee</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Payment intent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line-soft)]">
                {merchant.transactions.map((txn) => (
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
                    <td className="py-3 pr-4 text-[color:var(--ink)]">
                      {txn.attendeeName ?? "—"}
                      {txn.attendeeEmail ? (
                        <span className="block font-mono text-[0.65rem] text-[color:var(--mauve)]">
                          {txn.attendeeEmail}
                        </span>
                      ) : null}
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

function EventRow({ event }: { event: AdminMerchantDetailEvent }) {
  const capacityLabel = event.capacity
    ? `${event.confirmedAttendees}/${event.capacity}`
    : `${event.confirmedAttendees}`;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/events/${event.slug}`}
            className="block font-bold text-[color:var(--ink)] hover:underline"
          >
            {event.title}
          </Link>
          <p className="mt-1 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-[color:var(--mauve)]">
            {event.startsAt
              ? dateFormatter.format(new Date(event.startsAt))
              : "TBD"}
            {event.suburb ? ` · ${event.suburb}` : ""}
          </p>
          <p className="mt-1 text-xs font-bold text-[color:var(--ink)]">
            {capacityLabel} confirmed
            {event.waitlistedAttendees > 0
              ? ` · ${event.waitlistedAttendees} waitlist`
              : ""}
            {event.paidRevenueCents > 0
              ? ` · ${formatMoney(event.paidRevenueCents, event.currency)} paid`
              : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border-2 border-[color:var(--line)] px-2.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider ${eventStatusTone(event.status)}`}
        >
          {event.status}
        </span>
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-bold text-[color:var(--ink)]">
        {value}
        {action ? <span className="ml-2 font-normal">{action}</span> : null}
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "champagne",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "champagne" | "peach" | "cream" | "rose";
}) {
  const toneClass =
    tone === "peach"
      ? "bg-[color:var(--peach)]"
      : tone === "cream"
        ? "bg-[color:var(--cream)]"
        : tone === "rose"
          ? "bg-[color:var(--rose)]/40"
          : "bg-[color:var(--champagne)]";
  return (
    <div
      className={`rounded-xl border-2 border-[color:var(--line)] p-3 ${toneClass}`}
      title={hint}
    >
      <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[color:var(--mauve)]">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-light tracking-tight text-[color:var(--ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[0.65rem] font-medium text-[color:var(--mauve)]">
          {hint}
        </p>
      ) : null}
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
