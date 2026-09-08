import {
  assertUploadMetadata,
  buildUploadObjectKey,
  isUploadPurposeAllowedForRelatedEntity,
} from "@kuapa-dwaso/utils";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  assertAuthenticatedActor,
  requirePilotAdminPermission,
  requirePilotCapability,
  requirePilotFinancialEntryRead,
  requirePilotLotRead,
  requirePilotPrincipal,
  requirePilotRequestRead,
} from "./pilotAccess";
import {
  adminScopeTarget,
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  dispatchScopeTarget,
  disputeScopeTarget,
  getActor,
  insertAuditLog,
  inventoryScopeTarget,
  omitUndefinedValues,
  requireAdminPermission,
  requireWarehouseAgentAssignedToWarehouse,
  warehouseScopeTarget,
  type Actor,
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
  v.literal("dispatch_proof_photo"),
  v.literal("profile_evidence"),
  v.literal("blog_hero_image"),
  v.literal("blog_content_image"),
  v.literal("pilot_inspection_evidence"),
  v.literal("pilot_collection_evidence"),
  v.literal("pilot_custody_evidence"),
  v.literal("pilot_acceptance_evidence"),
  v.literal("pilot_financial_evidence"),
  v.literal("pilot_issue_evidence"),
  v.literal("pilot_facility_assessment"),
);
const uploadStatus = v.union(
  v.literal("pending_upload"),
  v.literal("uploaded"),
  v.literal("attached"),
  v.literal("verified"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("deleted"),
);
const uploadAccessLevel = v.union(
  v.literal("private"),
  v.literal("public_read"),
);
const relatedEntityType = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("transporter_profile"),
  v.literal("warehouse_agent"),
  v.literal("inventory_batch"),
  v.literal("dispatch"),
  v.literal("dispute"),
  v.literal("blog_post"),
  v.literal("pilotFacilities"),
  v.literal("pilotInspections"),
  v.literal("pilotProcurementLots"),
  v.literal("pilotCustodyEvents"),
  v.literal("pilotBuyerAcceptances"),
  v.literal("pilotFinancialEntries"),
  v.literal("pilotIssues"),
);

type UploadPurpose =
  | "transporter_truck_photo"
  | "produce_intake_photo"
  | "condition_evidence"
  | "dispute_evidence"
  | "dispatch_proof_photo"
  | "profile_evidence"
  | "blog_hero_image"
  | "blog_content_image"
  | "pilot_inspection_evidence"
  | "pilot_collection_evidence"
  | "pilot_custody_evidence"
  | "pilot_acceptance_evidence"
  | "pilot_financial_evidence"
  | "pilot_issue_evidence"
  | "pilot_facility_assessment";

type UploadStatus =
  | "pending_upload"
  | "uploaded"
  | "attached"
  | "verified"
  | "rejected"
  | "expired"
  | "deleted";

type RelatedEntityType =
  | "farmer"
  | "buyer"
  | "transporter_profile"
  | "warehouse_agent"
  | "inventory_batch"
  | "dispatch"
  | "dispute"
  | "blog_post"
  | "pilotFacilities"
  | "pilotInspections"
  | "pilotProcurementLots"
  | "pilotCustodyEvents"
  | "pilotBuyerAcceptances"
  | "pilotFinancialEntries"
  | "pilotIssues";

const pilotRelatedEntityTypes: readonly RelatedEntityType[] = [
  "pilotFacilities",
  "pilotInspections",
  "pilotProcurementLots",
  "pilotCustodyEvents",
  "pilotBuyerAcceptances",
  "pilotFinancialEntries",
  "pilotIssues",
];

function isPilotAsset(asset: {
  purpose: string;
  relatedEntityType?: string;
  pilotProgrammeId?: Id<"pilotProgrammes">;
}): boolean {
  return (
    asset.pilotProgrammeId !== undefined ||
    asset.purpose.startsWith("pilot_") ||
    (asset.relatedEntityType !== undefined &&
      pilotRelatedEntityTypes.includes(
        asset.relatedEntityType as RelatedEntityType,
      ))
  );
}

function actorCanCreateUploadForOwner(
  actor: { _id: Id<"users">; role: string },
  ownerUserId: Id<"users">,
): boolean {
  return (
    actor._id === ownerUserId ||
    actor.role === "admin" ||
    actor.role === "warehouse_agent"
  );
}

function purposeAllowedForEntity(
  purpose: UploadPurpose,
  relatedEntityType: RelatedEntityType | undefined,
): boolean {
  if (relatedEntityType === undefined) {
    return isUploadPurposeAllowedForRelatedEntity({ purpose });
  }
  return isUploadPurposeAllowedForRelatedEntity({ purpose, relatedEntityType });
}

async function requireActorCanUseRelatedEntity(
  ctx: QueryCtx | MutationCtx,
  actor: Actor,
  permission: "read" | "manage",
  relatedEntityType: RelatedEntityType | undefined,
  relatedEntityId: string | undefined,
  pilotProgrammeId?: Id<"pilotProgrammes">,
): Promise<void> {
  if (relatedEntityType === undefined || relatedEntityId === undefined) {
    if (actor.role === "admin") {
      await requireAdminPermission(
        ctx,
        actor._id,
        permission === "read" ? "uploads:read" : "uploads:manage",
        {},
      );
    }
    return;
  }

  if (pilotRelatedEntityTypes.includes(relatedEntityType)) {
    assertAllowed(
      pilotProgrammeId !== undefined,
      "Pilot evidence requires a programme.",
    );
    await requireActorCanUsePilotRelatedEntity(
      ctx,
      actor,
      permission,
      relatedEntityType,
      relatedEntityId,
      pilotProgrammeId,
    );
    return;
  }

  if (relatedEntityType === "inventory_batch") {
    const batch = await ctx.db.get(relatedEntityId as Id<"inventoryBatches">);
    assertAllowed(batch !== null, "Related inventory batch was not found.");
    if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(
        ctx,
        actor._id,
        batch.warehouseId,
      );
      return;
    }
    if (actor.role === "farmer") {
      const farmer = await ctx.db.get(batch.farmerId);
      assertAllowed(
        farmer !== null && farmer.userId === actor._id,
        "Actor cannot access this batch evidence.",
      );
      return;
    }
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "uploads:read" : "uploads:manage",
      await inventoryScopeTarget(ctx, batch),
    );
    return;
  }

  if (relatedEntityType === "dispatch") {
    const dispatch = await ctx.db.get(relatedEntityId as Id<"dispatches">);
    assertAllowed(dispatch !== null, "Related dispatch was not found.");
    if (actor.role === "warehouse_agent") {
      await requireWarehouseAgentAssignedToWarehouse(
        ctx,
        actor._id,
        dispatch.warehouseId,
      );
      return;
    }
    if (actor.role === "transporter") {
      const transporter = await ctx.db
        .query("transporterProfiles")
        .withIndex("by_user", (q) => q.eq("userId", actor._id))
        .unique();
      assertAllowed(
        transporter !== null && dispatch.transporterId === transporter._id,
        "Actor cannot access this dispatch evidence.",
      );
      return;
    }
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "uploads:read" : "uploads:manage",
      await dispatchScopeTarget(ctx, dispatch),
    );
    return;
  }

  if (relatedEntityType === "dispute") {
    const dispute = await ctx.db.get(relatedEntityId as Id<"disputes">);
    assertAllowed(dispute !== null, "Related dispute was not found.");
    if (actor.role === "warehouse_agent") {
      assertAllowed(
        dispute.warehouseId !== undefined,
        "Warehouse dispute scope is required.",
      );
      await requireWarehouseAgentAssignedToWarehouse(
        ctx,
        actor._id,
        dispute.warehouseId,
      );
      return;
    }
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "uploads:read" : "uploads:manage",
      await disputeScopeTarget(ctx, dispute),
    );
    return;
  }

  if (relatedEntityType === "transporter_profile") {
    const profile = await ctx.db.get(
      relatedEntityId as Id<"transporterProfiles">,
    );
    assertAllowed(
      profile !== null,
      "Related transporter profile was not found.",
    );
    if (actor.role === "transporter") {
      assertAllowed(
        profile.userId === actor._id,
        "Actor cannot access this transporter evidence.",
      );
      return;
    }
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "uploads:read" : "uploads:manage",
      adminScopeTarget({ destinationMarket: profile.destinationsServed[0] }),
    );
    return;
  }

  if (relatedEntityType === "farmer") {
    const farmer = await ctx.db.get(relatedEntityId as Id<"farmers">);
    assertAllowed(farmer !== null, "Related farmer was not found.");
    if (actor.role === "farmer") {
      assertAllowed(
        farmer.userId === actor._id,
        "Actor cannot access this farmer evidence.",
      );
      return;
    }
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "uploads:read" : "uploads:manage",
      adminScopeTarget({
        warehouseId: farmer.preferredWarehouseId,
        region: farmer.region,
        district: farmer.community,
      }),
    );
    return;
  }

  if (relatedEntityType === "buyer") {
    const buyer = await ctx.db.get(relatedEntityId as Id<"buyers">);
    assertAllowed(buyer !== null, "Related buyer was not found.");
    if (actor.role === "buyer") {
      assertAllowed(
        buyer.userId === actor._id,
        "Actor cannot access this buyer evidence.",
      );
      return;
    }
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "uploads:read" : "uploads:manage",
      adminScopeTarget({
        destinationMarket: buyer.destinationMarket,
      }),
    );
    return;
  }

  if (relatedEntityType === "warehouse_agent") {
    const warehouseAgent = await ctx.db.get(
      relatedEntityId as Id<"warehouseAgents">,
    );
    assertAllowed(
      warehouseAgent !== null,
      "Related warehouse agent was not found.",
    );
    if (actor.role === "warehouse_agent") {
      assertAllowed(
        warehouseAgent.userId === actor._id,
        "Actor cannot access this warehouse agent evidence.",
      );
      return;
    }
    if (warehouseAgent.assignedWarehouseIds.length === 0) {
      await requireAdminPermission(
        ctx,
        actor._id,
        permission === "read" ? "uploads:read" : "uploads:manage",
        {},
      );
      return;
    }
    for (const warehouseId of warehouseAgent.assignedWarehouseIds) {
      await requireAdminPermission(
        ctx,
        actor._id,
        permission === "read" ? "uploads:read" : "uploads:manage",
        await warehouseScopeTarget(ctx, warehouseId),
      );
    }
    return;
  }

  if (relatedEntityType === "blog_post") {
    assertAllowed(
      actor.role === "admin",
      "Only administrators can access story media.",
    );
    await requireAdminPermission(
      ctx,
      actor._id,
      permission === "read" ? "blog:read" : "blog:write",
      {},
    );
    const post = await ctx.db.get(relatedEntityId as Id<"blogPosts">);
    assertAllowed(post !== null, "Related story was not found.");
    return;
  }
}

async function requireActorCanUsePilotRelatedEntity(
  ctx: QueryCtx | MutationCtx,
  actor: Actor,
  permission: "read" | "manage",
  relatedEntityType: RelatedEntityType,
  relatedEntityId: string,
  programmeId: Id<"pilotProgrammes">,
): Promise<void> {
  if (relatedEntityType === "pilotFacilities") {
    const entity = await ctx.db.get(relatedEntityId as Id<"pilotFacilities">);
    assertAllowed(
      entity !== null && entity.programmeId === programmeId,
      "Pilot facility was not found in this programme.",
    );
    await requirePilotCapability(
      ctx,
      actor,
      programmeId,
      permission === "read" ? "pilot:read" : "quality:record",
    );
    return;
  }
  if (relatedEntityType === "pilotInspections") {
    const entity = await ctx.db.get(relatedEntityId as Id<"pilotInspections">);
    assertAllowed(
      entity !== null && entity.programmeId === programmeId,
      "Pilot inspection was not found in this programme.",
    );
    const lot = await ctx.db.get(entity.lotId);
    assertAllowed(lot !== null, "Pilot lot was not found.");
    if (permission === "read") await requirePilotLotRead(ctx, actor, lot);
    else
      await requirePilotCapability(ctx, actor, programmeId, "quality:record");
    return;
  }
  if (relatedEntityType === "pilotProcurementLots") {
    const lot = await ctx.db.get(relatedEntityId as Id<"pilotProcurementLots">);
    assertAllowed(
      lot !== null && lot.programmeId === programmeId,
      "Pilot lot was not found in this programme.",
    );
    if (permission === "read") await requirePilotLotRead(ctx, actor, lot);
    else
      await requirePilotCapability(ctx, actor, programmeId, "custody:record");
    return;
  }
  if (relatedEntityType === "pilotCustodyEvents") {
    const entity = await ctx.db.get(
      relatedEntityId as Id<"pilotCustodyEvents">,
    );
    assertAllowed(
      entity !== null && entity.programmeId === programmeId,
      "Pilot custody event was not found in this programme.",
    );
    const lot = await ctx.db.get(entity.lotId);
    assertAllowed(lot !== null, "Pilot lot was not found.");
    if (permission === "read") await requirePilotLotRead(ctx, actor, lot);
    else
      await requirePilotCapability(ctx, actor, programmeId, "custody:record");
    return;
  }
  if (relatedEntityType === "pilotBuyerAcceptances") {
    const entity = await ctx.db.get(
      relatedEntityId as Id<"pilotBuyerAcceptances">,
    );
    assertAllowed(
      entity !== null && entity.programmeId === programmeId,
      "Pilot acceptance was not found in this programme.",
    );
    const request = await ctx.db.get(entity.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    if (permission === "read" || actor.role === "buyer")
      await requirePilotRequestRead(ctx, actor, request);
    else
      await requirePilotCapability(
        ctx,
        actor,
        programmeId,
        "fulfilment:manage",
      );
    return;
  }
  if (relatedEntityType === "pilotFinancialEntries") {
    const entity = await ctx.db.get(
      relatedEntityId as Id<"pilotFinancialEntries">,
    );
    assertAllowed(
      entity !== null && entity.programmeId === programmeId,
      "Pilot financial entry was not found in this programme.",
    );
    if (permission === "read" || actor.role !== "admin")
      await requirePilotFinancialEntryRead(ctx, actor, entity);
    else
      await requirePilotAdminPermission(
        ctx,
        actor,
        programmeId,
        "pilotFinance:manage",
      );
    return;
  }
  if (relatedEntityType === "pilotIssues") {
    const entity = await ctx.db.get(relatedEntityId as Id<"pilotIssues">);
    assertAllowed(
      entity !== null && entity.programmeId === programmeId,
      "Pilot issue was not found in this programme.",
    );
    const request = await ctx.db.get(entity.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    if (permission === "read" || actor.role === "buyer")
      await requirePilotRequestRead(ctx, actor, request);
    else await requirePilotCapability(ctx, actor, programmeId, "issues:manage");
    return;
  }
  assertAllowed(false, "Unsupported pilot evidence entity.");
}

async function getUploadActor(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">,
  pilotEvidence: boolean,
): Promise<Actor> {
  if (!pilotEvidence) return await getActor(ctx, actorUserId);
  const principal = await requirePilotPrincipal(ctx);
  assertAuthenticatedActor(principal, actorUserId);
  return principal;
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
    pilotProgrammeId: v.optional(v.id("pilotProgrammes")),
  },
  returns: v.object({
    uploadAssetId: v.string(),
    objectKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const isPilotEvidence =
      args.purpose.startsWith("pilot_") ||
      (args.relatedEntityType !== undefined &&
        pilotRelatedEntityTypes.includes(args.relatedEntityType));
    const actor = await getUploadActor(ctx, args.actorUserId, isPilotEvidence);
    const ownerUserId = args.ownerUserId ?? args.actorUserId;
    const relatedEntityId = cleanOptionalText(args.relatedEntityId);
    const isBlogMedia =
      args.purpose === "blog_hero_image" ||
      args.purpose === "blog_content_image";
    assertAllowed(
      !isPilotEvidence || args.pilotProgrammeId !== undefined,
      "Pilot evidence requires a programme.",
    );
    assertAllowed(
      !isPilotEvidence ||
        (args.relatedEntityType !== undefined &&
          pilotRelatedEntityTypes.includes(args.relatedEntityType) &&
          relatedEntityId !== undefined),
      "Pilot evidence requires a related pilot entity.",
    );
    assertAllowed(
      !isPilotEvidence ||
        args.accessLevel === undefined ||
        args.accessLevel === "private",
      "Pilot evidence must remain private.",
    );
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
    assertAllowed(
      purposeAllowedForEntity(args.purpose, args.relatedEntityType),
      "Upload purpose is not allowed for this related entity.",
    );
    assertAllowed(
      !isBlogMedia ||
        (args.relatedEntityType === "blog_post" &&
          relatedEntityId !== undefined),
      "Story media must be linked to an existing story.",
    );
    assertAllowed(
      args.accessLevel !== "public_read" ||
        args.purpose === "produce_intake_photo" ||
        args.purpose === "blog_hero_image" ||
        args.purpose === "blog_content_image",
      "Only approved public media purposes may be publicly readable.",
    );
    await requireActorCanUseRelatedEntity(
      ctx,
      actor,
      "manage",
      args.relatedEntityType,
      relatedEntityId,
      args.pilotProgrammeId,
    );

    const now = Date.now();
    const placeholderObjectKey =
      args.objectKey ??
      buildUploadObjectKey(
        omitUndefinedValues({
          environment: "pending",
          purpose: args.purpose,
          ownerUserId,
          uploadAssetId: String(now),
          fileName: args.fileName,
        }),
      );
    const uploadAssetId = await ctx.db.insert(
      "uploadAssets",
      omitUndefinedValues({
        ownerUserId,
        ownerProfileType: args.ownerProfileType,
        ownerProfileId: cleanOptionalText(args.ownerProfileId),
        pilotProgrammeId: args.pilotProgrammeId,
        purpose: args.purpose,
        status: "pending_upload",
        accessLevel: args.accessLevel ?? "private",
        bucket: args.bucket,
        objectKey: placeholderObjectKey,
        contentType: args.contentType,
        sizeBytes: args.sizeBytes,
        relatedEntityType: args.relatedEntityType,
        relatedEntityId,
        createdByUserId: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const objectKey =
      args.objectKey ??
      buildUploadObjectKey(
        omitUndefinedValues({
          environment: "uploads",
          purpose: args.purpose,
          ownerUserId,
          uploadAssetId,
          fileName: args.fileName,
        }),
      );
    if (objectKey !== placeholderObjectKey) {
      await ctx.db.patch(
        uploadAssetId,
        omitUndefinedValues({
          objectKey,
          updatedAt: now,
        }),
      );
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
  returns: v.object({
    uploadAssetId: v.id("uploadAssets"),
    status: v.union(v.literal("uploaded"), v.literal("attached")),
  }),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.uploadAssetId);
    assertAllowed(asset !== null, "Upload asset was not found.");
    const pilotEvidence = isPilotAsset(asset);
    const actor = await getUploadActor(ctx, args.actorUserId, pilotEvidence);
    assertAllowed(
      asset.status === "pending_upload",
      "Only pending uploads can be completed.",
    );
    assertAllowed(
      actor._id === asset.ownerUserId ||
        actor._id === asset.createdByUserId ||
        actor.role === "admin",
      "Actor cannot complete this upload.",
    );
    if (actor.role === "admin" && actor._id !== asset.ownerUserId) {
      await requireAdminPermission(ctx, actor._id, "uploads:manage", {});
    }
    if (pilotEvidence) {
      await requireActorCanUseRelatedEntity(
        ctx,
        actor,
        "manage",
        asset.relatedEntityType,
        asset.relatedEntityId,
        asset.pilotProgrammeId,
      );
    }
    assertAllowed(
      args.sizeBytes === asset.sizeBytes,
      "Completed upload size does not match presigned metadata.",
    );

    const now = Date.now();
    const status: "uploaded" | "attached" =
      asset.relatedEntityType === undefined ? "uploaded" : "attached";
    await ctx.db.patch(
      args.uploadAssetId,
      omitUndefinedValues({
        status,
        checksumSha256: cleanOptionalText(args.checksumSha256),
        completedAt: now,
        updatedAt: now,
      }),
    );
    const after = await ctx.db.get(args.uploadAssetId);
    await insertAuditLog(ctx, {
      actor,
      action: "upload_asset.completed",
      entityType: "upload_asset",
      entityId: args.uploadAssetId,
      before: auditSnapshot(asset),
      after: after === null ? undefined : auditSnapshot(after),
    });
    return {
      uploadAssetId: args.uploadAssetId,
      status,
    };
  },
});

export const attachToEntity = mutation({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
    relatedEntityType,
    relatedEntityId: v.string(),
    pilotProgrammeId: v.optional(v.id("pilotProgrammes")),
    purpose: v.optional(uploadPurpose),
    reason: v.optional(v.string()),
  },
  returns: v.id("uploadAssets"),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.uploadAssetId);
    assertAllowed(asset !== null, "Upload asset was not found.");
    const attachingPilot = pilotRelatedEntityTypes.includes(
      args.relatedEntityType,
    );
    const actor = await getUploadActor(
      ctx,
      args.actorUserId,
      attachingPilot || isPilotAsset(asset),
    );
    assertAllowed(
      !attachingPilot || args.pilotProgrammeId !== undefined,
      "Pilot evidence requires a programme.",
    );
    assertAllowed(
      !attachingPilot || asset.accessLevel === "private",
      "Pilot evidence must remain private.",
    );
    assertAllowed(
      asset.status === "uploaded" || asset.status === "attached",
      "Only uploaded evidence can be attached.",
    );
    const purpose = args.purpose ?? asset.purpose;
    assertAllowed(
      purposeAllowedForEntity(purpose, args.relatedEntityType),
      "Upload purpose is not allowed for this related entity.",
    );
    assertAllowed(
      actor._id === asset.ownerUserId ||
        actor._id === asset.createdByUserId ||
        actor.role === "admin" ||
        actor.role === "warehouse_agent",
      "Actor cannot attach this upload.",
    );
    await requireActorCanUseRelatedEntity(
      ctx,
      actor,
      "manage",
      args.relatedEntityType,
      cleanOptionalText(args.relatedEntityId),
      args.pilotProgrammeId,
    );

    const now = Date.now();
    await ctx.db.patch(
      args.uploadAssetId,
      omitUndefinedValues({
        purpose,
        relatedEntityType: args.relatedEntityType,
        relatedEntityId: cleanOptionalText(args.relatedEntityId),
        pilotProgrammeId: args.pilotProgrammeId,
        status: "attached",
        updatedAt: now,
      }),
    );
    const after = await ctx.db.get(args.uploadAssetId);
    await insertAuditLog(ctx, {
      actor,
      action: "upload_asset.attached",
      entityType: "upload_asset",
      entityId: args.uploadAssetId,
      before: auditSnapshot(asset),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });
    return args.uploadAssetId;
  },
});

async function updateUploadAssetStatus(
  ctx: MutationCtx,
  args: {
    actorUserId: Id<"users">;
    uploadAssetId: Id<"uploadAssets">;
    status: UploadStatus;
    reason?: string | undefined;
  },
): Promise<Id<"uploadAssets">> {
  const asset = await ctx.db.get(args.uploadAssetId);
  assertAllowed(asset !== null, "Upload asset was not found.");
  const actor = await getUploadActor(
    ctx,
    args.actorUserId,
    isPilotAsset(asset),
  );
  await requireActorCanUseRelatedEntity(
    ctx,
    actor,
    "manage",
    asset.relatedEntityType,
    asset.relatedEntityId,
    asset.pilotProgrammeId,
  );
  const now = Date.now();
  await ctx.db.patch(
    args.uploadAssetId,
    omitUndefinedValues({
      status: args.status,
      verifiedByUserId: args.status === "verified" ? actor._id : undefined,
      verifiedAt: args.status === "verified" ? now : undefined,
      rejectedByUserId: args.status === "rejected" ? actor._id : undefined,
      rejectedAt: args.status === "rejected" ? now : undefined,
      rejectionReason:
        args.status === "rejected" ? cleanOptionalText(args.reason) : undefined,
      deletedAt: args.status === "deleted" ? now : undefined,
      expiredAt: args.status === "expired" ? now : undefined,
      updatedAt: now,
    }),
  );
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
}

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
    status: uploadStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("uploadAssets"),
  handler: async (ctx, args) => {
    return await updateUploadAssetStatus(ctx, args);
  },
});

export const verify = mutation({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
    reason: v.optional(v.string()),
  },
  returns: v.id("uploadAssets"),
  handler: async (ctx, args) => {
    return await updateUploadAssetStatus(ctx, {
      actorUserId: args.actorUserId,
      uploadAssetId: args.uploadAssetId,
      status: "verified",
      reason: args.reason,
    });
  },
});

export const reject = mutation({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
    reason: v.string(),
  },
  returns: v.id("uploadAssets"),
  handler: async (ctx, args) => {
    return await updateUploadAssetStatus(ctx, {
      actorUserId: args.actorUserId,
      uploadAssetId: args.uploadAssetId,
      status: "rejected",
      reason: args.reason,
    });
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.uploadAssetId);
    if (asset === null) {
      return null;
    }
    const pilotEvidence = isPilotAsset(asset);
    const actor = await getUploadActor(ctx, args.actorUserId, pilotEvidence);
    if (
      pilotEvidence ||
      (actor._id !== asset.ownerUserId && actor._id !== asset.createdByUserId)
    ) {
      await requireActorCanUseRelatedEntity(
        ctx,
        actor,
        "read",
        asset.relatedEntityType,
        asset.relatedEntityId,
        asset.pilotProgrammeId,
      );
    }
    return asset;
  },
});

export const getReadableObject = query({
  args: {
    actorUserId: v.id("users"),
    uploadAssetId: v.id("uploadAssets"),
  },
  returns: v.union(
    v.null(),
    v.object({
      uploadAssetId: v.id("uploadAssets"),
      bucket: v.string(),
      objectKey: v.string(),
      contentType: v.string(),
      accessLevel: uploadAccessLevel,
      status: uploadStatus,
    }),
  ),
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.uploadAssetId);
    if (asset === null) {
      return null;
    }
    const pilotEvidence = isPilotAsset(asset);
    const actor = await getUploadActor(ctx, args.actorUserId, pilotEvidence);
    assertAllowed(
      asset.status !== "pending_upload",
      "Upload is not ready for read access.",
    );
    assertAllowed(
      asset.status !== "deleted",
      "Upload is not available for read access.",
    );
    if (
      pilotEvidence ||
      (actor._id !== asset.ownerUserId && actor._id !== asset.createdByUserId)
    ) {
      await requireActorCanUseRelatedEntity(
        ctx,
        actor,
        "read",
        asset.relatedEntityType,
        asset.relatedEntityId,
        asset.pilotProgrammeId,
      );
    }
    return {
      uploadAssetId: asset._id,
      bucket: asset.bucket,
      objectKey: asset.objectKey,
      contentType: asset.contentType,
      accessLevel: asset.accessLevel,
      status: asset.status,
    };
  },
});

export const listByRelatedEntity = query({
  args: {
    actorUserId: v.id("users"),
    relatedEntityType,
    relatedEntityId: v.string(),
    status: v.optional(uploadStatus),
    purpose: v.optional(uploadPurpose),
    pilotProgrammeId: v.optional(v.id("pilotProgrammes")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const relatedEntityId = cleanOptionalText(args.relatedEntityId);
    assertAllowed(
      relatedEntityId !== undefined,
      "Related entity id is required.",
    );
    const pilotEvidence = pilotRelatedEntityTypes.includes(
      args.relatedEntityType,
    );
    const actor = await getUploadActor(ctx, args.actorUserId, pilotEvidence);
    await requireActorCanUseRelatedEntity(
      ctx,
      actor,
      "read",
      args.relatedEntityType,
      relatedEntityId,
      args.pilotProgrammeId,
    );
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates = await ctx.db
      .query("uploadAssets")
      .withIndex("by_related_entity", (q) =>
        q
          .eq("relatedEntityType", args.relatedEntityType)
          .eq("relatedEntityId", relatedEntityId),
      )
      .order("desc")
      .take(limit * 3);
    return candidates
      .filter(
        (asset) => args.status === undefined || asset.status === args.status,
      )
      .filter(
        (asset) => args.purpose === undefined || asset.purpose === args.purpose,
      )
      .slice(0, limit);
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
    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.purpose === undefined
        ? await ctx.db
            .query("uploadAssets")
            .withIndex("by_owner_status", (q) =>
              args.status === undefined
                ? q.eq("ownerUserId", args.ownerUserId)
                : q
                    .eq("ownerUserId", args.ownerUserId)
                    .eq("status", args.status!),
            )
            .take(limit * 2)
        : await ctx.db
            .query("uploadAssets")
            .withIndex("by_owner_purpose_status", (q) =>
              args.status === undefined
                ? q
                    .eq("ownerUserId", args.ownerUserId)
                    .eq("purpose", args.purpose!)
                : q
                    .eq("ownerUserId", args.ownerUserId)
                    .eq("purpose", args.purpose!)
                    .eq("status", args.status!),
            )
            .take(limit * 2);
    const pilotEvidence = candidates.some(isPilotAsset);
    const actor = await getUploadActor(ctx, args.actorUserId, pilotEvidence);
    if (actor._id !== args.ownerUserId) {
      await requireAdminPermission(ctx, actor._id, "uploads:read", {});
    }
    if (pilotEvidence) {
      for (const asset of candidates.filter(isPilotAsset)) {
        await requireActorCanUseRelatedEntity(
          ctx,
          actor,
          "read",
          asset.relatedEntityType,
          asset.relatedEntityId,
          asset.pilotProgrammeId,
        );
      }
    }
    return candidates
      .filter(
        (asset) => args.status === undefined || asset.status === args.status,
      )
      .filter(
        (asset) => args.purpose === undefined || asset.purpose === args.purpose,
      )
      .slice(0, limit);
  },
});
