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
      // Placeholder images used by seed / sample event data.
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      // Supabase Storage public buckets (avatars + event/gallery images). Any
      // Supabase project host, scoped to the public object path. See CLAUDE.md →
      // "File storage".
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
