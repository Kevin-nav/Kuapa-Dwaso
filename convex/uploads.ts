import { assertUploadMetadata, buildUploadObjectKey } from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  insertAuditLog,
  omitUndefinedValues,
  requireAdminPermission,
} from "./workflowHelpers";

const profileType = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("warehouse_agent"),
  v.literal("admin"),
);
const uploadPurpose = v.union(
  v.literal("transporter_truck_photo"),
  v.literal("produce_intake_photo"),
  v.literal("condition_evidence"),
  v.literal("dispute_evidence"),
  v.literal("profile_evidence"),
);
const uploadStatus = v.union(
  v.literal("pending_upload"),
  v.literal("uploaded"),
  v.literal("attached"),
  v.literal("rejected"),
  v.literal("deleted"),
);
const uploadAccessLevel = v.union(v.literal("private"), v.literal("public_read"));
const relatedEntityType = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("transporter_profile"),
  v.literal("warehouse_agent"),
  v.literal("inventory_batch"),
  v.literal("dispatch"),
  v.literal("dispute"),
);

function actorCanCreateUploadForOwner(
  actor: { _id: Id<"users">; role: string },
  ownerUserId: Id<"users">,
): boolean {
  return actor._id === ownerUserId || actor.role === "admin" || actor.role === "warehouse_agent";
}

export const createPending = mutation({
  args: {
    actorUserId: v.id("users"),
    ownerUserId: v.optional(v.id("users")),
    ownerProfileType: v.optional(profileType),
    ownerProfileId: v.optional(v.string()),
    purpose: uploadPurpose,
    contentType: v.string(),
    sizeBytes: v.number(),
    accessLevel: v.optional(uploadAccessLevel),
    bucket: v.string(),
    objectKey: v.optional(v.string()),
    fileName: v.optional(v.string()),
    relatedEntityType: v.optional(relatedEntityType),
    relatedEntityId: v.optional(v.string()),
  },
  returns: v.object({
    uploadAssetId: v.string(),
    objectKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const ownerUserId = args.ownerUserId ?? args.actorUserId;
    assertAllowed(
      actorCanCreateUploadForOwner(actor, ownerUserId),
      "Actor cannot create uploads for this owner.",
    );
    if (actor.role === "admin" && ownerUserId !== actor._id) {
      await requireAdminPermission(ctx, actor._id, "uploads:manage", {});
    }
    assertUploadMetadata({
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
    });

    const now = Date.now();
    const placeholderObjectKey =
      args.objectKey ??
      buildUploadObjectKey(omitUndefinedValues({
        environment: "pending",
        purpose: args.purpose,
        ownerUserId,
        uploadAssetId: String(now),
        fileName: args.fileName,
      }));
    const uploadAssetId = await ctx.db.insert("uploadAssets", omitUndefinedValues({
      ownerUserId,
      ownerProfileType: args.ownerProfileType,
      ownerProfileId: cleanOptionalText(args.ownerProfileId),
      purpose: args.purpose,
      status: "pending_upload",
      accessLevel: args.accessLevel ?? "private",
      bucket: args.bucket,
      objectKey: placeholderObjectKey,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: cleanOptionalText(args.relatedEntityId),
      createdByUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    }));

    const objectKey =
      args.objectKey ??
      buildUploadObjectKey(omitUndefinedValues({
        environment: "uploads",
        purpose: args.purpose,
        ownerUserId,
        uploadAssetId,
        fileName: args.fileName,
      }));
    if (objectKey !== placeholderObjectKey) {
      await ctx.db.patch(uploadAssetId, { objectKey, updatedAt: now });
    }

    const after = await ctx.db.get(uploadAssetId);
    await insertAuditLog(ctx, {
      actor,
      action: "upload_asset.created",
      entityType: "upload_asset",
      entityId: uploadAssetId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return {
      uploadAssetId,
      objectKey,
    };
  },
});

export const complete = mutation({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
    sizeBytes: v.number(),
    checksumSha256: v.optional(v.string()),
  },
  returns: v.id("uploadAssets"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const asset = await ctx.db.get(args.uploadAssetId);
    assertAllowed(asset !== null, "Upload asset was not found.");
    assertAllowed(asset.status === "pending_upload", "Only pending uploads can be completed.");
    assertAllowed(
      actor._id === asset.ownerUserId || actor._id === asset.createdByUserId || actor.role === "admin",
      "Actor cannot complete this upload.",
    );
    if (actor.role === "admin" && actor._id !== asset.ownerUserId) {
      await requireAdminPermission(ctx, actor._id, "uploads:manage", {});
    }
    assertAllowed(args.sizeBytes === asset.sizeBytes, "Completed upload size does not match presigned metadata.");

    const now = Date.now();
    await ctx.db.patch(args.uploadAssetId, omitUndefinedValues({
      status: "uploaded",
      checksumSha256: cleanOptionalText(args.checksumSha256),
      completedAt: now,
      updatedAt: now,
    }));
    const after = await ctx.db.get(args.uploadAssetId);
    await insertAuditLog(ctx, {
      actor,
      action: "upload_asset.completed",
      entityType: "upload_asset",
      entityId: args.uploadAssetId,
      before: auditSnapshot(asset),
      after: after === null ? undefined : auditSnapshot(after),
    });
    return args.uploadAssetId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
    status: uploadStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("uploadAssets"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    await requireAdminPermission(ctx, actor._id, "uploads:manage", {});
    const asset = await ctx.db.get(args.uploadAssetId);
    assertAllowed(asset !== null, "Upload asset was not found.");
    await ctx.db.patch(args.uploadAssetId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.uploadAssetId);
    await insertAuditLog(ctx, {
      actor,
      action: "upload_asset.status_updated",
      entityType: "upload_asset",
      entityId: args.uploadAssetId,
      before: auditSnapshot(asset),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    return args.uploadAssetId;
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const asset = await ctx.db.get(args.uploadAssetId);
    if (asset === null) {
      return null;
    }
    if (actor._id !== asset.ownerUserId && actor._id !== asset.createdByUserId) {
      await requireAdminPermission(ctx, actor._id, "uploads:read", {});
    }
    return asset;
  },
});

export const listByOwner = query({
  args: {
    actorUserId: v.id("users"),
    ownerUserId: v.id("users"),
    status: v.optional(uploadStatus),
    purpose: v.optional(uploadPurpose),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    if (actor._id !== args.ownerUserId) {
      await requireAdminPermission(ctx, actor._id, "uploads:read", {});
    }
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.purpose === undefined
        ? await ctx.db
            .query("uploadAssets")
            .withIndex("by_owner_status", (q) =>
              args.status === undefined
                ? q.eq("ownerUserId", args.ownerUserId)
                : q.eq("ownerUserId", args.ownerUserId).eq("status", args.status!),
            )
            .take(limit * 2)
        : await ctx.db
            .query("uploadAssets")
            .withIndex("by_owner_purpose_status", (q) =>
              args.status === undefined
                ? q.eq("ownerUserId", args.ownerUserId).eq("purpose", args.purpose!)
                : q
                    .eq("ownerUserId", args.ownerUserId)
                    .eq("purpose", args.purpose!)
                    .eq("status", args.status!),
            )
            .take(limit * 2);
    return candidates
      .filter((asset) => args.status === undefined || asset.status === args.status)
      .filter((asset) => args.purpose === undefined || asset.purpose === args.purpose)
      .slice(0, limit);
  },
});
