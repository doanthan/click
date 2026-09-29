/**
 * The People Card's solo intent line: "Here for friends" · "Open to dating".
 *
 * Dating is GATED - it renders only when the viewer is also open to dating
 * (intent-neutral + mutual opt-in), so a friends-only viewer never sees a dating
 * label. Non-dating intents are preferred when someone carries several, which
 * keeps the card foregrounded on friends/activities rather than dating.
 *
 * Plain TS with no imports, so the client card and the server mapper for the
 * post-event roster share it, and tests can load it directly.
 */
export function soloIntentLabel(intents: readonly string[], viewerOpenToDating: boolean): string | null {
  const visible = intents.filter((i) => i !== "dating" || viewerOpenToDating);
  if (!visible.length) return null;
  const chosen = visible.find((i) => i !== "dating") ?? visible[0];
  switch (chosen) {
    case "friendship":
      return "Here for friends";
    case "networking":
      return "Here for networking";
    case "exploring":
      return "Here for the activities";
    case "dating":
      return "Open to dating";
    default:
      return null;
  }
}
