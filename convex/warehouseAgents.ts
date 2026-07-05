import { canManageWarehouseAgents } from "@kuapa-dwaso/permissions";
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
  type Actor,
} from "./workflowHelpers";

const warehouseAgentStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended"),
  v.literal("deactivated"),
);

function makeAgentCode(fullName: string, phoneNumber: string, timestamp: number, attempt: number): string {
  const nameSegment = normalizeCodeSegment(fullName, 3).padEnd(3, "X");
  const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const timeTail = String(timestamp).slice(-4);
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;

  return `WA-${nameSegment}-${phoneTail}-${timeTail}${suffix}`;
}

async function makeUniqueAgentCode(
  ctx: QueryCtx | MutationCtx,
  fullName: string,
  phoneNumber: string,
  timestamp: number,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const agentCode = makeAgentCode(fullName, phoneNumber, timestamp, attempt);
    const existing = await ctx.db
      .query("warehouseAgents")
      .withIndex("by_agent_code", (q) => q.eq("agentCode", agentCode))
      .unique();

    if (existing === null) {
      return agentCode;
    }
  }

  throw new Error("Could not generate a unique warehouse agent code.");
}

async function requireAdmin(ctx: QueryCtx | MutationCtx, actorUserId: Id<"users">): Promise<Actor> {
  const actor = await getActor(ctx, actorUserId);
  assertAllowed(canManageWarehouseAgents(actor.role), "Only admins can manage warehouse agents.");
  assertAllowed(actor.status === "active", "Admin user must be active.");

  return actor;
}

async function assignWarehousesForAgent(
  ctx: MutationCtx,
  actor: Actor,
  warehouseAgentId: Id<"warehouseAgents">,
  assignedWarehouseIds: Id<"warehouses">[],
): Promise<Id<"warehouseAgents">> {
  const warehouseAgent = await ctx.db.get(warehouseAgentId);
  assertAllowed(warehouseAgent !== null, "Warehouse agent was not found.");
  for (const warehouseId of assignedWarehouseIds) {
    const warehouse = await ctx.db.get(warehouseId);
    assertAllowed(warehouse !== null, "Assigned warehouse was not found.");
  }

  await ctx.db.patch(warehouseAgentId, {
    assignedWarehouseIds,
    updatedAt: Date.now(),
  });

  const previousWarehouseIds = new Set(warehouseAgent.assignedWarehouseIds);
  const nextWarehouseIds = new Set(assignedWarehouseIds);
  const affectedWarehouseIds = new Set([
    ...warehouseAgent.assignedWarehouseIds,
    ...assignedWarehouseIds,
  ]);

  for (const warehouseId of affectedWarehouseIds) {
    const warehouse = await ctx.db.get(warehouseId);
    if (warehouse === null) {
      continue;
    }

    const assignedWarehouseAgentIds = new Set(warehouse.assignedWarehouseAgentIds);
    if (nextWarehouseIds.has(warehouseId)) {
      assignedWarehouseAgentIds.add(warehouseAgentId);
    }
    if (previousWarehouseIds.has(warehouseId) && !nextWarehouseIds.has(warehouseId)) {
      assignedWarehouseAgentIds.delete(warehouseAgentId);
    }

    await ctx.db.patch(warehouseId, {
      assignedWarehouseAgentIds: [...assignedWarehouseAgentIds],
      updatedAt: Date.now(),
    });
  }

  const after = await ctx.db.get(warehouseAgentId);
  await insertAuditLog(ctx, {
    actor,
    action: "warehouse_agent.warehouses_assigned",
    entityType: "warehouse_agent",
    entityId: warehouseAgentId,
    before: auditSnapshot(warehouseAgent),
    after: after === null ? undefined : auditSnapshot(after),
  });

  return warehouseAgentId;
}

export const create = mutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
    fullName: v.string(),
    phoneNumber: v.string(),
    assignedWarehouseIds: v.array(v.id("warehouses")),
    status: v.optional(warehouseAgentStatus),
  },
  returns: v.id("warehouseAgents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const user = await ctx.db.get(args.userId);
    assertAllowed(user !== null, "Warehouse agent user was not found.");

    const existing = await ctx.db
      .query("warehouseAgents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    assertAllowed(existing === null, "This user already has a warehouse agent profile.");

    const now = Date.now();
    const warehouseAgentId = await ctx.db.insert("warehouseAgents", {
      userId: args.userId,
      agentCode: await makeUniqueAgentCode(ctx, args.fullName, args.phoneNumber, now),
      fullName: args.fullName,
      phoneNumber: args.phoneNumber,
      assignedWarehouseIds: args.assignedWarehouseIds,
      status: args.status ?? "pending",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.userId, {
      role: "warehouse_agent",
      updatedAt: now,
    });

    const after = await ctx.db.get(warehouseAgentId);
    await insertAuditLog(ctx, {
      actor,
      action: "warehouse_agent.created",
      entityType: "warehouse_agent",
      entityId: warehouseAgentId,
      after: after === null ? undefined : auditSnapshot(after),
    });

    return warehouseAgentId;
  },
});

export const updateStatus = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseAgentId: v.id("warehouseAgents"),
    status: warehouseAgentStatus,
    reason: v.optional(v.string()),
  },
  returns: v.id("warehouseAgents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const warehouseAgent = await ctx.db.get(args.warehouseAgentId);
    assertAllowed(warehouseAgent !== null, "Warehouse agent was not found.");

    const now = Date.now();
    await ctx.db.patch(args.warehouseAgentId, {
      status: args.status,
      approvedBy: args.status === "approved" ? args.actorUserId : warehouseAgent.approvedBy,
      approvedAt: args.status === "approved" ? now : warehouseAgent.approvedAt,
      updatedAt: now,
    });

    const userStatus = args.status === "approved" ? "active" : args.status === "suspended" ? "suspended" : undefined;
    if (userStatus !== undefined) {
      await ctx.db.patch(warehouseAgent.userId, {
        status: userStatus,
        updatedAt: now,
      });
    }

    const after = await ctx.db.get(args.warehouseAgentId);
    await insertAuditLog(ctx, {
      actor,
      action: "warehouse_agent.status_updated",
      entityType: "warehouse_agent",
      entityId: args.warehouseAgentId,
      before: auditSnapshot(warehouseAgent),
      after: after === null ? undefined : auditSnapshot(after),
      metadata: args.reason === undefined ? undefined : { reason: args.reason },
    });

    return args.warehouseAgentId;
  },
});

export const assignWarehouses = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseAgentId: v.id("warehouseAgents"),
    assignedWarehouseIds: v.array(v.id("warehouses")),
  },
  returns: v.id("warehouseAgents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    return await assignWarehousesForAgent(
      ctx,
      actor,
      args.warehouseAgentId,
      args.assignedWarehouseIds,
    );
  },
});

export const assignWarehouse = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseAgentId: v.id("warehouseAgents"),
    warehouseId: v.id("warehouses"),
  },
  returns: v.id("warehouseAgents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const warehouseAgent = await ctx.db.get(args.warehouseAgentId);
    assertAllowed(warehouseAgent !== null, "Warehouse agent was not found.");
    const assignedWarehouseIds = warehouseAgent.assignedWarehouseIds.some(
      (warehouseId) => warehouseId === args.warehouseId,
    )
      ? warehouseAgent.assignedWarehouseIds
      : [...warehouseAgent.assignedWarehouseIds, args.warehouseId];

    return await assignWarehousesForAgent(ctx, actor, args.warehouseAgentId, assignedWarehouseIds);
  },
});

export const unassignWarehouse = mutation({
  args: {
    actorUserId: v.id("users"),
    warehouseAgentId: v.id("warehouseAgents"),
    warehouseId: v.id("warehouses"),
  },
  returns: v.id("warehouseAgents"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx, args.actorUserId);
    const warehouseAgent = await ctx.db.get(args.warehouseAgentId);
    assertAllowed(warehouseAgent !== null, "Warehouse agent was not found.");

    return await assignWarehousesForAgent(
      ctx,
      actor,
      args.warehouseAgentId,
      warehouseAgent.assignedWarehouseIds.filter(
        (warehouseId) => warehouseId !== args.warehouseId,
      ),
    );
  },
});

export const getById = query({
  args: {
    actorUserId: v.id("users"),
    warehouseAgentId: v.id("warehouseAgents"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    const warehouseAgent = await ctx.db.get(args.warehouseAgentId);
    assertAllowed(
      actor.role === "admin" || warehouseAgent === null || warehouseAgent.userId === args.actorUserId,
      "Only admins or the owning warehouse agent can view this record.",
    );

    return warehouseAgent;
  },
});

export const list = query({
  args: {
    actorUserId: v.id("users"),
    status: v.optional(warehouseAgentStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can list warehouse agents.");

    const limit = Math.min(args.limit ?? 50, 100);
    return args.status === undefined
      ? await ctx.db.query("warehouseAgents").take(limit)
      : await ctx.db
          .query("warehouseAgents")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .take(limit);
  },
});

export const getByUser = query({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
  },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(
      actor.role === "admin" || actor._id === args.userId,
      "Only admins or the owning warehouse agent can view this record.",
    );

    return await ctx.db
      .query("warehouseAgents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const listByWarehouse = query({
  args: {
    actorUserId: v.id("users"),
    warehouseId: v.id("warehouses"),
    status: v.optional(warehouseAgentStatus),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const actor = await getActor(ctx, args.actorUserId);
    assertAllowed(actor.role === "admin", "Only admins can list warehouse agents by warehouse.");

    const limit = Math.min(args.limit ?? 50, 100);
    const candidates =
      args.status === undefined
        ? await ctx.db.query("warehouseAgents").take(limit * 3)
        : await ctx.db
            .query("warehouseAgents")
            .withIndex("by_status", (q) => q.eq("status", args.status!))
            .take(limit * 3);

    return candidates
      .filter((agent) =>
        agent.assignedWarehouseIds.some((warehouseId) => warehouseId === args.warehouseId),
      )
      .slice(0, limit);
  },
});
