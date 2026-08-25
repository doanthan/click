import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMerchantAutoApprove } from "@/components/admin-merchant-auto-approve";
import { AdminMerchantVerification } from "@/components/admin-merchant-verification";
import { Badge, type BadgeTone } from "@/components/ds";
import {
  getAdminMerchantDetail,
  getMerchantDocumentsForAdmin,
} from "@/lib/event-repository";
import type {
  AdminMerchantDetailEvent,
  AdminMerchantDocument,
} from "@/lib/event-repository";
import { requireAdminPage } from "@/lib/admin-guard";

const DOCUMENT_LABELS: Record<string, string> = {
  abn_certificate: "ABN certificate",
  public_liability_insurance: "Public liability insurance",
  liquor_licence: "Liquor licence",
};

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

function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === "approved") return "sage";
  if (s === "rejected") return "coral";
  return "amber";
}

function eventStatusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === "live" || s === "featured") return "sage";
  if (s === "cancelled" || s === "locked") return "neutral";
  if (s === "pending") return "amber";
  return "neutral";
}

function transactionTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s === "paid" || s === "succeeded") return "sage";
  if (s === "refunded" || s === "failed" || s === "cancelled") return "coral";
  return "neutral";
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
// WebServices) for automated verification - for now we deep-link the admin to the
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
  await requireAdminPage();

  const { merchantId } = await params;
  const merchant = await getAdminMerchantDetail(merchantId);
  if (!merchant) notFound();

  const documents = await getMerchantDocumentsForAdmin(merchant.id);

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
      <Link href="/admin/merchants" className="ck-btn ck-btn--secondary ck-btn--sm">
        ← All merchants
      </Link>

      <header className="rounded-[18px] bg-[color:var(--paper)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Badge tone={statusTone(merchant.verificationStatus)}>
              {titleCase(merchant.verificationStatus)}
            </Badge>
            <h1 className="font-display mt-3 text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--ink)] sm:text-5xl">
              {merchant.businessName}
            </h1>
            {merchant.tradingName && merchant.tradingName !== merchant.businessName ? (
              <p className="mt-1 text-sm text-[color:var(--slate)]">
                Trading as {merchant.tradingName}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-[color:var(--slate)]">
              {merchant.contactEmail}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {merchant.websiteUrl ? (
                <a
                  href={merchant.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-semibold text-[color:var(--purple)] underline underline-offset-2"
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
                    className="inline-block text-xs font-semibold text-[color:var(--purple)] underline underline-offset-2"
                  >
                    {social.label}
                  </a>
                ) : (
                  <span
                    key={social.platform}
                    className="inline-block text-xs font-semibold text-[color:var(--slate)]"
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
                : "Not submitted yet"
            }
          />
          <Stat
            label="ABN"
            value={merchant.abn}
            action={
              merchant.abn?.trim() ? (
                <a
                  href={abrSearchUrl(merchant.abn)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[color:var(--purple)] underline underline-offset-2"
                >
                  Verify on ABR ↗
                </a>
              ) : null
            }
          />
          <Stat label="ACN" value={merchant.acn} />
          <Stat
            label="Socials"
            value={socials.length ? socials.map((s) => s.label).join(" · ") : "None linked"}
          />
          <Stat label="Phone" value={merchant.phone} />
          <Stat label="Address" value={address} />
          <Stat
            label="Stripe Connect"
            value={merchant.stripeConnectAccountId ?? "Not connected"}
          />
        </dl>
      </header>

      <AdminMerchantVerification
        merchantId={merchant.id}
        initialStatus={merchant.verificationStatus as "pending" | "approved" | "rejected" | "suspended"}
      />

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
                className="size-16 rounded-2xl border border-[color:var(--line)] object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <Link
                href={`/admin/members/${merchant.owner.id}`}
                className="font-display text-2xl font-semibold leading-tight tracking-tight text-[color:var(--ink)] hover:underline"
              >
                {merchant.owner.displayName}
              </Link>
              <p className="mt-1 text-sm text-[color:var(--slate)]">
                {merchant.owner.email}
              </p>
              <Link
                href={`/admin/members/${merchant.owner.id}`}
                className="ck-btn ck-btn--ghost ck-btn--sm mt-3"
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
                  : "None yet"
              }
              hint={merchant.eventCategories.join(" · ") || undefined}
            />
          </div>
        </Card>
      </section>

      <Card title={`Documents (${documents.length})`}>
        {documents.length === 0 ? (
          <p className="text-sm text-[color:var(--slate)]">
            No documents uploaded.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--line-soft)]">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </ul>
        )}
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card title={`Upcoming events (${merchant.upcomingEvents.length})`}>
          {merchant.upcomingEvents.length === 0 ? (
            <p className="text-sm text-[color:var(--slate)]">
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
            <p className="text-sm text-[color:var(--slate)]">
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
          <p className="text-sm text-[color:var(--slate)]">
            No transactions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[12.5px] font-semibold text-[color:var(--slate)]">
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
                    <td className="py-3 pr-4 text-xs text-[color:var(--slate)] whitespace-nowrap">
                      {dateTimeFormatter.format(new Date(txn.createdAt))}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[color:var(--ink)]">
                      {txn.eventSlug && txn.eventTitle ? (
                        <Link
                          href={`/events/${txn.eventSlug}`}
                          className="hover:underline"
                        >
                          {txn.eventTitle}
                        </Link>
                      ) : (
                        txn.eventTitle ?? "Not recorded"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[color:var(--ink)]">
                      {txn.attendeeName ?? "Not recorded"}
                      {txn.attendeeEmail ? (
                        <span className="block text-[11px] text-[color:var(--slate)]">
                          {txn.attendeeEmail}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[color:var(--ink)] whitespace-nowrap">
                      {formatMoney(txn.amountCents, txn.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={transactionTone(txn.status)}>{txn.status}</Badge>
                    </td>
                    <td className="py-3 text-[11px] text-[color:var(--slate)]">
                      {txn.stripePaymentIntentId ?? "Not recorded"}
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

function DocumentRow({ doc }: { doc: AdminMerchantDocument }) {
  const label = DOCUMENT_LABELS[doc.document_type] ?? titleCase(doc.document_type);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-[color:var(--ink)]">{label}</p>
        <p className="mt-1 truncate text-xs text-[color:var(--slate)]">
          {doc.file_name} · {dateFormatter.format(new Date(doc.uploaded_at))}
        </p>
      </div>
      {doc.signedUrl ? (
        <a
          href={doc.signedUrl}
          target="_blank"
          rel="noreferrer"
          className="ck-btn ck-btn--secondary ck-btn--sm shrink-0"
        >
          View ↗
        </a>
      ) : (
        <span className="shrink-0 text-xs font-semibold text-[color:var(--slate)]">
          Storage off
        </span>
      )}
    </li>
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
            className="block font-semibold text-[color:var(--ink)] hover:underline"
          >
            {event.title}
          </Link>
          <p className="mt-1 text-xs text-[color:var(--slate)]">
            {event.startsAt
              ? dateFormatter.format(new Date(event.startsAt))
              : "TBD"}
            {event.suburb ? ` · ${event.suburb}` : ""}
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--ink)]">
            {capacityLabel} confirmed
            {event.waitlistedAttendees > 0
              ? ` · ${event.waitlistedAttendees} waitlist`
              : ""}
            {event.paidRevenueCents > 0
              ? ` · ${formatMoney(event.paidRevenueCents, event.currency)} paid`
              : ""}
          </p>
        </div>
        <span className="shrink-0">
          <Badge tone={eventStatusTone(event.status)}>{event.status}</Badge>
        </span>
      </div>
    </li>
  );
}

/**
 * The empty-value fallback lives HERE rather than at each call site, because a
 * call site is where the em-dash kept coming back. Every cell above now hands
 * over the raw value and lets this decide, so the next `<Stat>` somebody adds
 * cannot reintroduce the glyph by forgetting an em-dash fallback.
 *
 * Why a word and not a dash at all: the DS bans em-dashes outright, and a
 * screen reader reads a lone one as "em dash" or skips it entirely, so an
 * operator could not tell "the merchant never gave us an ABN" from "this cell
 * failed to render". A call site with a sharper word (Submitted, Stripe
 * Connect) still passes its own string.
 *
 * `|| ` not `?? `: the signup wizard can submit "" for the optional fields, and
 * an empty string is just as blank as a null.
 */
function Stat({
  label,
  value,
  action,
}: {
  label: string;
  value: string | null | undefined;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[12.5px] font-semibold text-[color:var(--slate)]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-semibold text-[color:var(--ink)]">
        {value?.trim() || "Not provided"}
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
      ? "bg-[color:var(--lavender-100)]"
      : tone === "cream"
        ? "bg-[color:var(--paper)]"
        : tone === "rose"
          ? "bg-[color:var(--mist)]"
          : "bg-[color:var(--champagne)]";
  return (
    <div
      className={`rounded-xl border border-[color:var(--line-soft)] p-3 ${toneClass}`}
      title={hint}
    >
      <p className="text-[12.5px] font-semibold text-[color:var(--slate)]">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold tracking-tight text-[color:var(--ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-[color:var(--slate)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-[color:var(--paper)] p-5 shadow-[var(--shadow-sm)]">
      <p className="eyebrow">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
