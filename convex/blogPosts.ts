import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
} from "./workflowHelpers";

const blogCategory = v.union(
  v.literal("visits"),
  v.literal("partnerships"),
  v.literal("events"),
  v.literal("updates"),
);
const blogStatus = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);
const textSegment = v.object({
  text: v.string(),
  marks: v.optional(v.array(v.union(v.literal("bold"), v.literal("italic")))),
  href: v.optional(v.string()),
});
const imageValue = v.object({
  url: v.string(),
  alt: v.string(),
  caption: v.optional(v.string()),
  uploadAssetId: v.optional(v.string()),
});
const contentBlock = v.union(
  v.object({
    id: v.string(),
    type: v.union(
      v.literal("paragraph"),
      v.literal("heading2"),
      v.literal("heading3"),
      v.literal("quote"),
    ),
    content: v.array(textSegment),
  }),
  v.object({
    id: v.string(),
    type: v.union(v.literal("bulletList"), v.literal("numberedList")),
    items: v.array(v.array(textSegment)),
  }),
  v.object({
    id: v.string(),
    type: v.literal("image"),
    url: v.string(),
    alt: v.string(),
    caption: v.optional(v.string()),
    uploadAssetId: v.optional(v.string()),
  }),
  v.object({
    id: v.string(),
    type: v.literal("gallery"),
    images: v.array(imageValue),
  }),
  v.object({
    id: v.string(),
    type: v.literal("video"),
    url: v.string(),
    title: v.string(),
  }),
);

const editableFields = {
  title: v.string(),
  slug: v.string(),
  excerpt: v.string(),
  category: blogCategory,
  content: v.array(contentBlock),
  heroImageUrl: v.string(),
  heroImageAlt: v.string(),
  heroImageCaption: v.optional(v.string()),
  heroUploadAssetId: v.optional(v.id("uploadAssets")),
  authorName: v.string(),
  location: v.optional(v.string()),
  occurredAt: v.optional(v.number()),
};

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" && url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

type SaveableBlogFields = {
  title: string;
  slug: string;
  excerpt: string;
  content: unknown[];
  heroImageUrl: string;
  heroImageAlt: string;
  authorName: string;
};

function validateForSave(args: SaveableBlogFields): void {
  assertAllowed(
    args.title.trim().length <= 140,
    "Story title must be 140 characters or fewer.",
  );
  assertAllowed(
    args.excerpt.trim().length <= 320,
    "Story summary must be 320 characters or fewer.",
  );
  assertAllowed(normalizeSlug(args.slug).length > 0, "Story slug is required.");
  assertAllowed(
    args.authorName.trim().length <= 100,
    "Author name must be 100 characters or fewer.",
  );
}

function validateForPublish(post: Doc<"blogPosts">): void {
  assertAllowed(
    post.title.trim().length >= 5,
    "A complete title is required before publishing.",
  );
  assertAllowed(
    post.excerpt.trim().length >= 20,
    "A summary of at least 20 characters is required before publishing.",
  );
  assertAllowed(
    post.content.length > 0,
    "Story content is required before publishing.",
  );
  assertAllowed(
    isSafePublicUrl(post.heroImageUrl),
    "A valid public hero image is required before publishing.",
  );
  assertAllowed(
    post.heroImageAlt.trim().length > 0,
    "Hero image alternative text is required before publishing.",
  );
  for (const block of post.content) {
    if (block.type === "image") {
      assertAllowed(
        isSafePublicUrl(block.url) && block.alt.trim().length > 0,
        "Every story image needs a valid URL and alternative text.",
      );
    }
    if (block.type === "gallery") {
      assertAllowed(
        block.images.length > 0,
        "A gallery must contain at least one image.",
      );
      for (const image of block.images) {
        assertAllowed(
          isSafePublicUrl(image.url) && image.alt.trim().length > 0,
          "Every gallery image needs a valid URL and alternative text.",
        );
      }
    }
    if (block.type === "video") {
      assertAllowed(
        isSafePublicUrl(block.url) && block.title.trim().length > 0,
        "Every video needs a valid URL and title.",
      );
    }
  }
}

async function assertUniqueSlug(
  ctx: MutationCtx,
  slug: string,
  exceptId?: Id<"blogPosts">,
): Promise<void> {
  const existing = await ctx.db
    .query("blogPosts")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  assertAllowed(
    existing === null || existing._id === exceptId,
    "Another story already uses this slug.",
  );
}

function publicPost(post: Doc<"blogPosts">) {
  const {
    createdByUserId: _createdBy,
    updatedByUserId: _updatedBy,
    publishedByUserId: _publishedBy,
    ...safe
  } = post;
  return safe;
}

export const createDraft = mutation({
  args: { actorUserId: v.id("users"), ...editableFields },
  returns: v.id("blogPosts"),
  handler: async (ctx, args) => {
    const { actorUserId, ...fields } = args;
    const access = await requireAdminPermission(
      ctx,
      actorUserId,
      "blog:write",
      {},
    );
    const slug = normalizeSlug(args.slug);
    validateForSave(args);
    await assertUniqueSlug(ctx, slug);
    const now = Date.now();
    const id = await ctx.db.insert(
      "blogPosts",
      omitUndefinedValues({
        ...fields,
        title: args.title.trim(),
        slug,
        excerpt: args.excerpt.trim(),
        heroImageUrl: args.heroImageUrl.trim(),
        heroImageAlt: args.heroImageAlt.trim(),
        authorName: args.authorName.trim() || "Kuapa Dwaso Team",
        location: cleanOptionalText(args.location),
        heroImageCaption: cleanOptionalText(args.heroImageCaption),
        status: "draft" as const,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const after = await ctx.db.get(id);
    await insertAuditLog(ctx, {
      actor: access.actor,
      action: "blog_post.created",
      entityType: "blog_post",
      entityId: id,
      after: auditSnapshot(after as unknown as Record<string, unknown>),
    });
    return id;
  },
});

export const updateDraft = mutation({
  args: {
    actorUserId: v.id("users"),
    blogPostId: v.id("blogPosts"),
    ...editableFields,
  },
  returns: v.id("blogPosts"),
  handler: async (ctx, args) => {
    const access = await requireAdminPermission(
      ctx,
      args.actorUserId,
      "blog:write",
      {},
    );
    const before = await ctx.db.get(args.blogPostId);
    assertAllowed(before !== null, "Story was not found.");
    assertAllowed(
      before.status !== "archived",
      "Archived stories cannot be edited.",
    );
    const slug =
      before.publishedAt === undefined ? normalizeSlug(args.slug) : before.slug;
    validateForSave(args);
    await assertUniqueSlug(ctx, slug, args.blogPostId);
    await ctx.db.patch(
      args.blogPostId,
      omitUndefinedValues({
        title: args.title.trim(),
        slug,
        excerpt: args.excerpt.trim(),
        category: args.category,
        content: args.content,
        heroImageUrl: args.heroImageUrl.trim(),
        heroImageAlt: args.heroImageAlt.trim(),
        heroImageCaption: cleanOptionalText(args.heroImageCaption),
        heroUploadAssetId: args.heroUploadAssetId,
        authorName: args.authorName.trim() || "Kuapa Dwaso Team",
        location: cleanOptionalText(args.location),
        occurredAt: args.occurredAt,
        updatedByUserId: args.actorUserId,
        updatedAt: Date.now(),
      }),
    );
    const after = await ctx.db.get(args.blogPostId);
    await insertAuditLog(ctx, {
      actor: access.actor,
      action: "blog_post.updated",
      entityType: "blog_post",
      entityId: args.blogPostId,
      before: auditSnapshot(before as unknown as Record<string, unknown>),
      after: auditSnapshot(after as unknown as Record<string, unknown>),
    });
    return args.blogPostId;
  },
});

async function changeStatus(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  blogPostId: Id<"blogPosts">,
  action: "publish" | "unpublish" | "archive",
) {
  const access = await requireAdminPermission(
    ctx,
    actorUserId,
    "blog:publish",
    {},
  );
  const before = await ctx.db.get(blogPostId);
  assertAllowed(before !== null, "Story was not found.");
  const now = Date.now();
  if (action === "publish") validateForPublish(before);
  await ctx.db.patch(
    blogPostId,
    action === "publish"
      ? {
          status: "published",
          publishedAt: before.publishedAt ?? now,
          publishedByUserId: actorUserId,
          archivedAt: undefined,
          updatedByUserId: actorUserId,
          updatedAt: now,
        }
      : action === "unpublish"
        ? { status: "draft", updatedByUserId: actorUserId, updatedAt: now }
        : {
            status: "archived",
            archivedAt: now,
            updatedByUserId: actorUserId,
            updatedAt: now,
          },
  );
  const after = await ctx.db.get(blogPostId);
  const auditAction =
    action === "publish"
      ? "published"
      : action === "unpublish"
        ? "unpublished"
        : "archived";
  await insertAuditLog(ctx, {
    actor: access.actor,
    action: `blog_post.${auditAction}`,
    entityType: "blog_post",
    entityId: blogPostId,
    before: auditSnapshot(before as unknown as Record<string, unknown>),
    after: auditSnapshot(after as unknown as Record<string, unknown>),
  });
  return blogPostId;
}

export const publish = mutation({
  args: { actorUserId: v.id("users"), blogPostId: v.id("blogPosts") },
  returns: v.id("blogPosts"),
  handler: (ctx, args) =>
    changeStatus(ctx, args.actorUserId, args.blogPostId, "publish"),
});
export const unpublish = mutation({
  args: { actorUserId: v.id("users"), blogPostId: v.id("blogPosts") },
  returns: v.id("blogPosts"),
  handler: (ctx, args) =>
    changeStatus(ctx, args.actorUserId, args.blogPostId, "unpublish"),
});
export const archive = mutation({
  args: { actorUserId: v.id("users"), blogPostId: v.id("blogPosts") },
  returns: v.id("blogPosts"),
  handler: (ctx, args) =>
    changeStatus(ctx, args.actorUserId, args.blogPostId, "archive"),
});

export const listForAdmin = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(blogStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "blog:read", {});
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const posts =
      args.status === undefined
        ? await ctx.db.query("blogPosts").order("desc").take(limit)
        : await ctx.db
            .query("blogPosts")
            .withIndex("by_status_updated_at", (q) =>
              q.eq("status", args.status!),
            )
            .order("desc")
            .take(limit);
    return posts;
  },
});

export const getForAdmin = query({
  args: { actorUserId: v.id("users"), blogPostId: v.id("blogPosts") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, args.actorUserId, "blog:read", {});
    return await ctx.db.get(args.blogPostId);
  },
});

export const listPublished = query({
  args: {
    category: v.optional(blogCategory),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 9, 1), 30);
    const paginationOpts = {
      numItems: limit,
      cursor: args.cursor ?? null,
    };
    const result =
      args.category === undefined
        ? await ctx.db
            .query("blogPosts")
            .withIndex("by_status_published_at", (q) =>
              q.eq("status", "published"),
            )
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("blogPosts")
            .withIndex("by_category_status_published_at", (q) =>
              q.eq("category", args.category!).eq("status", "published"),
            )
            .order("desc")
            .paginate(paginationOpts);
    return {
      items: result.page.map(publicPost),
      nextCursor: result.isDone ? null : result.continueCursor,
    };
  },
});

export const latest = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query("blogPosts")
        .withIndex("by_status_published_at", (q) => q.eq("status", "published"))
        .order("desc")
        .take(Math.min(Math.max(args.limit ?? 3, 1), 6))
    ).map(publicPost),
});

export const getPublishedBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.slug)))
      .unique();
    return post?.status === "published" ? publicPost(post) : null;
  },
});

export const related = query({
  args: {
    blogPostId: v.id("blogPosts"),
    category: blogCategory,
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 3, 1), 6);
    return (
      await ctx.db
        .query("blogPosts")
        .withIndex("by_category_status_published_at", (q) =>
          q.eq("category", args.category).eq("status", "published"),
        )
        .order("desc")
        .take(limit + 1)
    )
      .filter((post) => post._id !== args.blogPostId)
      .slice(0, limit)
      .map(publicPost);
  },
});

export const listPublishedForSitemap = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) =>
    (
      await ctx.db
        .query("blogPosts")
        .withIndex("by_status_published_at", (q) => q.eq("status", "published"))
        .order("desc")
        .take(1000)
    ).map((post) => ({ slug: post.slug, updatedAt: post.updatedAt })),
});
