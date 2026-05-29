// Event cancelled (to attendee) — currently wired at `event-repository.ts:4242`.
// Subject + text MUST match what `sendWorkflowEmail` already produces.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderShell, renderCallout } from "./chrome";
import { FONT_SANS, INK, MAUVE, ROSE } from "./tokens";

export type EventCancelledData = {
  firstName: string;
  eventTitle: string;
  eventHostName?: string;
  discoverUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildEventCancelledEmail(d: EventCancelledData) {
  // ⚠ Must equal `event-repository.ts:4244` exactly.
  const subject = `${d.eventTitle} has been cancelled`;

  // ⚠ Must equal `event-repository.ts:4245-4249` exactly.
  const text = [
    `Hi ${d.firstName},`,
    `${d.eventTitle} has been cancelled by the host.`,
    "Any payment/refund handling will follow the merchant policy for this event.",
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Plans changed")}
        ${heroTitle(`<em style="color:${ROSE};font-style:italic;">${escapeHtml(d.eventTitle)}</em> isn't happening.`)}
        ${paragraph(
          `Hi ${escapeHtml(d.firstName)} &mdash; the host has cancelled this event. Any payment/refund handling will follow the merchant policy for this event.${d.eventHostName ? ` Questions reach <strong>${escapeHtml(d.eventHostName)}</strong> fastest if you reply to this email.` : ""}`,
        )}
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:32px 40px 0 40px;">
        <div style="border-top:2px dashed ${INK};height:0;line-height:0;font-size:0;">&nbsp;</div>
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:24px 40px 8px 40px;">
        ${renderButton({ href: d.discoverUrl, label: "Find something else", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          Sorry for the shuffle. The next pottery night / morning run / dinner table is probably already in discover.
        </p>
      </td>
    </tr>
    ${renderCallout(
      "Refund window &mdash;",
      "if you paid for this event, refunds for cancelled events are automatic and usually land in 5–10 business days. We'll email when yours processes.",
    )}
  `;

  const html = renderShell({
    title: subject,
    preheader: `The host has cancelled ${d.eventTitle}. Any refunds follow merchant policy.`,
    headerEyebrow: "Event cancelled",
    contentHtml: body,
    reasonLine: "You're getting this because you had an RSVP for this event on Click.",
    unsubscribeLabel: "Email preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
