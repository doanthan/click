---
name: click-design
description: Click's canonical design system - deep purple (#3B2F81) primary on warm cream (#F9F6F0), lavender (#C8B8F8) soft accents, Poppins display + system body, radius-12 buttons, status colours on badges only, and binding language rules (mutual click never match, click WITH never on, hyphens never em-dashes). Use whenever designing, restyling, building, or reviewing ANY Click UI - pages, components, emails, mockups, copy on UI surfaces.
user-invocable: true
---

# Click Design System (repo wrapper)

The design system lives in **`context/Click Design System/`** (a claude.ai/design export - re-exports replace that folder wholesale, so this wrapper stays thin and points there; never edit the bundle by hand).

**Read first, always:** `context/Click Design System/README.md` - the canonical mirror: governance, content/language fundamentals, visual foundations, every component contract (Button, Tag, Badge, EventCard, PeopleCard, MutualCard, nav, footer), key-screen specs, privacy rails.

Then as needed:
- `tokens/*.css` - colour/type/spacing tokens (already mirrored into `src/app/globals.css` - see wiring below)
- `components/**/*.jsx` + `components/core/components.css` - reference implementations (mockup React, not Next-ready; port the CSS contracts, don't import)
- `docs/Click_Design_Prompt_*.md` - per-screen build prompts (Dashboard, Discovery, CategoryIcons, Coordination modals)
- `uploads/CLICK_LANGUAGE.md` - the binding copy rules
- `screenshots/` - target renders of every key surface
- `assets/` - wordmark/c-mark/spark SVGs (purple + cream variants)
- `Click Brand Package.html` / `Click App Screens v2.html` - open in a browser for the full visual spec

## How this repo is wired to it

- Tokens live in `src/app/globals.css`. **Token NAMES are stable; only VALUES track the DS** - the accent role (`--rose`, historic name) IS deep purple #3B2F81; `--coral` is status-only. Reach for `var(--token)`, never hex.
- Display font = Poppins via `--font-click-display` (layout.tsx); body = system stack via `--font-click-body`. Never set paragraphs in Poppins.
- `.eyebrow` = the quiet slate micro-caps label voice.

## The two rules to never break

1. **Language is binding.** Never "match" (it's a *mutual click*); always "click *with*", never "click on"; never "click" as a UI verb (tap/select); no deficit framing (lonely/struggling), no loss framing (expire/last chance); capital **Click** = platform, lowercase **click** = the feeling. Hyphens ` - `, never em-dashes.
2. **Deep Purple is the ONLY primary-action/selected colour** - flat, never a gradient or glow. Status colours (coral/amber/sage/teal) live on badges ONLY. Buttons are radius-12, never pills; tags/avatars are the pills.
