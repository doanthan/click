import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions validate the request Origin against Host/X-Forwarded-Host to
  // block CSRF. Behind our proxy/CDN (letsclick.app served via www + apex) those
  // headers can disagree, so Next aborts the action POST with an opaque server
  // error — e.g. the "Save Persona" submit on /quiz/personality failing only in
  // prod. Allow-list the production hosts so the action is accepted.
  experimental: {
    serverActions: {
      allowedOrigins: ["letsclick.app", "www.letsclick.app", "*.letsclick.app"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
