import type { MetadataRoute } from "next";

const baseUrl = "https://ca.prepzo.study";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-09-13T00:00:00+05:30");

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
