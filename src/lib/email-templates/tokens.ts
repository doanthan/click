// Brand tokens mirrored from `src/app/globals.css` so they can be inlined into
// HTML email markup. Email clients ignore CSS custom properties, so every value
// has to land as a literal hex on every <td>/<a>/<p> - these constants are the
// single source of truth used by `chrome.ts` and the per-scenario templates.

// Click DS palette (canon: context/Click Design System) - Deep Purple is THE
// accent/CTA colour, cream canvas, lavender soft lift, statuses on badges
// only. Mirrors `src/app/globals.css`; email clients ignore CSS vars so every
// value is a literal hex inlined on <td>/<a>/<p> by chrome.ts + the
// per-scenario templates. Historic constant NAMES kept (ROSE = the accent
// role) so templates re-skin by value, same as the app tokens.
export const INK = "#1C1830";          // Purple-tinted near-black - headings, link colour
export const INK_DEEP = "#100B22";     // deeper variant
export const ROSE = "#3B2F81";         // Deep Purple - primary CTA / accent
export const CHAMPAGNE = "#F9F6F0";    // cream page background
export const CHAMPAGNE_DEEP = "#F0ECF4"; // lavender wash (alt sections)
export const PEACH = "#C8B8F8";        // Soft lavender - secondary accent / category chips
export const MAUVE = "#6B6580";        // slate - secondary text colour
export const CREAM = "#FFFFFF";        // white card surface
export const PUNCH = "#C8B8F8";        // folds into lavender (lime is retired in the DS)
export const SURFACE = "#FFFFFF";      // card surface
export const SURFACE_DEEP = "#201A3A"; // deep aubergine - dark bands / strong text
export const TEXT_BODY = "#2A2540";    // standard paragraph colour
export const LINE_SOFT = "#ECEAF0";    // section dividers
export const LINE_HARD = "#E3DFE9";    // card borders

// Font stacks. The Google Fonts <link> in `renderShell` loads Poppins
// (headings) for clients that respect <link>; the rest take the system
// fallback. Body is the system stack per the DS (Manrope retired).
export const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// Export name kept for compatibility; value is now the Poppins display
// stack (the Click DS face).
export const FONT_SERIF =
  "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace";

// "A burst of YES" is the brand tagline; used in the header eyebrow on
// every email. Kept in tokens so a copy tweak is a one-liner.
export const BRAND_TAGLINE = "A social calendar";
export const SUPPORT_EMAIL_DEFAULT = "hello@letsclick.app";
