One person on the Who's-going / Who-was-there list - avatar, first name, intent, shared interest tags, and a "click with [name]" button. After clicking it shows the quiet "clicked" state (same footprint, muted, no ✨); the UI is identical for receivers (never reveals a non-mutual click).

```jsx
<AttendeeRow name="Mia" intent="here for friends" tags={["Ceramics","Natural wine"]} onClick={click} />
<AttendeeRow name="Jules" clicked />
```

Props: `name`, `src`, `intent`, `tags`, `clicked`, `disabled`, `onClick`.
