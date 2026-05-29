// Payment confirmed (to attendee) — currently wired at
// `event-repository.ts:4479` from the Stripe webhook handler.
// Subject + text MUST match what `sendWorkflowEmail` already produces.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderEventCard, renderShell, renderCallout } from "./chrome";
import { FONT_SANS, INK, MAUVE } from "./tokens";

export type PaymentConfirmedData = {
  firstName: string;
  eventTitle: string;
  eventLongDate: string;
  eventStartTime: string;
  eventVenue: string;
  eventCity: string;
  amountLabel: string;
  eventDetailsUrl: string;
  receiptUrl?: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildPaymentConfirmedEmail(d: PaymentConfirmedData) {
  // ⚠ Must equal `event-repository.ts:4481` exactly.
  const subject = `You are booked for ${d.eventTitle}`;

  // ⚠ Must equal `event-repository.ts:4482-4487` exactly.
  const text = [
    `Hi ${d.firstName},`,
    `Your payment is confirmed and your RSVP is booked for ${d.eventTitle}.`,
    "You can view the event details from your Click dashboard.",
    d.eventDetailsUrl,
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Payment confirmed")}
        ${heroTitle(`Booked, ${escapeHtml(d.firstName)}.`)}
        ${paragraph(
          `Your payment is confirmed and your RSVP is booked for <strong>${escapeHtml(d.eventTitle)}</strong>. ${escapeHtml(d.amountLabel)} charged.`,
        )}
      </td>
    </tr>
    ${renderEventCard({
      title: d.eventTitle,
      when: `${d.eventLongDate} · ${d.eventStartTime}`,
      where: `${d.eventVenue}, ${d.eventCity}`,
      priceLabel: d.amountLabel,
      statusLabel: "Paid",
    })}
    <tr>
      <td class="px-gutter" style="padding:28px 40px 8px 40px;">
        ${renderButton({ href: d.eventDetailsUrl, label: "Open my booking", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          ${d.receiptUrl ? `<a href="${escapeHtml(d.receiptUrl)}" style="color:${INK};text-decoration:underline;">Download the receipt</a> &middot; ` : ""}<a href="${escapeHtml(d.eventDetailsUrl)}" style="color:${INK};text-decoration:underline;">View on your dashboard</a>
        </p>
      </td>
    </tr>
    ${renderCallout(
      "Refund window &mdash;",
      "cancel within the merchant's window to keep your full refund. Past that, the host's policy applies — it's visible on the event card if you scroll down.",
    )}
  `;

  const html = renderShell({
    title: subject,
    preheader: `${d.amountLabel} confirmed for ${d.eventTitle} on ${d.eventLongDate}.`,
    headerEyebrow: "Paid",
    contentHtml: body,
    reasonLine: "You're getting this because you booked a paid event on Click.",
    unsubscribeLabel: "Email preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
