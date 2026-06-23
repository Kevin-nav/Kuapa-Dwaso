import { canManageAgentApplications } from "@kuapa-dwaso/permissions";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  assertAllowed,
  auditSnapshot,
  getActor,
  insertAuditLog,
  normalizeCodeSegment,
  type Actor
} from "./workflowHelpers";

const agentStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended")
);

function makeAgentCode(fullName: string, phoneNumber: string, timestamp: number, attempt: number): string {
  const area = normalizeCodeSegment(fullName, 3).padEnd(3, "X");
  const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const timeTail = String(timestamp).slice(-4);
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;

  return `AG-${area}-${phoneTail}-${timeTail}${suffix}`;
}

async function makeUniqueAgentCode(
  ctx: QueryCtx | MutationCtx,
  fullName: string,
  phoneNumber: string,
  timestamp: number
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const agentCode = makeAgentCode(fullName, phoneNumber, timestamp, attempt);
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agent_code", (q) => q.eq("agentCode", agentCode))
      .unique();

    if (existing === null) {
      return agentCode;
    }
  }

  throw new Error("Could not generate a unique agent code.");
}

async function requireAdmin(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  const actor = await getActor(ctx, actorUserId);
  assertAllowed(canManageAgentApplications(actor.role), "Only admins can manage agent applications.");
  assertAllowed(actor.status === "active", "Admin user must be active.");

  return actor;
}

export const submitApplication = mutation({
  args: {
    actorUserId: v.id("users"),
    fullName: v.string(),
    phoneNumber: v.string(),
    operatingAreas: v.array(v.string())
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "agent" || actor.role === "admin", "Only agent users can submit applications.");
    assertAllowed(args.operatingAreas.length > 0, "At least one operating area is required.");

    const now = Date.now();
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_user", (q) => q.eq("userId", args.actorUserId))
      .unique();

    if (existing !== null) {
      assertAllowed(existing.status === "rejected", "This user already has an agent application.");

      const patch = {
        fullName: args.fullName,
        phoneNumber: args.phoneNumber,
        operatingAreas: args.operatingAreas,
        status: "pending" as const,
        updatedAt: now
      };
      await ctx.db.patch(existing._id, patch);
      const after = await ctx.db.get(existing._id);

      await insertAuditLog(ctx, {
        actor,
        action: "agent.application_resubmitted",
        entityType: "agent",
        entityId: existing._id,
        before: auditSnapshot(existing),
        after: after === null ? undefined : auditSnapshot(after)
      });

      return existing._id;
    }

    const agentId = await ctx.db.insert("agents", {
      userId: args.actorUserId,
      agentCode: await makeUniqueAgentCode(ctx, args.fullName, args.phoneNumber, now),
      fullName: args.fullName,
      phoneNumber: args.phoneNumber,
      operatingAreas: args.operatingAreas,
      status: "pending",
      createdAt: now,
      updatedAt: now
    });

    const after = await ctx.db.get(agentId);
    await insertAuditLog(ctx, {
      actor,
      action: "agent.application_submitted",
      entityType: "agent",
      entityId: agentId,
      after: after === null ? undefined : auditSnapshot(after)
    });

    return agentId;
  }
});

export const approve = mutation({
  args: {
    actorUserId: v.id("users"),
    agentId: v.id("agents")
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const agent = await ctx.db.get(args.agentId);
    assertAllowed(agent !== null, "Agent was not found.");
    assertAllowed(agent.status === "pending", "Only pending agent applications can be approved.");

    const now = Date.now();
    await ctx.db.patch(args.agentId, {
      status: "approved",
      approvedBy: args.actorUserId,
      approvedAt: now,
      updatedAt: now
    });
    await ctx.db.patch(agent.userId, {
      role: "agent",
      status: "active",
      updatedAt: now
    });

    const after = await ctx.db.get(args.agentId);
    await insertAuditLog(ctx, {
      actor,
      action: "agent.approved",
      entityType: "agent",
      entityId: args.agentId,
      before: auditSnapshot(agent),
      after: after === null ? undefined : auditSnapshot(after)
    });

    return args.agentId;
  }
});

export const reject = mutation({
  args: {
    actorUserId: v.id("users"),
    agentId: v.id("agents"),
    reason: v.optional(v.string())
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const agent = await ctx.db.get(args.agentId);
    assertAllowed(agent !== null, "Agent was not found.");
    assertAllowed(agent.status === "pending", "Only pending agent applications can be rejected.");

    const now = Date.now();
    await ctx.db.patch(args.agentId, {
      status: "rejected",
      updatedAt: now
    });
    await ctx.db.patch(agent.userId, {
      status: "rejected",
      updatedAt: now
    });

    const after = await ctx.db.get(args.agentId);
    await insertAuditLog(ctx, {
      actor,
      action: "agent.rejected",
      entityType: "agent",
      entityId: args.agentId,
      before: auditSnapshot(agent),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason }
    });

    return args.agentId;
  }
});

export const suspend = mutation({
  args: {
    actorUserId: v.id("users"),
    agentId: v.id("agents"),
    reason: v.optional(v.string())
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const agent = await ctx.db.get(args.agentId);
    assertAllowed(agent !== null, "Agent was not found.");
    assertAllowed(agent.status === "approved", "Only approved agents can be suspended.");

    const now = Date.now();
    await ctx.db.patch(args.agentId, {
      status: "suspended",
      updatedAt: now
    });
    await ctx.db.patch(agent.userId, {
      status: "suspended",
      updatedAt: now
    });

    const after = await ctx.db.get(args.agentId);
    await insertAuditLog(ctx, {
      actor,
      action: "agent.suspended",
      entityType: "agent",
      entityId: args.agentId,
      before: auditSnapshot(agent),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason }
    });

    return args.agentId;
  }
});

export const unsuspend = mutation({
  args: {
    actorUserId: v.id("users"),
    agentId: v.id("agents")
  },
  returns: v.id("agents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const agent = await ctx.db.get(args.agentId);
    assertAllowed(agent !== null, "Agent was not found.");
    assertAllowed(agent.status === "suspended", "Only suspended agents can be unsuspended.");

    const now = Date.now();
    await ctx.db.patch(args.agentId, {
      status: "approved",
      updatedAt: now
    });
    await ctx.db.patch(agent.userId, {
      status: "active",
      updatedAt: now
    });

    const after = await ctx.db.get(args.agentId);
    await insertAuditLog(ctx, {
      actor,
      action: "agent.unsuspended",
      entityType: "agent",
      entityId: args.agentId,
      before: auditSnapshot(agent),
      after: after === null ? undefined : auditSnapshot(after)
    });

    return args.agentId;
  }
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    agentId: v.id("agents")
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const agent = await ctx.db.get(args.agentId);
    assertAllowed(
      actor.role === "admin" || agent === null || agent.userId === args.actorUserId,
      "Only admins or the owning agent can view this agent record."
    );

    return agent;
  }
});

export const list = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(agentStatus),
    area: v.optional(v.string()),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can list agent applications.");

    const limit = Math.min(args.limit ?? 50, 100);
    const status = args.status;
    const agents =
      status === undefined
        ? await ctx.db.query("agents").take(200)
        : await ctx.db
            .query("agents")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(200);

    const normalizedArea = args.area?.trim().toLowerCase();
    return agents
      .filter((agent) => {
        if (normalizedArea === undefined || normalizedArea.length === 0) {
          return true;
        }

        return agent.operatingAreas.some((area) => area.trim().toLowerCase() === normalizedArea);
      })
      .slice(0, limit);
  }
});
