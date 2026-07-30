import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const r2PublicMediaHostname = (() => {
  const raw = process.env.R2_PUBLIC_URL ?? process.env.R2_TEMP_PUBLIC ?? "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.hostname : null;
  } catch {
    return null;
  }
})();
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://js.stripe.com https://checkout.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://*.stripe.com https://generativelanguage.googleapis.com",
  "frame-src https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com https://*.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Server Actions validate the request Origin against Host/X-Forwarded-Host to
  // block CSRF. Behind our proxy/CDN (letsclick.app served via www + apex) those
  // headers can disagree, so Next aborts the action POST with an opaque server
  // error — e.g. the "Save Persona" submit on /quiz/personality failing only in
  // prod. Allow-list the production hosts so the action is accepted.
  experimental: {
    serverActions: {
      allowedOrigins: ["letsclick.app", "www.letsclick.app"],
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
      // Public media stored in Cloudflare R2. Upload helpers prefer this
      // backend when the complete R2 configuration is present.
      ...(r2PublicMediaHostname
        ? [
            {
              protocol: "https" as const,
              hostname: r2PublicMediaHostname,
            },
          ]
        : []),
      // OAuth provider profile photos (Google / Facebook) — used as the avatar
      // fallback on /profile and /profile/[userId] until we rehost to the
      // avatars bucket.
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
          ...(isDevelopment
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
