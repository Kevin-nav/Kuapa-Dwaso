import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import {
  requirePilotAdminPermission,
  requirePilotPrincipal,
  type PilotPrincipal,
} from "./pilotAccess";
import { assertAllowed, requireAdminPermission } from "./workflowHelpers";

const source = v.union(v.literal("pilot_request"), v.literal("warehouse_run"));

type Pagination = { cursor: string | null; numItems: number };

async function requireBuyer(
  ctx: QueryCtx,
  principal: PilotPrincipal,
): Promise<Doc<"buyers">> {
  assertAllowed(principal.role === "buyer", "A buyer identity is required.");
  const buyer = await ctx.db
    .query("buyers")
    .withIndex("by_user", (q) => q.eq("userId", principal._id))
    .unique();
  assertAllowed(
    buyer !== null && buyer.status === "active",
    "Active buyer profile was not found.",
  );
  return buyer;
}

async function listPilotRequestRefs(
  ctx: QueryCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  pagination: Pagination,
) {
  let result;
  if (principal.role === "buyer") {
    const buyer = await requireBuyer(ctx, principal);
    result = await ctx.db
      .query("pilotBuyerRequests")
      .withIndex("by_buyer_programme_status", (q) =>
        q.eq("buyerId", buyer._id).eq("programmeId", programmeId),
      )
      .order("desc")
      .paginate(pagination);
  } else {
    await requirePilotAdminPermission(
      ctx,
      principal,
      programmeId,
      "pilotRequests:read",
    );
    result = await ctx.db
      .query("pilotBuyerRequests")
      .withIndex("by_programme_status", (q) => q.eq("programmeId", programmeId))
      .order("desc")
      .paginate(pagination);
  }
  return {
    page: result.page.map((request) => ({
      orderRef: {
        source: "pilot_request" as const,
        pilotRequestId: request._id,
      },
      buyerId: request.buyerId,
      status: request.status,
      requestedGrams: request.requestedGrams,
      confirmedGrams: request.confirmedGrams,
      destinationLabel: request.destination.label,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    })),
    ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
    isDone: result.isDone,
  };
}

async function listWarehouseOrderRefs(
  ctx: QueryCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  pagination: Pagination,
) {
  let result;
  if (principal.role === "buyer") {
    const buyer = await requireBuyer(ctx, principal);
    result = await ctx.db
      .query("buyerOrders")
      .withIndex("by_buyer", (q) => q.eq("buyerId", buyer._id))
      .order("desc")
      .paginate(pagination);
  } else {
    assertAllowed(
      principal.role === "admin",
      "Only buyers and administrators can list order references.",
    );
    await requirePilotAdminPermission(
      ctx,
      principal,
      programmeId,
      "pilotRequests:read",
    );
    await requireAdminPermission(ctx, principal._id, "orders:read", {});
    result = await ctx.db
      .query("buyerOrders")
      .order("desc")
      .paginate(pagination);
  }
  return {
    page: result.page.map((order) => ({
      orderRef: {
        source: "warehouse_run" as const,
        buyerOrderId: order._id,
      },
      buyerId: order.buyerId,
      status: order.status,
      requestedQuantity: order.requestedQuantity,
      unit: order.unit,
      destinationLabel: order.destinationMarket,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })),
    ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
    isDone: result.isDone,
  };
}

export const listOrderRefs = query({
  args: {
    programmeId: v.id("pilotProgrammes"),
    source,
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    const pagination = {
      cursor: args.cursor ?? null,
      numItems: args.limit,
    };
    return args.source === "pilot_request"
      ? listPilotRequestRefs(ctx, principal, args.programmeId, pagination)
      : listWarehouseOrderRefs(ctx, principal, args.programmeId, pagination);
  },
});
