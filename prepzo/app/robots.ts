import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/tools/", "/privacy-policy", "/terms"],
      disallow: [
        "/api/",
        "/admin/",
        "/auth/",
        "/dashboard",
        "/decks",
        "/flashcards",
        "/onboarding",
        "/progress",
        "/pyq",
        "/quiz",
        "/settings",
        "/upgrade",
      ],
    },
    sitemap: "https://www.prepzo.study/sitemap.xml",
    host: "https://www.prepzo.study",
  };
}
