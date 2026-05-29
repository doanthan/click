// Brand tokens mirrored from `src/app/globals.css` so they can be inlined into
// HTML email markup. Email clients ignore CSS custom properties, so every value
// has to land as a literal hex on every <td>/<a>/<p> — these constants are the
// single source of truth used by `chrome.ts` and the per-scenario templates.

export const INK = "#340068";          // Indigo Ink — brand anchor, headings, link colour
export const INK_DEEP = "#240048";     // deeper variant
export const ROSE = "#FF6978";         // Bubblegum Pink — primary CTA
export const CHAMPAGNE = "#FFFCF9";    // page background
export const CHAMPAGNE_DEEP = "#f5edf4";
export const PEACH = "#B1EDE8";        // Icy Aqua — secondary accent / category chips
export const MAUVE = "#6D435A";        // secondary text colour
export const CREAM = "#fff6f7";
export const PUNCH = "#ffd84d";        // ticket-stub accent
export const SURFACE = "#FFFFFF";      // card surface
export const SURFACE_DEEP = "#1F1530"; // body text on light backgrounds
export const TEXT_BODY = "#2A1F36";    // standard paragraph colour
export const LINE_SOFT = "#F1E9F2";    // section dividers
export const LINE_HARD = "#EDE3F0";    // card borders

// Font stacks. The Google Fonts <link> in `renderShell` loads Manrope + Fraunces
// for clients that respect <link>; the rest take the system fallback.
// Manrope was picked over Inter to match the in-app body font (CLAUDE.md / globals).
export const FONT_SANS =
  "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
export const FONT_SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
export const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace";

// "A burst of YES" is the brand tagline; used in the header eyebrow on
// every email. Kept in tokens so a copy tweak is a one-liner.
export const BRAND_TAGLINE = "A social calendar";
export const SUPPORT_EMAIL_DEFAULT = "hello@click.local";
