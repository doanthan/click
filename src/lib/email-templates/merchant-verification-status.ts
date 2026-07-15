// Merchant verification status change - currently wired at
// `event-repository.ts:1850`. Subject and the lead body line MUST match what
// `sendWorkflowEmail` already produces for swap-in compatibility. The HTML
// adds branded chrome, status-specific colour, and a next-step CTA.

import { escapeHtml, eyebrow, heroTitle, paragraph, renderButton, renderShell, renderCallout } from "./chrome";
import { CREAM, FONT_SANS, INK, MAUVE, PEACH, ROSE } from "./tokens";

export type MerchantVerificationStatus = "approved" | "rejected" | "suspended";

export type MerchantVerificationStatusData = {
  merchantFirstName: string;
  businessName: string;
  status: MerchantVerificationStatus;
  dashboardUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

export function buildMerchantVerificationStatusEmail(d: MerchantVerificationStatusData) {
  // ⚠ Must equal `event-repository.ts:1852-1857` exactly.
  const subject =
    d.status === "approved"
      ? `${d.businessName} is approved on Click`
      : d.status === "suspended"
        ? `${d.businessName} has been suspended on Click`
        : `${d.businessName} merchant status: ${d.status}`;

  // ⚠ Must equal `event-repository.ts:1858-1866` exactly.
  const leadLine =
    d.status === "approved"
      ? `${d.businessName} is approved to create and manage events on Click.`
      : d.status === "suspended"
        ? `${d.businessName} has been suspended. Your events are hidden from Discover until an admin reinstates the account.`
        : `${d.businessName} is now marked ${d.status}.`;

  const text = [`Hi ${d.merchantFirstName},`, leadLine, d.dashboardUrl].join("\n\n");

  const statusChipBg = d.status === "approved" ? PEACH : d.status === "suspended" ? ROSE : INK;
  const statusChipFg = d.status === "approved" ? INK : CREAM;
  const statusLabel = d.status === "approved" ? "Approved" : d.status === "suspended" ? "Suspended" : "Needs review";

  const heroByStatus =
    d.status === "approved"
      ? `<span style="color:${ROSE};">Approved.</span> Welcome aboard, ${escapeHtml(d.merchantFirstName)}.`
      : d.status === "suspended"
        ? `We've paused ${escapeHtml(d.businessName)}.`
        : `${escapeHtml(d.businessName)} needs another look.`;

  const ctaLabel =
    d.status === "approved"
      ? "Create your first event"
      : d.status === "suspended"
        ? "Open your dashboard"
        : "Update your application";

  const noteByStatus =
    d.status === "approved"
      ? "First event tip: a real photo of last week's session, a sentence on who it's good for, and an accurate price. The card carries itself from there."
      : d.status === "suspended"
        ? "Suspensions usually trace to a single thing - a card we couldn't read, a refund policy mismatch, an event that didn't run. Reply to this and we'll walk through it."
        : "Common reasons: an ABN that doesn't match the business name, a contact email we can't reach you on, or documents we couldn't read. Reply and we'll point you at the exact fix.";

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Verification update")}
        ${heroTitle(heroByStatus)}
        ${paragraph(leadLine)}
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td bgcolor="${statusChipBg}" style="background:${statusChipBg};padding:8px 14px;">
              <span style="font:600 11px/1 ${FONT_SANS};letter-spacing:0.18em;text-transform:uppercase;color:${statusChipFg};">${escapeHtml(statusLabel)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:24px 40px 8px 40px;">
        ${renderButton({ href: d.dashboardUrl, label: ctaLabel, tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          ${escapeHtml(noteByStatus)}
        </p>
      </td>
    </tr>
    ${
      d.status === "approved"
        ? renderCallout(
            "One more thing -",
            "set your Stripe Connect payouts in the dashboard before you publish a paid event. Free events can go live anytime.",
          )
        : ""
    }
  `;

  const html = renderShell({
    title: subject,
    preheader:
      d.status === "approved"
        ? `${d.businessName} is approved - your dashboard is unlocked.`
        : d.status === "suspended"
          ? `${d.businessName} has been suspended. Your events are hidden until an admin reinstates the account.`
          : `${d.businessName} needs another review. Open your dashboard for the details.`,
    headerEyebrow: "Verification",
    forHosts: true,
    contentHtml: body,
    reasonLine: "You're getting this because you applied to host events on Click.",
    unsubscribeLabel: "Notification preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
