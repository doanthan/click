The locked intent line shown on every mutual click and the meeting-point screen. Two variants - same intent vs different intent (the "they're open to" framing avoids pressure).

```jsx
<IntentLine yourIntent="friends" />                          {/* You're both here for friends. */}
<IntentLine yourIntent="friends" theirIntent="dating" />     {/* You're here for friends · they're open to dating. */}
```

Props: `yourIntent`, `theirIntent` (omit for the equal variant).
