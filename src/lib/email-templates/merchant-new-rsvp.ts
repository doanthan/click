// New RSVP notification (to merchant/host) — fires when an attendee lands
// `status: 'confirmed'` on an event the merchant hosts. Voice + split-card
// layout ported from `emails/rsvp-merchant.html`.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderNoteList, renderShell } from "./chrome";
import { CHAMPAGNE, FONT_SANS, FONT_SERIF, INK, LINE_HARD, MAUVE, PEACH, SURFACE_DEEP, TEXT_BODY } from "./tokens";

export type MerchantNewRsvpData = {
  merchantFirstName: string;
  attendeeFirstName: string;
  attendeeCity: string;
  attendeeIntentLabel?: string;
  eventTitle: string;
  eventLongDate: string;
  eventStartTime: string;
  eventVenue: string;
  eventSpotsFilledLabel: string;
  attendeesUrl: string;
  eventDashboardUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildMerchantNewRsvpEmail(d: MerchantNewRsvpData) {
  const subject = `${d.attendeeFirstName} just RSVP'd to ${d.eventTitle}`;

  const text = [
    `Hi ${d.merchantFirstName},`,
    `${d.attendeeFirstName} from ${d.attendeeCity} just RSVP'd to ${d.eventTitle}.`,
    d.attendeeIntentLabel ? `Intent signal: ${d.attendeeIntentLabel}` : "",
    `When: ${d.eventLongDate}, ${d.eventStartTime}`,
    `Where: ${d.eventVenue}`,
    `Capacity: ${d.eventSpotsFilledLabel}`,
    `See your attendee list: ${d.attendeesUrl}`,
    `Open the event in your dashboard: ${d.eventDashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const intentChip = d.attendeeIntentLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${PEACH}" style="background:${PEACH};padding:5px 10px;"><span style="font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${INK};">${escapeHtml(d.attendeeIntentLabel)}</span></td></tr></table>`
    : "";

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Someone just RSVP'd")}
        ${heroTitle(`${escapeHtml(d.attendeeFirstName)} from ${escapeHtml(d.attendeeCity)} is going to ${escapeHtml(d.eventTitle)}.`)}
        ${paragraph(`Hi ${escapeHtml(d.merchantFirstName)} &mdash; here's the quick read so you know where you stand on capacity and prep.`)}
      </td>
    </tr>

    <!-- attendee + event split card -->
    <tr>
      <td class="px-gutter" style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CHAMPAGNE};border:1px solid ${LINE_HARD};border-top:2px dashed ${INK};">
          <tr>
            <td style="padding:24px 24px 8px 24px;">
              <p style="margin:0 0 10px 0;font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};">The attendee</p>
              <h2 style="margin:0 0 6px 0;font:600 20px/1.2 ${FONT_SERIF};color:${SURFACE_DEEP};letter-spacing:-0.01em;">${escapeHtml(d.attendeeFirstName)}</h2>
              <p style="margin:0 0 14px 0;font:400 14px/1.55 ${FONT_SANS};color:${TEXT_BODY};">${escapeHtml(d.attendeeCity)}</p>
              ${intentChip}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0 24px;">
              <div style="border-top:1px solid ${LINE_HARD};height:0;line-height:0;font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px 24px;">
              <p style="margin:0 0 10px 0;font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};">Your event</p>
              <h2 style="margin:0 0 12px 0;font:600 20px/1.2 ${FONT_SERIF};color:${SURFACE_DEEP};letter-spacing:-0.01em;">${escapeHtml(d.eventTitle)}</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="stack" width="50%" valign="top" style="padding-right:16px;padding-bottom:14px;">
                    <p style="margin:0 0 4px 0;font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};">When</p>
                    <p style="margin:0;font:600 15px/1.4 ${FONT_SANS};color:${SURFACE_DEEP};">${escapeHtml(d.eventLongDate)}</p>
                    <p style="margin:2px 0 0 0;font:400 15px/1.4 ${FONT_SANS};color:${TEXT_BODY};">${escapeHtml(d.eventStartTime)}</p>
                  </td>
                  <td class="stack" width="50%" valign="top" style="padding-bottom:14px;">
                    <p style="margin:0 0 4px 0;font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};">Venue</p>
                    <p style="margin:0;font:600 15px/1.4 ${FONT_SANS};color:${SURFACE_DEEP};">${escapeHtml(d.eventVenue)}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;">
                <tr>
                  <td style="border:1.5px solid ${INK};padding:8px 14px;">
                    <span style="font:600 11px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${INK};">${escapeHtml(d.eventSpotsFilledLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="px-gutter" style="padding:28px 40px 8px 40px;">
        ${renderButton({ href: d.attendeesUrl, label: "See your attendee list", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          Or <a href="${escapeHtml(d.eventDashboardUrl)}" style="color:${INK};text-decoration:underline;">open the event in your dashboard</a>.
        </p>
      </td>
    </tr>
    ${renderNoteList("A small nudge", [
      "First-timers turn up nervous. A short welcome message before the day — what to wear, where to park, what to expect at the door — goes a long way.",
      'If capacity is filling fast, mark it "Almost full" or open a waitlist from the dashboard. Both make the card pop in discover.',
      "You'll get one of these emails per RSVP today, then we'll switch to a daily digest once you cross 10 bookings.",
    ])}
  `;

  const html = renderShell({
    title: subject,
    preheader: `${d.attendeeFirstName} from ${d.attendeeCity} just RSVP'd to ${d.eventTitle}. ${d.eventSpotsFilledLabel}.`,
    headerEyebrow: "New RSVP",
    forHosts: true,
    contentHtml: body,
    reasonLine: "You're getting this because you host events on Click.",
    unsubscribeLabel: "Notification preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
