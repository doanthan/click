// "Thanks for applying" email - fires after a merchant finishes the 3-step
// signup wizard at `/merchant/signup`. The application is now `pending` and
// awaiting an admin review at `/api/admin/merchants/[merchantId]/verification`.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderNoteList, renderShell, renderCallout } from "./chrome";
import { FONT_SANS, INK, MAUVE } from "./tokens";

export type MerchantSignupReceivedData = {
  merchantFirstName: string;
  businessName: string;
  dashboardUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildMerchantSignupReceivedEmail(d: MerchantSignupReceivedData) {
  const subject = `${d.businessName} - your Click application is in review`;

  const text = [
    `Hi ${d.merchantFirstName},`,
    `Thanks for submitting ${d.businessName} to host events on Click. A moderator will review your application within one business day.`,
    "What happens next: once we approve you we'll email you, your dashboard unlocks event creation, and you can publish your first event.",
    "While you wait: have a clear cover image, a short specific event description ready, and the address + price + capacity that match what'll actually happen on the day.",
    `Your dashboard: ${d.dashboardUrl}`,
    `Questions? Just reply - ${d.supportEmail}`,
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Application received")}
        ${heroTitle(`Thanks, ${escapeHtml(d.merchantFirstName)} - we've got it.`)}
        ${paragraph(
          `<strong>${escapeHtml(d.businessName)}</strong> is in review. A moderator will take a look within one business day. We'll email you the moment it's approved.`,
        )}
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:28px 40px 8px 40px;">
        ${renderButton({ href: d.dashboardUrl, label: "Open your dashboard", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          Your dashboard is open already - drafting an event in advance is the fastest way to publish on approval day.
        </p>
      </td>
    </tr>
    ${renderNoteList("While you wait", [
      "A real image of the activity, venue, or food - not stock art. This carries the card more than the title does.",
      "A short, specific description - what people will actually do, who it's good for, and the vibe at the door.",
      "The address, capacity, and price that match reality on the day. Discover is unforgiving of mismatch.",
      "ABN and contact details we can reach you on - verification stalls when the email bounces.",
    ])}
    ${renderCallout(
      "Heads up -",
      "applications submitted Friday night usually land their review on Monday. If you're hosting something sooner, reply to this email and we'll fast-track it.",
    )}
  `;
  void INK;

  const html = renderShell({
    title: subject,
    preheader: `Thanks for submitting ${d.businessName}. We'll have it reviewed within one business day.`,
    headerEyebrow: "Application received",
    forHosts: true,
    contentHtml: body,
    reasonLine: "You're getting this because you applied to host events on Click.",
    unsubscribeLabel: "Notification preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
