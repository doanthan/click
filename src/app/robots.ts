import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/business/",
        "/dashboard/",
        "/merchant/",
        "/notifications/",
        "/profile/edit/",
        "/proposals/",
        "/quiz/",
        "/scale/",
      ],
    },
    sitemap: "https://www.letsclick.app/sitemap.xml",
    host: "https://www.letsclick.app",
  };
}
