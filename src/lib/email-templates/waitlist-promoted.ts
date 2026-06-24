// Waitlist promotion — currently wired at `event-repository.ts:4102`.
// Fires when a confirmed attendee cancels and the next waitlister is offered
// the seat for 15 minutes. Subject + text MUST match what `sendWorkflowEmail`
// already produces so swapping is a one-liner.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderShell, renderCallout } from "./chrome";
import { FONT_SANS, INK, MAUVE, PUNCH, ROSE } from "./tokens";

export type WaitlistPromotedData = {
  firstName: string;
  eventTitle: string;
  /** Already-formatted local time string (the existing call site formats with `toLocaleString("en-AU", { timeZone: "Australia/Sydney" })`). */
  offeredUntil: string;
  eventDetailsUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildWaitlistPromotedEmail(d: WaitlistPromotedData) {
  // ⚠ Must equal `event-repository.ts:4104` exactly.
  const subject = `A spot opened for ${d.eventTitle}`;

  // ⚠ Must equal `event-repository.ts:4105-4112` exactly.
  const text = [
    `Hi ${d.firstName},`,
    `A spot opened for ${d.eventTitle}.`,
    `Your offer is held until ${d.offeredUntil}.`,
    d.eventDetailsUrl,
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("A seat opened")}
        ${heroTitle(`Your turn for <span style="color:${ROSE};">${escapeHtml(d.eventTitle)}</span>.`)}
        ${paragraph(
          `Hi ${escapeHtml(d.firstName)} &mdash; the next person on the waitlist is you. The seat is yours if you confirm before the timer runs out.`,
        )}
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td bgcolor="${PUNCH}" style="background:${PUNCH};padding:10px 14px;">
              <span style="font:600 11px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${INK};">Held until ${escapeHtml(d.offeredUntil)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:24px 40px 8px 40px;">
        ${renderButton({ href: d.eventDetailsUrl, label: "Claim the seat", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          Don't want it after all? Just ignore this &mdash; the seat will offer to the next person automatically.
        </p>
      </td>
    </tr>
    ${renderCallout(
      "Heads up &mdash;",
      "after the timer runs out we'll offer it to whoever's next. We won't bug you about it again unless you want it back on the waitlist.",
    )}
  `;

  const html = renderShell({
    title: subject,
    preheader: `Held until ${d.offeredUntil}. Confirm to lock it in.`,
    headerEyebrow: "Spot opened",
    contentHtml: body,
    reasonLine: "You're getting this because you were on the waitlist for this event.",
    unsubscribeLabel: "Email preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
