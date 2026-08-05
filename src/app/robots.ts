import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // NO TRAILING SLASHES. A robots.txt `Disallow: /dashboard/` matches
      // /dashboard/anything but NOT /dashboard itself - and /dashboard, with no
      // slash, is the canonical URL Next serves (trailingSlash is off). Every
      // entry here used to carry one, so the routes we meant to keep out of
      // search were the only ones still crawlable. A bare prefix covers the
      // route and everything under it.
      //
      // "/merchant" also covers /merchant-pending by prefix. That's wanted -
      // it's a signed-in holding page with nothing to index.
      disallow: [
        "/admin",
        "/api",
        "/business",
        "/dashboard",
        "/merchant",
        "/notifications",
        "/profile/edit",
        "/proposals",
        "/quiz",
        "/scale",
      ],
    },
    sitemap: "https://www.letsclick.app/sitemap.xml",
    host: "https://www.letsclick.app",
  };
}
