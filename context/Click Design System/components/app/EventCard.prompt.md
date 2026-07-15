The core event card - white surface, soft rounding, low purple shadow, a real warm-graded venue photo (`cover`) or a soft lavender fallback, a neutral category tag, date, venue + suburb, and a Who's-going avatar stack (only shown at ≥3 attendees).

```jsx
<EventCard
  name="Wheel throwing - make two mugs"
  venue="Posy Ceramics" suburb="Newtown"
  when="Thu 6:30pm"
  category="ceramics"
  going={["Mia","Tom","Priya","Jules","Bec"]} goingCount={9}
  onClick={open}
/>
```

Props: `name`, `venue`, `suburb`, `when`, `category`, `categoryLabel`, `cover`, `going`, `goingCount`, `onClick`.
