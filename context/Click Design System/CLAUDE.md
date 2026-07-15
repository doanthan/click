# Click - project memory

Persistent instructions for this project.

## Punctuation
- **Never use em-dashes (`—`) anywhere - ever.** Use a spaced hyphen ` - ` instead. This applies to all copy, prose, code comments, data, and docs across every page and file. When adding or editing any text, write hyphens, not em-dashes.

## Footer
- The global site footer has exactly two rows with **no divider line** between the wordmark row and the "© 2026 Click · Made in Sydney" row.

## Merchant portal (locked decisions)
- ONE "Create event" CTA per screen - never duplicate it in banner + header + empty state at once.
- Money stats are never "Free" - write "$0" with a scope note (e.g. "$0 · free events so far"). Every KPI carries a period/context note.
- Fill rate is scoped to UPCOMING events only - never blended with past events.
- Colour roles: Deep Purple = brand/current, Sage = live + money-good (paid, connected, check-in), Amber = waiting (pending, waitlist), Coral = cancelled/nearly-full, Lavender = confirmed bookings.
- Paid events route via Stripe with a 5% platform fee, paid out monthly; free events skip Stripe entirely.
- Address privacy: Discover shows suburb only; the full address unlocks after booking.
- Waitlist rule: when a spot opens, first in line gets 30 minutes to claim it.
- Check-in is offered only on confirmed attendees.
- Merchant DS components live in `components/merchant/` (StatCard, CapacityMeter, StatusPill, WizardStepper) - use these, don't re-draw them.
