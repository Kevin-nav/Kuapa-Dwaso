import "server-only";
import { ConvexHttpClient } from "convex/browser";
import type { BlogPost } from "@kuapa-dwaso/types";
import { api } from "../../../../convex/_generated/api";

export type PublicBlogPost = Omit<
  BlogPost,
  "id" | "createdByUserId" | "updatedByUserId" | "publishedByUserId"
> & {
  _id: string;
  _creationTime: number;
};

function client() {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

export async function getLatestPosts(limit = 3): Promise<PublicBlogPost[]> {
  const convex = client();
  if (!convex) return [];
  try {
    return (await convex.query(api.blogPosts.latest, {
      limit,
    })) as PublicBlogPost[];
  } catch {
    return [];
  }
}

export async function getPublishedPosts(category?: string, cursor?: string) {
  const convex = client();
  if (!convex)
    return { items: [] as PublicBlogPost[], nextCursor: null as string | null };
  try {
    return (await convex.query(api.blogPosts.listPublished, {
      ...(category &&
      ["visits", "partnerships", "events", "updates"].includes(category)
        ? {
            category: category as
              | "visits"
              | "partnerships"
              | "events"
              | "updates",
          }
        : {}),
      ...(cursor ? { cursor } : {}),
      limit: 9,
    })) as { items: PublicBlogPost[]; nextCursor: string | null };
  } catch {
    return { items: [], nextCursor: null };
  }
}

export async function getPost(slug: string): Promise<PublicBlogPost | null> {
  const convex = client();
  if (!convex) throw new Error("Public blog data is not configured.");
  return (await convex.query(api.blogPosts.getPublishedBySlug, {
    slug,
  })) as PublicBlogPost | null;
}

export async function getRelatedPosts(
  post: PublicBlogPost,
): Promise<PublicBlogPost[]> {
  const convex = client();
  if (!convex) return [];
  try {
    return (await convex.query(api.blogPosts.related, {
      blogPostId: post._id as never,
      category: post.category,
      limit: 3,
    })) as PublicBlogPost[];
  } catch {
    return [];
  }
}

export async function getSitemapPosts(): Promise<
  Array<{ slug: string; updatedAt: number }>
> {
  const convex = client();
  if (!convex) return [];
  try {
    return (await convex.query(
      api.blogPosts.listPublishedForSitemap,
      {},
    )) as Array<{ slug: string; updatedAt: number }>;
  } catch {
    return [];
  }
}
