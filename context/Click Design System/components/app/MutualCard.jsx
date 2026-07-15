import React from "react";
import { Avatar } from "../core/Avatar.jsx";
import { Tag } from "../core/Tag.jsx";
import { Button } from "../core/Button.jsx";
import { Spark } from "../core/Logo.jsx";

/**
 * MutualCard - the payoff surface. "You clicked with [Name]." Activity-led, NOT
 * a dating match: a single Deep-Purple spark glyph + the person's ONE avatar (no
 * paired/overlapping "you + them" avatars, no heavy purple gradient). Cream card,
 * Poppins headline at 600, a Sage intent pill, neutral shared-interest tags, and
 * the calm activity-first line. The "Not feeling it" exit is silent to the other
 * person. Mirrors the in-app reveal modal so the reveal reads the same everywhere.
 */
export function MutualCard({
  name = "",
  src = null,
  event = "",
  yourIntent = "friends",
  dating = false,
  tags = [],
  variant = "preEvent",
  ctaLabel = null,
  onCta = () => {},
  onDecline = () => {},
  style = {},
}) {
  const first = (name || "").split(" ")[0] || "them";
  const cta = ctaLabel || "Suggest a plan";
  const tg = (tags || []).slice(0, 2);
  return (
    <div
      style={{
        position: "relative",
        background: "var(--cream)",
        borderRadius: "var(--radius-2xl)",
        padding: "32px 28px 26px",
        textAlign: "center",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <span style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "var(--lavender-300)", opacity: 0.3, top: -90, left: -50 }} />
      <span style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%", background: "var(--lavender-200)", opacity: 0.5, bottom: -60, right: -30 }} />

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 13, marginBottom: 16 }}>
          <span style={{ width: 74, height: 74, borderRadius: "50%", background: "color-mix(in srgb, var(--purple-600) 9%, var(--cream))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spark size={42} color="var(--purple-600)" />
          </span>
          <Avatar name={name} src={src} size={54} ring />
        </div>

        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: "23px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
          You clicked with {first}.
        </h3>
        {event && (
          <p style={{ margin: "0 0 14px", fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            {variant === "preEvent" ? (
              <>You're both going to <b style={{ fontWeight: 600, color: "var(--text-body)" }}>{event}</b></>
            ) : (
              <>You were both at <b style={{ fontWeight: 600, color: "var(--text-body)" }}>{event}</b></>
            )}
          </p>
        )}

        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: "var(--radius-pill)", background: "color-mix(in srgb, var(--sage) 14%, var(--white))", marginBottom: tg.length ? 12 : 16 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sage)" }} />
          <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--sage)" }}>You're both here for {yourIntent}{dating ? " · both open to dating" : ""}</span>
        </div>
        {tg.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 16 }}>
            {tg.map((t) => <Tag key={t} dense>{t}</Tag>)}
          </div>
        )}

        <p style={{ margin: "0 0 22px", fontSize: "14.5px", color: "var(--text-body)", lineHeight: 1.55 }}>
          Find a thing you'd both enjoy, and just show up.
        </p>

        <Button variant="primary" full size="lg" onClick={onCta}>{cta}</Button>
        <button
          onClick={onDecline}
          style={{
            marginTop: 12,
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Not feeling it? No worries - just ignore this.
        </button>
      </div>
    </div>
  );
}
