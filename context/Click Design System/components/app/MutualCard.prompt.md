The mutual-click payoff card on deep purple - locked headline "You clicked with each other. ✨", both avatars, the intent line, a primary CTA, and the silent "Not feeling it" exit. Pre-event variant routes to the meeting point; post-event to a suggestion.

```jsx
<MutualCard
  name="Mia" event="Wheel-throwing for beginners"
  yourIntent="friends" tags={["Ceramics", "Natural wine"]}
  variant="preEvent" onCta={openSuggestPlan}
/>
```

Props: `name`, `src`, `event`, `yourIntent`, `dating`, `tags` (≤2 neutral pills), `variant` (preEvent/postEvent), `ctaLabel`, `onCta`, `onDecline`.
