import React from "react";
import { Avatar } from "./Avatar.jsx";

/**
 * A compact overlapping cluster of avatars + a count - the "Who's going" social
 * proof on event cards. Only render when there are enough people to avoid
 * outing early RSVPs (the product threshold is 3).
 */
export function AvatarStack({ people = [], max = 4, size = 32, label = null, style = {} }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", ...style }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {shown.map((p, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.34, position: "relative", zIndex: i, display: "flex" }}>
            <Avatar name={typeof p === "string" ? p : p.name} src={typeof p === "object" ? p.src : null} size={size} style={{ boxShadow: "0 0 0 2.5px var(--white)" }} />
          </div>
        ))}
        {extra > 0 && (
          <div
            style={{
              flex: "none",
              marginLeft: -size * 0.34,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "var(--lavender-100)",
              color: "var(--purple-700)",
              boxShadow: "0 0 0 2.5px var(--white)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: size * 0.34,
              lineHeight: 1,
            }}
          >
            +{extra}
          </div>
        )}
      </div>
      {label && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--text-muted)" }}>
          {label}
        </span>
      )}
    </div>
  );
}
