import { ImageResponse } from "next/og";

export const alt = "Click — a burst of YES";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#F9F6F0",
        color: "#1C1830",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        textAlign: "center",
        width: "100%",
      }}
    >
      <div style={{ color: "#3B2F81", display: "flex", fontSize: 96, fontWeight: 800 }}>
        click.
      </div>
      <div style={{ display: "flex", fontSize: 48, fontWeight: 700, marginTop: 24 }}>
        A burst of YES
      </div>
      <div style={{ color: "#6B6580", display: "flex", fontSize: 28, marginTop: 20 }}>
        Sydney events and people with a reason to talk.
      </div>
    </div>,
    size,
  );
}
