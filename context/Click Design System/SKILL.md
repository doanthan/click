---
name: click-design
description: Use this skill to generate well-branded interfaces and assets for Click - the invite-only Sydney events platform - for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## What's here
- `README.md` - the design guide: product context, **content fundamentals** (the binding language rules - "click with" never "match", desire-not-deficit, opportunity-never-loss), **visual foundations**, and **iconography**.
- `styles.css` + `tokens/` - the global stylesheet and design tokens (deep-purple primary, lavender lift, cream ground, status badges, Poppins + system type, spacing/radius/shadow).
- `assets/` - logo wordmark + click mark (cream & purple).
- `components/` - reusable React primitives (Button, Tag, Avatar, EventCard, PeopleCard, AttendeeRow, MutualCard, IntentLine, Input, Select, Toggle).
- `templates/` - full interactive starting points: `consumer-app/` (mobile).
- `click-app-v2/` - the full interactive product mockup (`Click App Screens v2.html`).
- `foundations/` - visual specimen cards.

## The two rules to never break
1. **Language is binding.** Never "match" (it's a *mutual click*); never "click on someone" (always "click *with*"); never use "click" as a UI verb (use "tap"/"select"); never deficit framing (lonely/struggling) or loss framing (expire/last chance). Capital **Click** = the platform, lowercase **click** = the feeling.
2. **Activity first, person second; intent-neutral.** Dating is never the default. Lead with the event, not meeting people.

When in doubt, read `README.md` and explore the source specs at https://github.com/cndykm/click-tech.
