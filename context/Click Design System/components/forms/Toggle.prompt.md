An on/off switch (purple when on) with optional label + helper. The canonical use is the visibility toggle, whose helper text is a locked string.

```jsx
<Toggle
  checked={visible}
  onChange={setVisible}
  label="Show me in event attendee lists"
  helper="Off means people at your events can't click with you. You'll still see everything and book anything."
/>
```

Props: `checked`, `onChange(next)`, `label`, `helper`, `disabled`.
