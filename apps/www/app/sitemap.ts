import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@kuapa-dwaso/config";
import { getSitemapPosts } from "./blog/data";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getSitemapPosts();
  return [
    { url: publicSiteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${publicSiteUrl}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${publicSiteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
