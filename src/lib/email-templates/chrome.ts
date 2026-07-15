// Shared email "chrome" - outer shell + reusable building blocks (header,
// footer, button, event-card, paragraph). Every per-scenario template builds
// its body rows and hands them to `renderShell`, which wraps them in the
// 600px outer table, head metadata, Google Fonts link, mobile @media block,
// brand header, and footer.
//
// Email-safe rules baked in:
//   - 600px outer <table role="presentation">, every cell uses inline styles
//     (Gmail mobile drops classes inconsistently - inline is source of truth)
//   - No flex / no grid / no SVG / no JS / no <form>
//   - Buttons are <a> inside `bgcolor` <td> - never CSS-only background
//   - Hidden preheader as first body child, padded with zero-width chars
//   - color-scheme: light so iOS Mail doesn't auto-invert
//
// Ported from the static drafts at `emails/account-welcome.html`,
// `emails/rsvp-attendee.html`, etc., body on the system stack to match the
// in-app body font. Display headings use Poppins (the Click DS face,
// no serif) per the Soft Minimal concept - bold and tight, never italic.

import {
  CHAMPAGNE,
  CREAM,
  FONT_SANS,
  FONT_SERIF,
  INK,
  LINE_HARD,
  LINE_SOFT,
  MAUVE,
  PEACH,
  ROSE,
  SURFACE,
  SURFACE_DEEP,
  TEXT_BODY,
  BRAND_TAGLINE,
} from "./tokens";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Hidden preheader: padded with zero-width joiners + non-breaking spaces so
// Gmail's preview-text scraper doesn't pull in visible body text after the
// real preheader runs out.
function preheaderHtml(text: string): string {
  const padding = "&nbsp;&zwnj;".repeat(60);
  return `<div style="display:none;font-size:1px;color:${CHAMPAGNE};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(
    text,
  )} ${padding}</div>`;
}

type RenderHeaderOptions = {
  /** When true, renders "Click for hosts" sub-brand - used on merchant emails. */
  forHosts?: boolean;
  /** Tiny eyebrow text on the right side ("Welcome", "RSVP confirmed", etc.) */
  eyebrow: string;
};

function renderHeader({ forHosts = false, eyebrow }: RenderHeaderOptions): string {
  const subBrand = forHosts
    ? `<span style="font:600 11px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};margin-left:6px;vertical-align:3px;">for hosts</span>`
    : "";

  return `
    <tr>
      <td class="px-gutter" style="padding:28px 40px 20px 40px;border-bottom:1px solid ${LINE_SOFT};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="font:700 22px/1 ${FONT_SERIF};color:${INK};letter-spacing:-0.02em;">
              Click${subBrand}
            </td>
            <td align="right" style="font:500 11px/1 ${FONT_SANS};letter-spacing:0.14em;text-transform:uppercase;color:${MAUVE};">
              ${escapeHtml(eyebrow)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

type RenderFooterOptions = {
  reasonLine: string; // "You're getting this because you …"
  unsubscribeLabel?: string; // e.g. "Email preferences" or "Notification preferences"
  unsubscribeUrl: string;
  supportEmail: string;
};

function renderFooter({
  reasonLine,
  unsubscribeLabel = "Email preferences",
  unsubscribeUrl,
  supportEmail,
}: RenderFooterOptions): string {
  return `
    <tr>
      <td class="px-gutter" style="padding:36px 40px 28px 40px;border-top:1px solid ${LINE_SOFT};">
        <p style="margin:0 0 6px 0;font:400 12px/1.6 ${FONT_SANS};color:${MAUVE};">
          ${escapeHtml(reasonLine)}
        </p>
        <p style="margin:0;font:400 12px/1.6 ${FONT_SANS};color:${MAUVE};">
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:${MAUVE};text-decoration:underline;">${escapeHtml(unsubscribeLabel)}</a>
          &middot;
          <a href="mailto:${escapeHtml(supportEmail)}" style="color:${MAUVE};text-decoration:underline;">${escapeHtml(supportEmail)}</a>
        </p>
      </td>
    </tr>
  `;
}

// ─── Public helpers used inside template bodies ───────────────────────────

export type ParagraphOpts = {
  color?: string;
  size?: number;
  weight?: 400 | 500 | 600;
  marginTop?: number;
  marginBottom?: number;
};

/**
 * Inline-styled <p> so each template doesn't have to repeat the font stack.
 * `text` is treated as already-HTML - callers should escape user content
 * before composing (so `<strong>`/`<em>` interpolation still works).
 */
export function paragraph(text: string, opts: ParagraphOpts = {}): string {
  const {
    color = TEXT_BODY,
    size = 16,
    weight = 400,
    marginTop = 0,
    marginBottom = 0,
  } = opts;
  return `<p style="margin:${marginTop}px 0 ${marginBottom}px 0;font:${weight} ${size}px/1.55 ${FONT_SANS};color:${color};">${text}</p>`;
}

/**
 * Tiny all-caps eyebrow label above hero titles.
 */
export function eyebrow(text: string): string {
  return `<p style="margin:0 0 12px 0;font:600 11px/1 ${FONT_SANS};letter-spacing:0.18em;text-transform:uppercase;color:${MAUVE};">${escapeHtml(text)}</p>`;
}

/**
 * Hero heading - Poppins, bold + tight, ink. Pass `text` as
 * already-HTML (interpolation safe) so callers can wrap a word in a coloured
 * `<span>` for coral/purple emphasis without losing escaping on surrounding
 * fragments. (No serif now, so emphasis is colour, not synthetic italic.)
 */
export function heroTitle(html: string): string {
  return `<h1 class="hero-title" style="margin:0 0 16px 0;font:700 34px/1.1 ${FONT_SERIF};color:${INK};letter-spacing:-0.02em;">${html}</h1>`;
}

export type RenderButtonOpts = {
  href: string;
  label: string;
  tone?: "rose" | "ink";
};

/**
 * Bullet-proof email button: `bgcolor` attribute on a <td> wrapping a padded
 * <a>. The `bgcolor` is what Outlook 2007–2019 actually paints; the inline
 * `background` is for everyone else.
 */
export function renderButton({ href, label, tone = "rose" }: RenderButtonOpts): string {
  const bg = tone === "ink" ? INK : ROSE;
  const fg = CREAM;
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td bgcolor="${bg}" style="background:${bg};">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font:600 13px/1 ${FONT_SANS};letter-spacing:0.14em;text-transform:uppercase;color:${fg};text-decoration:none;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>
  `;
}

export type RenderEventCardOpts = {
  title: string;
  when: string;
  where: string;
  hostName?: string;
  category?: string;
  priceLabel?: string;
  capacityLabel?: string;
  statusLabel?: string;
};

/**
 * Reusable ticket-stub card with the dashed indigo top border - matches the
 * brand vocabulary used in `emails/rsvp-attendee.html`. Mid-card border + meta
 * grid stack on mobile via the `.stack` class set in `renderShell`.
 *
 * Returns one `<tr>` so it slots straight into a template body.
 */
export function renderEventCard(opts: RenderEventCardOpts): string {
  const {
    title,
    when,
    where,
    hostName,
    category,
    priceLabel,
    capacityLabel,
    statusLabel,
  } = opts;

  const chips: string[] = [];
  if (statusLabel) {
    chips.push(
      `<td style="border:1.5px solid ${INK};padding:6px 12px;"><span style="font:600 10px/1 ${FONT_SANS};letter-spacing:0.18em;text-transform:uppercase;color:${INK};">${escapeHtml(statusLabel)}</span></td>`,
    );
  }
  if (category) {
    chips.push(
      `<td bgcolor="${PEACH}" style="background:${PEACH};padding:6px 12px;"><span style="font:600 10px/1 ${FONT_SANS};letter-spacing:0.18em;text-transform:uppercase;color:${INK};">${escapeHtml(category)}</span></td>`,
    );
  }
  const chipsRow = chips.length
    ? `<tr><td style="padding:24px 24px 4px 24px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${chips
        .map((c, i) => (i === 0 ? c : `<td style="width:8px;">&nbsp;</td>${c}`))
        .join("")}</tr></table></td></tr>`
    : "";

  // Build the meta grid bottom-up so we only emit cells that have content.
  const cells: { label: string; valueHtml: string }[] = [];
  cells.push({ label: "When", valueHtml: escapeHtml(when) });
  cells.push({ label: "Where", valueHtml: escapeHtml(where) });
  if (priceLabel) cells.push({ label: "Price", valueHtml: escapeHtml(priceLabel) });
  if (capacityLabel) cells.push({ label: "Capacity", valueHtml: escapeHtml(capacityLabel) });

  const renderCell = (cell: { label: string; valueHtml: string }, padRight: boolean) =>
    `<td class="stack meta-cell" width="50%" valign="top" style="padding-${padRight ? "right" : "left"}:0;padding-${padRight ? "right" : "left"}:${padRight ? 16 : 0}px;padding-bottom:18px;">
      <p style="margin:0 0 4px 0;font:600 10px/1 ${FONT_SANS};letter-spacing:0.16em;text-transform:uppercase;color:${MAUVE};">${cell.label}</p>
      <p style="margin:0;font:600 15px/1.4 ${FONT_SANS};color:${SURFACE_DEEP};">${cell.valueHtml}</p>
    </td>`;

  // Pair cells into rows of two
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const left = renderCell(cells[i], true);
    const right = cells[i + 1] ? renderCell(cells[i + 1], false) : `<td width="50%">&nbsp;</td>`;
    rows.push(`<tr>${left}${right}</tr>`);
  }

  return `
    <tr>
      <td class="px-gutter" style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CHAMPAGNE};border:1px solid ${LINE_HARD};border-top:2px dashed ${INK};">
          ${chipsRow}
          <tr>
            <td style="padding:${chipsRow ? "16px" : "24px"} 24px 0 24px;">
              <h2 style="margin:0;font:600 22px/1.2 ${FONT_SERIF};color:${SURFACE_DEEP};letter-spacing:-0.01em;">${escapeHtml(title)}</h2>
              ${hostName ? `<p style="margin:6px 0 0 0;font:400 14px/1.5 ${FONT_SANS};color:${MAUVE};">Hosted by ${escapeHtml(hostName)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 4px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${rows.join("")}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * "P.S." or "Heads up" callout, Poppins, ink. Returns one <tr>.
 */
export function renderCallout(leadHtml: string, bodyText: string): string {
  return `
    <tr>
      <td class="px-gutter" style="padding:28px 40px 0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CHAMPAGNE};border-left:3px solid ${PEACH};">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0;font:400 14px/1.55 ${FONT_SANS};color:${TEXT_BODY};">
                <span style="font:700 14px/1 ${FONT_SERIF};color:${INK};">${leadHtml}</span>
                ${escapeHtml(bodyText)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Bulleted list of "good to know" / "what we look at" notes.
 * Each item is plain text; bullets are rendered as middot dots so they survive
 * Outlook's list-style stripping.
 */
export function renderNoteList(eyebrowText: string, items: string[]): string {
  const itemsHtml = items
    .map(
      (item, idx) =>
        `<p style="margin:0 0 ${idx === items.length - 1 ? 0 : 10}px 0;font:400 15px/1.6 ${FONT_SANS};color:${TEXT_BODY};">&middot; ${escapeHtml(item)}</p>`,
    )
    .join("");

  return `
    <tr>
      <td class="px-gutter" style="padding:32px 40px 0 40px;">
        <p style="margin:0 0 14px 0;font:600 11px/1 ${FONT_SANS};letter-spacing:0.18em;text-transform:uppercase;color:${MAUVE};">${escapeHtml(eyebrowText)}</p>
        ${itemsHtml}
      </td>
    </tr>
  `;
}

// ─── The outer shell ──────────────────────────────────────────────────────

export type RenderShellOptions = {
  title: string;            // <title> + the email subject (kept in sync)
  preheader: string;        // hidden preview text (Gmail/iOS inbox preview)
  headerEyebrow: string;    // tiny right-side label in the header bar
  forHosts?: boolean;       // toggles "Click for hosts" sub-brand
  contentHtml: string;      // <tr>...</tr> rows produced by the template body
  reasonLine: string;       // "You're getting this because …"
  unsubscribeLabel?: string;
  unsubscribeUrl: string;
  supportEmail: string;
};

export function renderShell(opts: RenderShellOptions): string {
  const {
    title,
    preheader,
    headerEyebrow,
    forHosts = false,
    contentHtml,
    reasonLine,
    unsubscribeLabel,
    unsubscribeUrl,
    supportEmail,
  } = opts;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      body { margin:0; padding:0; width:100% !important; background:${CHAMPAGNE}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
      a { color:${INK}; }
      @media only screen and (max-width: 600px) {
        .container { width:100% !important; }
        .px-gutter { padding-left:24px !important; padding-right:24px !important; }
        .hero-title { font-size:28px !important; line-height:1.15 !important; }
        .stack { display:block !important; width:100% !important; padding-right:0 !important; padding-bottom:16px !important; }
        .meta-cell { padding-bottom:14px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${CHAMPAGNE};">
    ${preheaderHtml(preheader)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CHAMPAGNE};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:${SURFACE};border:1px solid ${LINE_HARD};">
            ${renderHeader({ forHosts, eyebrow: headerEyebrow })}
            ${contentHtml}
            ${renderFooter({ reasonLine, unsubscribeLabel, unsubscribeUrl, supportEmail })}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Re-export tokens commonly used inline by templates so they only need a
// single import line.
export { INK, ROSE, MAUVE, PEACH, FONT_SANS, FONT_SERIF, BRAND_TAGLINE };
