import type { PilotCapability } from "@kuapa-dwaso/types/pilot";
import {
  getPilotFieldVisibility,
  pilotAssignmentAllows,
} from "@kuapa-dwaso/permissions/pilot";
import type { AdminPermissionKey } from "@kuapa-dwaso/permissions";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  adminScopeTarget,
  assertAllowed,
  requireAdminPermission,
  type Actor,
} from "./workflowHelpers";

type PilotCtx = QueryCtx | MutationCtx;
export type PilotPrincipal = Actor;

const capabilityAdminPermission: Record<PilotCapability, AdminPermissionKey> = {
  "pilot:read": "pilotRequests:read",
  "requests:review": "pilotRequests:manage",
  "supply:manage": "pilotSupply:manage",
  "offers:manage": "pilotSupply:manage",
  "quality:record": "pilotQuality:manage",
  "fulfilment:manage": "pilotFulfilment:manage",
  "custody:record": "pilotFulfilment:manage",
  "issues:manage": "pilotIssues:manage",
};

export async function requirePilotPrincipal(
  ctx: PilotCtx,
): Promise<PilotPrincipal> {
  const identity = await ctx.auth.getUserIdentity();
  assertAllowed(
    identity !== null,
    "Authentication is required for pilot access.",
  );
  assertAllowed(
    identity.subject.trim().length > 0,
    "Authenticated identity subject is missing.",
  );
  const actor = await ctx.db
    .query("users")
    .withIndex("by_auth_provider_id", (query) =>
      query.eq("authProviderId", identity.subject),
    )
    .unique();
  assertAllowed(
    actor !== null,
    "Authenticated identity is not linked to a platform user.",
  );
  assertAllowed(
    actor.status === "active",
    "Platform user must be active for pilot access.",
  );
  return actor;
}

export function assertAuthenticatedActor(
  principal: PilotPrincipal,
  actorUserId: Id<"users">,
): void {
  assertAllowed(
    principal._id === actorUserId,
    "Actor ID does not match the authenticated identity.",
  );
}

export function pilotProgrammeScopeTarget(programmeId: Id<"pilotProgrammes">) {
  return adminScopeTarget({ pilotProgrammeId: programmeId });
}

export async function requirePilotAdminPermission(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  permission: AdminPermissionKey,
) {
  assertAllowed(
    principal.role === "admin",
    "This pilot action requires an administrator.",
  );
  return await requireAdminPermission(
    ctx,
    principal._id,
    permission,
    pilotProgrammeScopeTarget(programmeId),
  );
}

export async function requirePilotAssignment(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  capability: PilotCapability,
  now = Date.now(),
): Promise<Doc<"pilotAssignments">> {
  assertAllowed(
    principal.role === "warehouse_agent",
    "A pilot operations identity is required.",
  );
  const warehouseAgent = await ctx.db
    .query("warehouseAgents")
    .withIndex("by_user", (query) => query.eq("userId", principal._id))
    .unique();
  assertAllowed(
    warehouseAgent !== null,
    "Pilot operator profile was not found.",
  );
  assertAllowed(
    warehouseAgent.status === "approved",
    "Pilot operator profile must be approved.",
  );
  const assignments = await ctx.db
    .query("pilotAssignments")
    .withIndex("by_programme_user", (query) =>
      query.eq("programmeId", programmeId).eq("userId", principal._id),
    )
    .collect();
  const assignment = assignments.find((candidate) =>
    pilotAssignmentAllows(candidate, {
      userId: principal._id,
      programmeId,
      capability,
      now,
    }),
  );
  assertAllowed(
    assignment !== undefined,
    "Active pilot assignment with the required capability was not found.",
  );
  return assignment;
}

export async function requirePilotCapability(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  capability: PilotCapability,
): Promise<void> {
  if (principal.role === "admin") {
    await requirePilotAdminPermission(
      ctx,
      principal,
      programmeId,
      capabilityAdminPermission[capability],
    );
    return;
  }
  await requirePilotAssignment(ctx, principal, programmeId, capability);
}

async function userOwnsBuyer(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  buyerId: Id<"buyers">,
): Promise<boolean> {
  if (principal.role !== "buyer") return false;
  const buyer = await ctx.db.get(buyerId);
  return buyer?.userId === principal._id;
}

async function userOwnsFarmer(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  farmerId: Id<"farmers">,
): Promise<boolean> {
  if (principal.role !== "farmer") return false;
  const farmer = await ctx.db.get(farmerId);
  return farmer?.userId === principal._id;
}

export async function requirePilotRequestRead(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  request: Doc<"pilotBuyerRequests">,
): Promise<void> {
  if (await userOwnsBuyer(ctx, principal, request.buyerId)) return;
  if (principal.role === "admin") {
    await requirePilotAdminPermission(
      ctx,
      principal,
      request.programmeId,
      "pilotRequests:read",
    );
    return;
  }
  await requirePilotAssignment(
    ctx,
    principal,
    request.programmeId,
    "pilot:read",
  );
}

export async function requirePilotLotRead(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  lot: Doc<"pilotProcurementLots">,
): Promise<void> {
  if (await userOwnsFarmer(ctx, principal, lot.farmerId)) return;
  const request = await ctx.db.get(lot.requestId);
  assertAllowed(request !== null, "Pilot request was not found.");
  if (await userOwnsBuyer(ctx, principal, request.buyerId)) return;
  if (principal.role === "transporter") {
    const plans = await ctx.db
      .query("pilotFulfilmentPlans")
      .withIndex("by_driver_status", (query) =>
        query.eq("driverUserId", principal._id),
      )
      .collect();
    for (const plan of plans) {
      if (plan.requestId !== lot.requestId) continue;
      const stops = await ctx.db
        .query("pilotFulfilmentStops")
        .withIndex("by_plan_sequence", (query) => query.eq("planId", plan._id))
        .collect();
      if (stops.some((stop) => stop.lotIds.includes(lot._id))) return;
    }
    assertAllowed(false, "Driver is not assigned to this pilot lot.");
  }
  if (principal.role === "admin") {
    await requirePilotAdminPermission(
      ctx,
      principal,
      lot.programmeId,
      "pilotQuality:read",
    );
    return;
  }
  await requirePilotAssignment(ctx, principal, lot.programmeId, "pilot:read");
}

export async function requirePilotFinancialEntryRead(
  ctx: PilotCtx,
  principal: PilotPrincipal,
  entry: Doc<"pilotFinancialEntries">,
): Promise<void> {
  if (principal.role === "admin") {
    await requirePilotAdminPermission(
      ctx,
      principal,
      entry.programmeId,
      "pilotFinance:read",
    );
    return;
  }
  assertAllowed(
    principal.role !== "transporter",
    "Drivers cannot read pilot settlements.",
  );
  const profileId =
    principal.role === "buyer"
      ? (
          await ctx.db
            .query("buyers")
            .withIndex("by_user", (query) => query.eq("userId", principal._id))
            .unique()
        )?._id
      : principal.role === "farmer"
        ? (
            await ctx.db
              .query("farmers")
              .withIndex("by_user", (query) =>
                query.eq("userId", principal._id),
              )
              .unique()
          )?._id
        : undefined;
  const ownsParty =
    profileId !== undefined &&
    ((entry.payer.id === profileId && entry.payer.kind === principal.role) ||
      (entry.payee.id === profileId && entry.payee.kind === principal.role));
  assertAllowed(ownsParty, "Financial evidence belongs to another party.");
}

export function projectPilotLotForPrincipal(
  principal: PilotPrincipal,
  lot: Doc<"pilotProcurementLots">,
  isOwnFarmerRecord: boolean,
) {
  const visibility = getPilotFieldVisibility({
    principalRole: principal.role,
    isOwnFarmerRecord,
  });
  const safe = {
    id: lot._id,
    programmeId: lot.programmeId,
    requestId: lot.requestId,
    lotCode: lot.lotCode,
    commercialMode: lot.commercialMode,
    sourceGrams: lot.sourceGrams,
    qualityStatus: lot.qualityStatus,
    clearedGrams: lot.clearedGrams,
    rejectedGrams: lot.rejectedGrams,
    titleOwnerKind: lot.titleOwnerKind,
    currentCustodianKind: lot.currentCustodianKind,
    currentLocation: lot.currentLocation,
    dispositionStatus: lot.dispositionStatus,
    version: lot.version,
  };
  if (!visibility.farmerIdentity) return safe;
  return {
    ...safe,
    farmerId: lot.farmerId,
    titleOwnerFarmerId: lot.titleOwnerFarmerId,
  };
}
