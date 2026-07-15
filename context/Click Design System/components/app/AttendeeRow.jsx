import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Tag } from "../core/Tag.jsx";
import { Button } from "../core/Button.jsx";

/**
 * Attendee row - one person on the Who's-going (pre-event) or Who-was-there
 * (post-event) list. First name only, shared interest tags, intent label, and a
 * "Click with [name]" action. After clicking, shows the locked quiet state.
 * Identical UI for receivers - never signals that someone clicked with you.
 */
export function AttendeeRow({
  name = "",
  src = null,
  intent = null,
  tags = [],
  clicked = false,
  disabled = false,
  onClick = () => {},
  style = {},
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "13px",
        padding: "14px 0",
        borderBottom: "1px solid var(--border-soft)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <Avatar name={name} src={src} size={48} ring={clicked} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-strong)" }}>{name}</div>
        {intent && (
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: 500, marginTop: "2px" }}>{intent.charAt(0).toUpperCase() + intent.slice(1)}</div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
          {tags.slice(0, 3).map((t) => (
            <Tag key={t} dense>{t}</Tag>
          ))}
        </div>
      </div>
      {clicked ? (
        <Button variant="pending" size="sm" style={{ whiteSpace: "nowrap", flex: "none" }}>
          clicked
        </Button>
      ) : (
        <Button variant="primary" size="sm" disabled={disabled} onClick={onClick} style={{ whiteSpace: "nowrap" }}>
          click with {name}
        </Button>
      )}
    </div>
  );
}
