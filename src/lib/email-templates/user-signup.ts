// Welcome email — sent after a user finishes credential/Google signup.
// Voice + structure ported from the static draft at `emails/account-welcome.html`,
// swapping Inter → Manrope and rebuilt out of `chrome.ts` helpers.

import {
  escapeHtml,
  eyebrow,
  heroTitle,
  paragraph,
  renderButton,
  renderShell,
} from "./chrome";
import { FONT_SANS, FONT_SERIF, INK, MAUVE, ROSE, SURFACE_DEEP, TEXT_BODY } from "./tokens";

export type UserSignupData = {
  firstName: string;
  quizUrl: string;
  discoverUrl: string;
  supportEmail: string;
  unsubscribeUrl: string;
};

function step(num: number, headline: string, body: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
      <tr>
        <td valign="top" width="36" style="font:500 22px/1 ${FONT_SERIF};color:${INK};padding-top:2px;">${num}.</td>
        <td valign="top">
          <p style="margin:0 0 4px 0;font:600 16px/1.35 ${FONT_SANS};color:${SURFACE_DEEP};">${escapeHtml(headline)}</p>
          <p style="margin:0;font:400 15px/1.55 ${FONT_SANS};color:${TEXT_BODY};">${escapeHtml(body)}</p>
        </td>
      </tr>
    </table>
  `;
}

export function buildUserSignupEmail(d: UserSignupData) {
  const subject = `You're in, ${d.firstName} — welcome to Click`;

  const text = [
    `Hi ${d.firstName},`,
    "Click helps you find people through things worth leaving the house for — pottery nights, coastal walks, CrossFit classes, low-pressure dinners, the small Saturday things that turn into Sunday plans.",
    "Three small things to start:",
    "1. Tell us what you're up for. Four questions, ninety seconds — it teaches Click whether you want low-key weekends, a CrossFit crew, friends in the Inner West, or all of the above.",
    "2. Browse what's actually near you. Pottery in Marrickville, run clubs in Bondi, board game nights in Newtown.",
    "3. Click on people once you've got an event in common. No swiping — you'll meet people because you're both showing up Thursday, not because of a photo.",
    `Take the 90-second quiz: ${d.quizUrl}`,
    `Or just browse events near you first: ${d.discoverUrl}`,
    "P.S. A real human reads every reply to this email. If something's confusing, broken, or you can't find what you're looking for, just hit reply.",
  ].join("\n\n");

  const body = `
    <tr>
      <td class="px-gutter" style="padding:40px 40px 8px 40px;">
        ${eyebrow("Welcome")}
        ${heroTitle(`You're in, ${escapeHtml(d.firstName)}.`)}
        ${paragraph(
          "Click helps you find people through things worth leaving the house for &mdash; pottery nights, coastal walks, CrossFit classes, low-pressure dinners, the small Saturday things that turn into Sunday plans.",
          { size: 17 },
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
        <p style="margin:0 0 20px 0;font:600 11px/1 ${FONT_SANS};letter-spacing:0.18em;text-transform:uppercase;color:${MAUVE};">Three small things to start</p>
        ${step(1, "Tell us what you're up for.", "Four questions, ninety seconds. It teaches Click whether you want low-key weekends, a CrossFit crew, friends in the Inner West, or all of the above.")}
        ${step(2, "Browse what's actually near you.", "Pottery in Marrickville, run clubs in Bondi, board game nights in Newtown. Filter by suburb, date, and the kind of energy you're after.")}
        ${step(3, "Click on people once you've got an event in common.", "No swiping. You'll meet people because you're both showing up Thursday, not because of a photo.")}
      </td>
    </tr>
    <tr>
      <td class="px-gutter" align="left" style="padding:24px 40px 8px 40px;">
        ${renderButton({ href: d.quizUrl, label: "Take the 90-second quiz", tone: "rose" })}
        <p style="margin:14px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">
          Or just <a href="${escapeHtml(d.discoverUrl)}" style="color:${INK};text-decoration:underline;">browse events near you</a> first &mdash; the quiz can wait.
        </p>
      </td>
    </tr>
    <tr>
      <td class="px-gutter" style="padding:32px 40px 40px 40px;">
        <p style="margin:0;font:400 14px/1.6 ${FONT_SANS};color:${MAUVE};">
          <span style="font:italic 400 14px/1 ${FONT_SERIF};color:${INK};">P.S.</span> A real human reads every reply to this email. If something's confusing, broken, or you can't find what you're looking for, just hit reply.
        </p>
      </td>
    </tr>
  `;
  // ROSE intentionally re-imported for future "tone: rose" callouts.
  void ROSE;

  const html = renderShell({
    title: subject,
    preheader: "Click helps you find people through things worth leaving the house for. Here's how to start.",
    headerEyebrow: "Welcome",
    contentHtml: body,
    reasonLine: "You're getting this because you just created a Click account.",
    unsubscribeLabel: "Email preferences",
    unsubscribeUrl: d.unsubscribeUrl,
    supportEmail: d.supportEmail,
  });

  return { subject, html, text };
}
