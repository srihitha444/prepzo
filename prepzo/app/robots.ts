import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy-policy", "/terms"],
      disallow: [
        "/api/",
        "/auth/",
        "/cheatsheet",
        "/dashboard",
        "/flashcards",
        "/history",
        "/mock-test",
        "/notes",
        "/onboarding",
        "/practice",
        "/settings",
        "/tutor",
      ],
    },
    sitemap: "https://ca.prepzo.study/sitemap.xml",
    host: "https://ca.prepzo.study",
  };
}
