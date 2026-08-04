import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Click · Find fun things to do in Sydney",
    short_name: "Click",
    description: "Discover and book fun Sydney activities, meet people naturally, and see who you click with.",
    start_url: "/",
    display: "standalone",
    background_color: "#F9F6F0",
    theme_color: "#3B2F81",
    icons: [
      {
        src: "/click-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
