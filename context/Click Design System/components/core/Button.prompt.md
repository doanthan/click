A purple primary action button (the only filled CTA), with secondary, ghost and onPurple variants. States are real CSS - hover darkens, `:focus-visible` shows a Deep-Purple keyboard ring, pressed scales, disabled goes Mist+Slate, `loading` swaps a spinner in (width held). Sizes 36/44/52, radius 12, labels Poppins 600. Sentence case - never "click here".

```jsx
<Button onClick={rsvp}>RSVP</Button>
<Button variant="secondary">View details</Button>
<Button variant="ghost" size="sm">Not feeling it</Button>
<Button variant="onPurple" size="lg">Join the waitlist</Button>
<Button loading>Suggest something to do</Button>
```
