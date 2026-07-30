import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Click · A burst of YES",
    short_name: "Click",
    description: "Find Sydney events and people with a reason to talk.",
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
