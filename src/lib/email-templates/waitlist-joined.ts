// Waitlist joined (to attendee) — currently wired at `event-repository.ts:1544`.
// Subject + text MUST match what `sendWorkflowEmail` already produces so that
// swapping the call site to use this builder is a one-line change.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderShell, renderCallout } from "./chrome";
import { FONT_SANS, INK, MAUVE } from "./tokens";

export type WaitlistJoinedData = {
  firstName: string;
  eventTitle: string;
  eventLongDate: string;
  eventStartTime: string;
  eventVenue: string;
  eventCity: string;
  eventDetailsUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildWaitlistJoinedEmail(d: WaitlistJoinedData) {
  // ⚠ Must equal `event-repository.ts:1546` exactly.
  const subject = `You are on the waitlist for ${d.eventTitle}`;

  // ⚠ Must equal `event-repository.ts:1547-1552` exactly.
  const text = [
    `Hi ${d.firstName},`,
    `You are on the waitlist for ${d.eventTitle}.`,
    "If a spot opens, Click will notify you by email and in your dashboard.",
    d.eventDetailsUrl,
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("On the waitlist")}
        ${heroTitle(`You're on the list for ${escapeHtml(d.eventTitle)}.`)}
        ${paragraph(
          `Hi ${escapeHtml(d.firstName)} &mdash; the event is full, but if a spot opens we'll email you and ping your Click dashboard. Most waitlists move; sit tight.`,
        )}
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:28px 40px 8px 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:2px dashed ${INK};">
          <tr><td style="padding:18px 0 0 0;">
            <p style="margin:0 0 4px 0;font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};">When &amp; where</p>
            <p style="margin:0;font:600 16px/1.4 ${FONT_SANS};color:${INK};">${escapeHtml(d.eventTitle)}</p>
            <p style="margin:2px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">${escapeHtml(d.eventLongDate)} · ${escapeHtml(d.eventStartTime)} · ${escapeHtml(d.eventVenue)}, ${escapeHtml(d.eventCity)}</p>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:24px 40px 8px 40px;">
        ${renderButton({ href: d.eventDetailsUrl, label: "View event details", tone: "rose" })}
      </td>
    </tr>
    ${renderCallout(
      "While you wait &mdash;",
      "browse similar events near you. Even if this one doesn't move, the next pottery / breakfast / run-club probably will.",
    )}
  `;

  const html = renderShell({
    title: subject,
    preheader: `If a spot opens for ${d.eventTitle}, you'll be first to know.`,
    headerEyebrow: "Waitlist",
    contentHtml: body,
    reasonLine: "You're getting this because you joined a waitlist on Click.",
    unsubscribeLabel: "Email preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
