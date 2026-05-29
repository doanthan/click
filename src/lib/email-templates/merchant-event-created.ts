// Event submitted (to merchant) — fires when an approved merchant finishes
// creating an event in `createEventForMerchant()`. The event is now `pending`
// and waiting for admin approval. Voice ported from
// `emails/event-created-merchant.html`.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderCallout, renderEventCard, renderNoteList, renderShell } from "./chrome";
import { FONT_SANS, INK, MAUVE } from "./tokens";

export type MerchantEventCreatedData = {
  merchantFirstName: string;
  eventTitle: string;
  eventCategory: string;
  eventLongDate: string;
  eventStartTime: string;
  eventCity: string;
  eventCapacityLabel: string;
  eventDashboardUrl: string;
  editEventUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildMerchantEventCreatedEmail(d: MerchantEventCreatedData) {
  const subject = `${d.eventTitle} is in review`;

  const text = [
    `Hi ${d.merchantFirstName},`,
    `Thanks for submitting ${d.eventTitle}. A moderator will take a look within one business day. Once it's approved the card goes live in discover and people can start RSVP'ing.`,
    `Event: ${d.eventTitle}`,
    `When: ${d.eventLongDate}, ${d.eventStartTime}`,
    `Where: ${d.eventCity}`,
    `Capacity: ${d.eventCapacityLabel}`,
    `Status: Awaiting moderation`,
    `Open in dashboard: ${d.eventDashboardUrl}`,
    `Edit the event: ${d.editEventUrl} (you can keep editing right up until approval)`,
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Thanks for submitting")}
        ${heroTitle(`${escapeHtml(d.eventTitle)} is in review.`)}
        ${paragraph(
          `Hi ${escapeHtml(d.merchantFirstName)} &mdash; a moderator will take a look within one business day. Once it's approved we'll email you, the card goes live in discover, and people can start RSVP'ing.`,
        )}
      </td>
    </tr>
    ${renderEventCard({
      title: d.eventTitle,
      statusLabel: "In review",
      category: d.eventCategory,
      when: `${d.eventLongDate} · ${d.eventStartTime}`,
      where: d.eventCity,
      capacityLabel: d.eventCapacityLabel,
    })}
    <tr>
      <td class="px-gutter" style="padding:28px 40px 8px 40px;">
        ${renderButton({ href: d.eventDashboardUrl, label: "Open in dashboard", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          Spotted something to fix? <a href="${escapeHtml(d.editEventUrl)}" style="color:${INK};text-decoration:underline;">Edit the event</a> &mdash; you can keep editing right up until it's approved.
        </p>
      </td>
    </tr>
    ${renderNoteList("What we look at", [
      "A real image of the activity, venue, or food — not a stock graphic. This carries the card more than the title does.",
      "A short, specific description — what people will actually do, who it's good for, and the vibe at the door.",
      "The right category and intent tags so the people most likely to enjoy it find it.",
      "Address, capacity, and price that match reality on the day.",
    ])}
    ${renderCallout(
      "Heads up &mdash;",
      "events submitted on Friday night usually land their review on Monday. If yours runs sooner than that, reply to this email and we'll fast-track it.",
    )}
  `;

  const html = renderShell({
    title: subject,
    preheader: `Thanks for submitting ${d.eventTitle}. We'll have it reviewed within one business day.`,
    headerEyebrow: "Event submitted",
    forHosts: true,
    contentHtml: body,
    reasonLine: "You're getting this because you submitted an event on Click.",
    unsubscribeLabel: "Notification preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
