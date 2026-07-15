The canonical "person you can click with" card - ONE component reused identically on the Click-with-someone page (one per line), the dashboard "click with someone" section, and as the profile-drawer header. Distinct from the EventCard: a face + the real overlap + one intention - no banner, no price, no RSVP. The hook is the overlap, never a bio (bios/prompts/full interests live in the profile drawer).

```jsx
<PeopleCard name="Mia" intent="here for friends"
  sharedEvent="Wheel throwing - two mugs" tags={["Ceramics","Natural wine","Pottery"]} />
<PeopleCard name="Jules" intent="open to dating"
  overlap="pottery & live music" tags={["Pottery","Live music","Film"]} state="pending" />
<PeopleCard name="Tom" intent="here for the activities"
  overlap="coffee & weekend films" tags={["Coffee","Film"]} layout="stack" />
```

Props: `name`, `src`, `intent`, `sharedEvent`, `overlap`, `tags`, `state` (default / pending / mutual / loading), `layout` (row / stack), `onClick`, `onView`.

Locked rules:
- **No bio/prompt text on the card.** Only the overlap.
- **Shared-context line is conditional, never fabricated.** `sharedEvent` → "You were both at X"; else `overlap` → "Both into X" (plain venn glyph, never a ✨); else the line is omitted - never a bare "You were both at".
- **The click button is ONE control across states** - same size/shape/radius; only fill + label change. Default = filled Deep Purple "click with [name]"; pending = muted "clicked" (no ✨); mutual = Sage "clicked ✨" (✨ = the peak). Never a smaller pill.
- **No age on the card** (name only - age lives on the profile drawer); **no anonymous helper line on the card** (that reassurance shows once at the top of the section).
- **Max one ✨ per element**, on the mutual state only; intent labels render sentence-case.
- **Row = one per line** on desktop (avatar · info · actions); collapses to a vertical card (`layout="stack"`) on mobile.
