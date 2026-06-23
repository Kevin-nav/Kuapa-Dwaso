import {
  canAssignFarmerToAgent,
  canCompleteFarmerProfile,
  canCreateFarmerProfile,
  canRejectFarmer,
  canVerifyFarmer
} from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  assertAllowed,
  auditSnapshot,
  cleanOptionalText,
  getActor,
  insertAuditLog,
  normalizeCodeSegment,
  type Actor
} from "./workflowHelpers";

const verificationStatus = v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"));

function makeFarmerCode(community: string, phoneNumber: string, timestamp: number, attempt: number): string {
  const communitySegment = normalizeCodeSegment(community, 3).padEnd(3, "X");
  const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const timeTail = String(timestamp).slice(-4);
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;

  return `FM-${communitySegment}-${phoneTail}-${timeTail}${suffix}`;
}

async function makeUniqueFarmerCode(
  ctx: QueryCtx | MutationCtx,
  community: string,
  phoneNumber: string,
  timestamp: number
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const farmerCode = makeFarmerCode(community, phoneNumber, timestamp, attempt);
    const existing = await ctx.db
      .query("farmers")
      .withIndex("by_farmer_code", (q) => q.eq("farmerCode", farmerCode))
      .unique();

    if (existing === null) {
      return farmerCode;
    }
  }

  throw new Error("Could not generate a unique farmer code.");
}

async function getApprovedAgentForUser(
  ctx: QueryCtx | MutationCtx,
  actorUserId: Id<"users">
): Promise<Doc<"agents">> {
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_user", (q) => q.eq("userId", actorUserId))
    .unique();
  assertAllowed(agent !== null, "Actor does not have an agent profile.");
  assertAllowed(agent.status === "approved", "Agent profile must be approved.");

  return agent;
}

async function getApprovedAgentById(ctx: QueryCtx | MutationCtx, agentId: Id<"agents">): Promise<Doc<"agents">> {
  const agent = await ctx.db.get(agentId);
  assertAllowed(agent !== null, "Assigned agent was not found.");
  assertAllowed(agent.status === "approved", "Assigned agent must be approved.");

  return agent;
}

async function resolveWritableFarmerAgent(
  ctx: QueryCtx | MutationCtx,
  actor: Actor,
  farmer: Doc<"farmers">
): Promise<Id<"agents"> | undefined> {
  if (actor.role === "admin") {
    return farmer.assignedAgentId;
  }

  const agent = await getApprovedAgentForUser(ctx, actor._id);
  assertAllowed(
    farmer.assignedAgentId === undefined || farmer.assignedAgentId === agent._id,
    "Agents can only manage unassigned farmers or their assigned farmers."
  );

  return agent._id;
}

function assertCanViewFarmer(actor: Actor, farmer: Doc<"farmers">, actorAgentId: Id<"agents"> | undefined): void {
  assertAllowed(
    actor.role === "admin" || farmer.userId === actor._id || farmer.assignedAgentId === actorAgentId,
    "Actor cannot view this farmer."
  );
}

export const createLead = mutation({
  args: {
    actorUserId: v.id("users"),
    fullName: v.string(),
    phoneNumber: v.string(),
    community: v.string(),
    region: v.optional(v.string()),
    assignedAgentId: v.optional(v.id("agents")),
    registrationSource: v.optional(v.union(v.literal("agent"), v.literal("web")))
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canCreateFarmerProfile(actor.role), "Actor cannot create farmer profiles.");

    const existingByPhone = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    assertAllowed(existingByPhone === null, "A farmer with this phone number already exists.");

    let assignedAgentId = args.assignedAgentId;
    if (actor.role === "agent") {
      const agent = await getApprovedAgentForUser(ctx, actor._id);
      if (assignedAgentId !== undefined) {
        assertAllowed(assignedAgentId === agent._id, "Agents can only assign new farmers to themselves.");
      }
      assignedAgentId = agent._id;
    } else if (assignedAgentId !== undefined) {
      await getApprovedAgentById(ctx, assignedAgentId);
    }

    const now = Date.now();
    const farmerProfile: {
      farmerCode: string;
      fullName: string;
      phoneNumber: string;
      community: string;
      region?: string;
      assignedAgentId?: Id<"agents">;
      registrationSource: "agent" | "web";
      verificationStatus: "pending";
      createdAt: number;
      updatedAt: number;
    } = {
      farmerCode: await makeUniqueFarmerCode(ctx, args.community, args.phoneNumber, now),
      fullName: args.fullName,
      phoneNumber: args.phoneNumber,
      community: args.community,
      registrationSource: args.registrationSource ?? (actor.role === "agent" ? "agent" : "web"),
      verificationStatus: "pending",
      createdAt: now,
      updatedAt: now
    };
    const region = cleanOptionalText(args.region);
    if (region !== undefined) {
      farmerProfile.region = region;
    }
    if (assignedAgentId !== undefined) {
      farmerProfile.assignedAgentId = assignedAgentId;
    }

    const farmerId = await ctx.db.insert("farmers", farmerProfile);

    const after = await ctx.db.get(farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.lead_created",
      entityType: "farmer",
      entityId: farmerId,
      after: after === null ? undefined : auditSnapshot(after),
      metadata: { source: "non_sms" }
    });

    return farmerId;
  }
});

export const completeProfile = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    community: v.optional(v.string()),
    region: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    assignedAgentId: v.optional(v.id("agents"))
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canCompleteFarmerProfile(actor.role), "Actor cannot complete farmer profiles.");

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");

    const actorAssignedAgentId = await resolveWritableFarmerAgent(ctx, actor, farmer);
    let nextAssignedAgentId = farmer.assignedAgentId;
    if (actor.role === "admin" && args.assignedAgentId !== undefined) {
      await getApprovedAgentById(ctx, args.assignedAgentId);
      nextAssignedAgentId = args.assignedAgentId;
    } else if (actor.role === "agent" && farmer.assignedAgentId === undefined) {
      nextAssignedAgentId = actorAssignedAgentId;
    }

    if (args.phoneNumber !== undefined && args.phoneNumber !== farmer.phoneNumber) {
      throw new Error("Changing a farmer phone number requires a dedicated approval workflow.");
    }

    const now = Date.now();
    await ctx.db.patch(args.farmerId, {
      fullName: args.fullName ?? farmer.fullName,
      community: args.community ?? farmer.community,
      region: args.region === undefined ? farmer.region : cleanOptionalText(args.region),
      userId: args.userId ?? farmer.userId,
      assignedAgentId: nextAssignedAgentId,
      updatedAt: now
    });

    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.profile_completed",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after)
    });

    return args.farmerId;
  }
});

export const assignToAgent = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    agentId: v.id("agents")
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canAssignFarmerToAgent(actor.role), "Only admins can assign farmers to agents.");

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");
    await getApprovedAgentById(ctx, args.agentId);

    const now = Date.now();
    await ctx.db.patch(args.farmerId, {
      assignedAgentId: args.agentId,
      updatedAt: now
    });

    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.assigned_to_agent",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after)
    });

    return args.farmerId;
  }
});

export const verify = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers")
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canVerifyFarmer(actor.role), "Only admins can verify farmers.");

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");

    const now = Date.now();
    await ctx.db.patch(args.farmerId, {
      verificationStatus: "verified",
      updatedAt: now
    });

    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.verified",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after)
    });

    return args.farmerId;
  }
});

export const reject = mutation({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers"),
    reason: v.optional(v.string())
  },
  returns: v.id("farmers"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(canRejectFarmer(actor.role), "Only admins can reject farmers.");

    const farmer = await ctx.db.get(args.farmerId);
    assertAllowed(farmer !== null, "Farmer was not found.");

    const now = Date.now();
    await ctx.db.patch(args.farmerId, {
      verificationStatus: "rejected",
      updatedAt: now
    });

    const after = await ctx.db.get(args.farmerId);
    await insertAuditLog(ctx, {
      actor,
      action: "farmer.rejected",
      entityType: "farmer",
      entityId: args.farmerId,
      before: auditSnapshot(farmer),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason }
    });

    return args.farmerId;
  }
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    farmerId: v.id("farmers")
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db.get(args.farmerId);
    if (farmer === null) {
      return null;
    }

    const actorAgent = actor.role === "agent" ? await getApprovedAgentForUser(ctx, actor._id) : undefined;
    assertCanViewFarmer(actor, farmer, actorAgent?._id);

    return farmer;
  }
});

export const getByFarmerCode = query({
  args: {
    actorUserId: v.id("users"),
    farmerCode: v.string()
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_farmer_code", (q) => q.eq("farmerCode", args.farmerCode))
      .unique();
    if (farmer === null) {
      return null;
    }

    const actorAgent = actor.role === "agent" ? await getApprovedAgentForUser(ctx, actor._id) : undefined;
    assertCanViewFarmer(actor, farmer, actorAgent?._id);

    return farmer;
  }
});

export const getByPhoneNumber = query({
  args: {
    actorUserId: v.id("users"),
    phoneNumber: v.string()
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const farmer = await ctx.db
      .query("farmers")
      .withIndex("by_phone_number", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (farmer === null) {
      return null;
    }

    const actorAgent = actor.role === "agent" ? await getApprovedAgentForUser(ctx, actor._id) : undefined;
    assertCanViewFarmer(actor, farmer, actorAgent?._id);

    return farmer;
  }
});

export const listByAssignedAgent = query({
  args: {
    actorUserId: v.id("users"),
    agentId: v.optional(v.id("agents")),
    verificationStatus: v.optional(verificationStatus),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const limit = Math.min(args.limit ?? 50, 100);
    let agentId = args.agentId;

    if (actor.role === "agent") {
      const agent = await getApprovedAgentForUser(ctx, actor._id);
      assertAllowed(agentId === undefined || agentId === agent._id, "Agents can only list their assigned farmers.");
      agentId = agent._id;
    } else {
      assertAllowed(actor.role === "admin", "Only admins and agents can list assigned farmers.");
      assertAllowed(agentId !== undefined, "Admin queries must include an agentId.");
    }

    const status = args.verificationStatus;
    if (status !== undefined) {
      return await ctx.db
        .query("farmers")
        .withIndex("by_assigned_agent_verification_status", (q) =>
          q.eq("assignedAgentId", agentId).eq("verificationStatus", status)
        )
        .take(limit);
    }

    return await ctx.db
      .query("farmers")
      .withIndex("by_assigned_agent", (q) => q.eq("assignedAgentId", agentId))
      .take(limit);
  }
});

export const listByVerificationStatus = query({
  args: {
    actorUserId: v.id("users"),
    verificationStatus,
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can list farmers by verification status.");

    return await ctx.db
      .query("farmers")
      .withIndex("by_verification_status", (q) => q.eq("verificationStatus", args.verificationStatus))
      .take(Math.min(args.limit ?? 50, 100));
  }
});
