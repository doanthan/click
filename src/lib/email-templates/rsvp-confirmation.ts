// RSVP confirmed (to attendee) - fires when a user lands `status: 'confirmed'`
// in `registerForEvent()`. Voice + meta-grid card ported from
// `emails/rsvp-attendee.html`. Includes a social-signal flourish (a Poppins
// Grotesk line under the ticket meta) when present.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderEventCard, renderNoteList, renderShell } from "./chrome";
import { FONT_SANS, FONT_SERIF, INK, LINE_SOFT, MAUVE, ROSE, TEXT_BODY } from "./tokens";

export type RsvpConfirmationData = {
  firstName: string;
  eventTitle: string;
  eventCategory: string;
  eventHostName: string;
  eventLongDate: string;
  eventStartTime: string;
  eventEndTime: string;
  eventVenue: string;
  eventAddress: string;
  eventCity: string;
  eventPriceLabel: string;
  eventSpotsFilledLabel: string;
  eventDetailsUrl: string;
  addToCalendarUrl: string;
  cancelRsvpUrl: string;
  socialSignalLabel?: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildRsvpConfirmationEmail(d: RsvpConfirmationData) {
  const subject = `You're going to ${d.eventTitle}`;

  const text = [
    `Hi ${d.firstName},`,
    `You're confirmed for ${d.eventTitle} on ${d.eventLongDate}, ${d.eventStartTime}–${d.eventEndTime}.`,
    `${d.eventVenue} - ${d.eventAddress}, ${d.eventCity}.`,
    `Hosted by ${d.eventHostName}. ${d.eventPriceLabel}. ${d.eventSpotsFilledLabel}.`,
    `Event details: ${d.eventDetailsUrl}`,
    `Add to calendar: ${d.addToCalendarUrl}`,
    `Plans change? Cancel here so the seat opens for the waitlist: ${d.cancelRsvpUrl}`,
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("You're going")}
        ${heroTitle(`See you at <span style="color:${ROSE};">${escapeHtml(d.eventTitle)}</span>, ${escapeHtml(d.firstName)}.`)}
        ${paragraph("Your spot is held. Add it to your calendar so it survives the week, and we'll send a small nudge the day before.")}
      </td>
    </tr>
    ${renderEventCard({
      title: d.eventTitle,
      category: d.eventCategory,
      hostName: d.eventHostName,
      when: `${d.eventLongDate} · ${d.eventStartTime}–${d.eventEndTime}`,
      where: `${d.eventVenue}, ${d.eventCity}`,
      priceLabel: d.eventPriceLabel,
      capacityLabel: d.eventSpotsFilledLabel,
    })}
    ${
      d.socialSignalLabel
        ? `<tr><td class="px-gutter" style="padding:0 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid ${LINE_SOFT};margin-top:-1px;"><tr><td style="padding:16px 0 0 0;"><p style="margin:0;font:400 14px/1.5 ${FONT_SANS};color:${INK};"><span style="font:600 14px/1 ${FONT_SERIF};">${escapeHtml(d.socialSignalLabel)}</span></p></td></tr></table></td></tr>`
        : ""
    }
    <tr>
      <td class="px-gutter" style="padding:28px 40px 8px 40px;">
        ${renderButton({ href: d.eventDetailsUrl, label: "View event details", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          <a href="${escapeHtml(d.addToCalendarUrl)}" style="color:${INK};text-decoration:underline;">Add to calendar</a> &middot;
          <a href="${escapeHtml(d.cancelRsvpUrl)}" style="color:${INK};text-decoration:underline;">Can't make it?</a>
        </p>
      </td>
    </tr>
    ${renderNoteList("Good to know", [
      "Plans change. If you can't make it, cancel as early as you can - it frees the seat for someone on the waitlist.",
      "Coming alone is the norm here, not the exception. Most people you'll meet are doing the same.",
      "Questions about the event itself reach the host fastest - reply to this email and we'll route it.",
    ])}
  `;
  void TEXT_BODY;

  const html = renderShell({
    title: subject,
    preheader: `${d.eventLongDate}, ${d.eventStartTime} at ${d.eventVenue}. Your spot is held.`,
    headerEyebrow: "RSVP confirmed",
    contentHtml: body,
    reasonLine: "You're getting this because you RSVP'd through Click.",
    unsubscribeLabel: "Email preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
