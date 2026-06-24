// Brand tokens mirrored from `src/app/globals.css` so they can be inlined into
// HTML email markup. Email clients ignore CSS custom properties, so every value
// has to land as a literal hex on every <td>/<a>/<p> — these constants are the
// single source of truth used by `chrome.ts` and the per-scenario templates.

// Soft Minimal (concept 06) palette — coral accent, soft lavender + deep
// purple secondary, cream canvas, lime only as a whisper. Mirrors
// `src/app/globals.css`; email clients ignore CSS vars so every value is a
// literal hex inlined on <td>/<a>/<p> by chrome.ts + the per-scenario templates.
export const INK = "#1C1830";          // Purple-tinted near-black — headings, link colour
export const INK_DEEP = "#100B22";     // deeper variant
export const ROSE = "#E8674C";         // Coral — primary CTA / accent
export const CHAMPAGNE = "#F9F6F0";    // cream page background
export const CHAMPAGNE_DEEP = "#F1ECFB"; // pale lavender wash (alt sections)
export const PEACH = "#C8B8F8";        // Soft lavender — secondary accent / category chips
export const MAUVE = "#6B6580";        // slate — secondary text colour
export const CREAM = "#FFFFFF";        // white card surface
export const PUNCH = "#D6F24E";        // lime whisper — ticket-stub accent (rare)
export const SURFACE = "#FFFFFF";      // card surface
export const SURFACE_DEEP = "#201A3A"; // deep aubergine — dark bands / strong text
export const TEXT_BODY = "#2A2540";    // standard paragraph colour
export const LINE_SOFT = "#ECEAF0";    // section dividers
export const LINE_HARD = "#E3DFE9";    // card borders

// Font stacks. The Google Fonts <link> in `renderShell` loads Manrope (body) +
// Schibsted Grotesk (headings) for clients that respect <link>; the rest take
// the system fallback. Manrope mirrors the calm in-app body voice; Schibsted
// Grotesk is the Soft Minimal display face (replaces the old Fraunces serif).
export const FONT_SANS =
  "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
// Export name kept for compatibility; value is now the Schibsted Grotesk
// display stack (a clean grotesque, no serif) to match concept 06.
export const FONT_SERIF =
  "'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace";

// "A burst of YES" is the brand tagline; used in the header eyebrow on
// every email. Kept in tokens so a copy tweak is a one-liner.
export const BRAND_TAGLINE = "A social calendar";
export const SUPPORT_EMAIL_DEFAULT = "hello@click.local";
