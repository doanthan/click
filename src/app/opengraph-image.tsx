import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Click: find fun things to do in Sydney";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const hero = await readFile(join(process.cwd(), "public/home/hero-discover-v2.jpg"), "base64");
  const heroSrc = `data:image/jpeg;base64,${hero}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: "flex-start",
        backgroundColor: "#201A3A",
        color: "#F9F6F0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "68px",
        textAlign: "left",
        width: "100%",
      }}
    >
      {/* ImageResponse accepts an ArrayBuffer for project-local raster assets. */}
      <img
        alt=""
        src={heroSrc}
        style={{ height: "100%", left: 0, objectFit: "cover", position: "absolute", top: 0, width: "100%" }}
      />
      <div
        style={{
          background: "linear-gradient(90deg, rgba(16,11,34,0.98) 0%, rgba(16,11,34,0.88) 38%, rgba(16,11,34,0.18) 72%)",
          display: "flex",
          inset: 0,
          position: "absolute",
        }}
      />
      <div style={{ color: "#C8B8F8", display: "flex", fontSize: 56, fontWeight: 700, position: "relative" }}>
        click.
      </div>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: "-3px", lineHeight: 1, marginTop: 34, maxWidth: 650, position: "relative" }}>
        Find your next obsession.
      </div>
      <div style={{ color: "rgba(249,246,240,0.78)", display: "flex", fontSize: 28, lineHeight: 1.35, marginTop: 24, maxWidth: 650, position: "relative" }}>
        Book fun Sydney activities, meet people naturally, and see who you click with.
      </div>
    </div>,
    size,
  );
}
