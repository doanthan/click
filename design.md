# Click Design Direction: Event-First Social Calendar

## Purpose

Click should feel like a real-world social discovery calendar first, with AI acting as a helpful concierge. The product should move away from an "AI app" look and toward a warm, practical, event-led marketplace where common people find ways to meet, join activities, and form groups around shared interests.

This direction uses Paint It Easy's calendar page as a structural reference: clear filters, dense event cards, availability states, simple booking actions, and a calendar-first browsing experience.

References:

- Paint It Easy calendar: https://paintiteasy.ch/en/calendar/
- Frontend design skill: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md

## Design Thesis

Click should feel like a creative civic noticeboard crossed with a modern event marketplace.

The memorable idea: users land on Click and immediately feel there are real things happening nearby with real people they could meet. The AI conversation is not the brand gimmick; it is the guide that turns a human sentence like "I want to make new friends around Newtown" into specific events, group cards, and people-to-click suggestions.

## Mobile-First (Foundational Principle)

**~80% of Click's users are on a phone.** Mobile is the *default* design target, not a responsive afterthought. Design every screen at 375px width first, then scale *up* to tablet and desktop — never the reverse. A feature is not "done" until it has been checked on a small screen.

Non-negotiable rules — apply to **every** screen, including merchant and admin:

- **Single column by default.** Stack content vertically on mobile; introduce multi-column grids only at `sm:`/`md:`/`lg:` and up. Default Tailwind classes (no breakpoint prefix) describe the *mobile* layout.
- **Touch targets ≥ 44px.** Every button, link, tab, chip, and form control must be at least 44×44px on mobile. No tiny tap targets, no hover-only affordances (mobile has no hover).
- **Thumb-reachable primary actions.** The main action on a screen (RSVP, Book, Submit, Next) should sit within easy thumb reach — bottom of the viewport or a sticky bottom bar — not stranded at the top.
- **Primary navigation always reachable.** The bottom tab bar (`MobileBottomNav` in `src/components/mobile-bottom-nav.tsx`) is the mobile nav; the desktop header links are `hidden lg:flex`. Never ship a screen where navigation disappears on mobile.
- **No horizontal scroll on the page body.** Avoid fixed pixel widths that exceed the viewport. Wide, irreducible content (data tables, wizards) goes in an explicit `overflow-x-auto` container — the scroll is scoped to that element, never the whole page.
- **Prefer bottom sheets / drawers over dropdowns** for filters and menus on mobile — they're easier to operate with a thumb.
- **Forms and wizards must work one-handed.** Merchants create and manage events on their phones. Inputs full-width, labels above fields, large date/time pickers, sticky "Next/Save" action, no multi-column form rows on mobile.
- **Respect safe areas.** Account for notches/home indicators with `env(safe-area-inset-*)` on anything fixed to a screen edge.

How to verify: resize to 375px (or use the device toolbar) and confirm — no horizontal scroll, every action tappable, nav present, primary CTA reachable. The merchant event-create/manage flow and the attendee RSVP/booking flow are the highest-priority paths to keep mobile-perfect.

## What To Borrow From Paint It Easy

Paint It Easy works because the page is operationally clear. It does not over-explain. It gives users tools to find an event quickly.

Borrow these patterns:

- A compact hero with direct copy and two clear actions.
- Strong calendar/event browsing as the primary page structure.
- A dense filter row with location, date, category, language/search, and reset controls.
- Cards/List view toggles for different browsing modes.
- Event cards with real activity imagery, city, date, time, language, availability, price, and direct actions.
- Availability badges such as "3 seats left", "Sold out", "Waitlist", or "Almost full".
- Warm, practical event descriptions rather than abstract marketing copy.
- A visible count of available events after filtering.
- Repeatable card anatomy so users can scan quickly.

Do not copy the site literally. Click needs its own social layer: intent modes, people matching, AI prompts, mutual click logic, and group energy signals.

## What To Avoid

Avoid anything that makes Click feel like a generic AI startup landing page:

- Purple-blue gradient hero sections.
- Abstract glowing orbs, mesh blobs, and vague futuristic shapes.
- Oversized AI chat UI that pushes real events below the fold.
- Empty marketing sections that describe the product instead of letting users use it.
- Generic SaaS cards with soft shadows and no real content density.
- Repeated "AI-powered" language where event and community value should lead.

## Visual Direction

Use Click's palette, but rebalance it so the interface feels lighter and more event-led.

Core colors:

- Indigo Ink `#340068`: brand marks, nav, headers, strong text, selected states.
- Porcelain `#FFFCF9`: main background, event card surfaces, filter panels.
- Bubblegum Pink `#FF6978`: primary CTA buttons, high-priority badges, active match states.
- Icy Aqua `#B1EDE8`: tags, filter highlights, map/event accents, mutual click moments.
- Mauve Shadow `#6D435A`: secondary text, overlays, quiet metadata.

The current purple should be lighter in use. Keep indigo as a brand anchor, not a full-page blanket. Let Porcelain dominate most screens, with indigo used for type, borders, and selected UI.

Texture and detail:

- Subtle paper grain or off-white texture on main surfaces.
- Ticket-stub edges or stamped badges for event state labels.
- Fine rule lines and strong typography instead of glossy gradients.
- Photo-led cards with people, venues, tables, parks, gyms, art rooms, food, and real activity cues.

## Typography

Use distinctive typography that feels editorial and human.

Recommended direction:

- Headings: a characterful serif or editorial display face.
- Body/UI: a refined readable sans with strong numerals for dates and prices.
- Event metadata: compact uppercase or small caps where useful.

Avoid default-feeling font stacks and overly common AI/SaaS typography. Type should make the product feel like a designed events publication, not a dashboard template.

## Page Hierarchy

### Home / Discover

Primary hierarchy:

1. Short top navigation.
2. Compact editorial hero.
3. Centered Click Conversation module.
4. Event cards immediately underneath.
5. People/group suggestion cards underneath the events.

The hero should not become a large marketing block. The first viewport must show the conversation module and the start of event recommendations.

Suggested hero copy:

> Find your people through things worth leaving the house for.

Support copy:

> Tell Click what you want more of: friends in Marrickville, a CrossFit crew, weekend walks, singles nights, pottery classes, or a low-pressure way to meet people nearby.

### Click Conversation Module

The conversation module belongs near the top center, but it should feel like a concierge input, not two separate chat boxes.

Rules:

- Use one input box only.
- Muted placeholder text should type, pause, erase, and rotate through example prompts.
- Example prompts should focus on suburbs, intent, and activities.
- The AI output should become cards, not a long chat transcript.

Prompt examples:

- "I want to make new friends around Newtown"
- "Find me low-pressure events in Surry Hills this weekend"
- "I want to get better at CrossFit near Bondi"
- "Show me pottery or painting nights in Marrickville"
- "I want to meet people in Parramatta after work"
- "Find relaxed dating events around Sydney"
- "I want a walking group near Manly"

When the user submits, show a concise response such as:

> Here are a few groups and events that fit.

Then surface event cards and people/group cards.

### Event Cards Under Chat

Event cards should appear directly under the Click Conversation module.

Use more cards on the front of the page so the product feels active immediately. A strong default layout is a 3-column desktop grid, 2-column tablet grid, and single-column mobile list.

Card anatomy:

- Image.
- Availability badge.
- City/suburb.
- Date and time.
- Category or intent chip.
- Event title.
- Short description.
- Social signal, such as "4 people you might click with are going".
- Price or "Free".
- Primary action: RSVP, Book, or Join Waitlist.
- Secondary action: Details.

Example card labels:

- "3 spots left"
- "Almost full"
- "New group"
- "Good for first-timers"
- "Friends mode"
- "Dating mode"
- "Popular near you"

### People / Group Cards

People cards should sit under events, not above them. Click's philosophy is that people meet through activities.

Cards should be suggestive, not swipe-like:

- First name.
- Suburb.
- Intent.
- Shared interests.
- Event overlap.
- A private "Click" action.

Example:

> Maya, 31, Newtown  
> Also likes pottery, coastal walks, and live jazz.  
> You both might like Thursday Clay Club.

## Events Page

The `/events` page should become a full event marketplace.

Top structure:

- Page title and short explanation.
- Location permission prompt.
- Filter bar.
- Map preview.
- Cards/List toggle.
- Event result count.
- Event grid/list.

Location features:

- Prompt: "Share your location to see events around you."
- Manual location fallback: suburb, postcode, or city.
- Quick filters:
  - Around me
  - Sydney
  - Inner West
  - Eastern Suburbs
  - Northern Beaches
  - Parramatta
  - Online

Date filters:

- Today
- This weekend
- Next 7 days
- Next 30 days
- Custom date

Category filters:

- Music
- Arts
- Food
- Wellness
- Fitness
- Outdoors
- Games
- Social
- Networking
- Community
- Dating

Intent filters:

- Friends
- Dating
- Networking
- Exploring

Map behavior:

- Show a sample map by default.
- Replace with real map data once location permission is granted.
- Pins should match event category colors or availability states.
- Clicking a pin should highlight the matching card.

## Filter Design

Filters should feel useful and tactile, not like generic dropdowns.

Preferred pattern:

- One horizontal filter strip on desktop.
- Drawer or stacked filter panel on mobile.
- Search field with examples such as "jazz", "CrossFit", "pottery", "new friends".
- Reset button visible after a filter is active.
- Cards/List segmented toggle.

Filter states:

- Default: porcelain background, indigo border.
- Active: icy aqua fill or underline.
- High-priority active action: bubblegum pink.

## Event Card States

Locked event:

- Location partly hidden.
- Approximate suburb or distance only.
- CTA: "RSVP to unlock details".
- Keep FOMO/social signals visible.

Unlocked event:

- Full address visible.
- Attendee/social overlap visible.
- CTA: "View details" or "Cancel RSVP".

Waitlist event:

- Badge: "Waitlist open".
- CTA: "Join waitlist".
- Explain timing only where needed.

Sold out event:

- Badge: "Sold out".
- CTA: "See similar".

## Merchant / Admin Implications

Merchant-created events need card-ready fields:

- Image.
- Title.
- Short summary.
- Start/end date and time.
- Location/suburb.
- Category tags.
- Intent fit.
- Capacity.
- Price.
- Booking authority: Click-managed or external booking.
- Availability state.

Admin moderation should check whether an event has enough content quality to appear in the event marketplace.

## Motion

Use motion sparingly and intentionally.

Recommended motion:

- Typing and erasing placeholder in the conversation input.
- Event cards fade/slide in after a prompt is submitted.
- Cards/List toggle transitions.
- Filter drawer opening on mobile.
- Card image hover crop.
- Availability stamp appearing when cards load.

Avoid constant ambient animation. The product should feel alive because the events are alive, not because the interface is moving everywhere.

## Copy Tone

Click should sound warm, specific, and practical.

Good:

- "Find people for coastal walks, pottery nights, CrossFit, and low-pressure dinners."
- "Someone you might click with is going."
- "Good for first-timers."
- "Mostly locals from the Inner West."
- "A relaxed group night, not a networking room."

Avoid:

- "AI-powered connection intelligence."
- "Unlock your social graph."
- "Experience the future of relationship discovery."
- "Revolutionary matching algorithm."

## Implementation Checklist

- Make event cards the dominant content under the conversation module.
- Replace oversized AI-looking sections with compact event marketplace structure.
- Add location, date, category, intent, search, and view filters to events.
- Add a location permission prompt with manual suburb fallback.
- Add a sample map area on `/events`.
- Use Click's palette with Porcelain as the dominant background.
- Use real activity imagery wherever possible.
- Add availability, social overlap, and event-state badges.
- Keep people suggestions below events.
- Make AI responses turn into event/group cards rather than chat bubbles.
- Build mobile filters as a drawer or compact stacked panel.

## Success Criteria

Click should pass these tests:

- A new user understands within five seconds that Click helps them find events and people nearby.
- The first viewport shows real event options, not just brand claims.
- The AI input feels useful but does not overpower the event marketplace.
- Users can filter by location and date without thinking.
- Cards are information-rich enough to compare quickly.
- The visual style feels human, local, and social, not generic AI.
