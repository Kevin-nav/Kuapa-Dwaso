import { v } from "convex/values";
import { query } from "./_generated/server";
import { resolveRequestingRole } from "./observabilityAccess";
import {
  adminAccessHasPermissionForScope,
  dispatchScopeTarget,
  getEffectiveAdminAccess,
  requireAdminPermission,
  warehouseScopeTarget,
} from "./workflowHelpers";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin"),
);

function assertCanViewAdminObservability(
  role: "farmer" | "warehouse_agent" | "buyer" | "transporter" | "admin",
): void {
  if (role !== "admin") {
    throw new Error("Only admins can view platform observability.");
  }
}

export const getPlatformSummaryCounts = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
  },
  returns: v.object({
    farmers: v.number(),
    warehouseAgents: v.number(),
    warehouses: v.number(),
    buyers: v.number(),
    transporterProfiles: v.number(),
    inventoryBatches: v.number(),
    availableInventoryBatches: v.number(),
    buyerOrders: v.number(),
    saleRecords: v.number(),
    soldQuantity: v.number(),
    grossSalesAmount: v.number(),
    netFarmerAmountDue: v.number(),
    salePaymentStatusCounts: v.object({
      pending: v.number(),
      part_paid: v.number(),
      paid: v.number(),
      withheld: v.number(),
      disputed: v.number(),
    }),
    dispatches: v.number(),
    dispatchStatusCounts: v.object({
      planned: v.number(),
      loading: v.number(),
      departed: v.number(),
      in_transit: v.number(),
      arrived: v.number(),
      delivered: v.number(),
      closed: v.number(),
      cancelled: v.number(),
      issue_reported: v.number(),
    }),
    inTransitDispatches: v.number(),
    deliveredDispatches: v.number(),
    issueDispatches: v.number(),
    disputes: v.number(),
    openDisputes: v.number(),
  }),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanViewAdminObservability(role);
    if (args.requestingUserId === undefined) {
      throw new Error("Admin reporting requires requestingUserId.");
    }
    const access = await getEffectiveAdminAccess(ctx, args.requestingUserId);
    await requireAdminPermission(ctx, args.requestingUserId, "reports:read", {});

    const [
      farmers,
      warehouseAgents,
      warehouses,
      buyers,
      transporterProfiles,
      inventoryBatches,
      availableInventoryBatches,
      buyerOrders,
      saleRecords,
      dispatches,
      disputes,
      openDisputes,
    ] = await Promise.all([
      ctx.db.query("farmers").collect(),
      ctx.db.query("warehouseAgents").collect(),
      ctx.db.query("warehouses").collect(),
      ctx.db.query("buyers").collect(),
      ctx.db.query("transporterProfiles").collect(),
      ctx.db.query("inventoryBatches").collect(),
      ctx.db
        .query("inventoryBatches")
        .withIndex("by_status", (q) => q.eq("status", "available"))
        .collect(),
      ctx.db.query("buyerOrders").collect(),
      ctx.db.query("saleRecords").collect(),
      ctx.db.query("dispatches").collect(),
      ctx.db.query("disputes").collect(),
      ctx.db
        .query("disputes")
        .withIndex("by_status", (q) => q.eq("status", "open"))
        .collect(),
    ]);

    const scopedWarehouses = [];
    for (const warehouse of warehouses) {
      if (adminAccessHasPermissionForScope(access, "reports:read", await warehouseScopeTarget(ctx, warehouse._id))) {
        scopedWarehouses.push(warehouse);
      }
    }
    const scopedWarehouseIds = new Set(scopedWarehouses.map((warehouse) => warehouse._id));
    const scopedInventoryBatches = inventoryBatches.filter((batch) => scopedWarehouseIds.has(batch.warehouseId));
    const scopedAvailableInventoryBatches = availableInventoryBatches.filter((batch) => scopedWarehouseIds.has(batch.warehouseId));
    const scopedSaleRecords = saleRecords.filter((sale) => scopedWarehouseIds.has(sale.warehouseId));
    const scopedDispatches = dispatches.filter((dispatch) => scopedWarehouseIds.has(dispatch.warehouseId));
    const scopedDisputes = disputes.filter((dispute) => dispute.warehouseId !== undefined && scopedWarehouseIds.has(dispute.warehouseId));
    const scopedOpenDisputes = openDisputes.filter((dispute) => dispute.warehouseId !== undefined && scopedWarehouseIds.has(dispute.warehouseId));

    const salePaymentStatusCounts = {
      pending: 0,
      part_paid: 0,
      paid: 0,
      withheld: 0,
      disputed: 0,
    };
    let soldQuantity = 0;
    let grossSalesAmount = 0;
    let netFarmerAmountDue = 0;
    for (const sale of scopedSaleRecords) {
      soldQuantity += sale.quantitySold;
      grossSalesAmount += sale.grossAmount;
      netFarmerAmountDue += sale.netAmountDueToFarmer;
      salePaymentStatusCounts[sale.paymentStatus] += 1;
    }
    const dispatchStatusCounts = {
      planned: 0,
      loading: 0,
      departed: 0,
      in_transit: 0,
      arrived: 0,
      delivered: 0,
      closed: 0,
      cancelled: 0,
      issue_reported: 0,
    };
    for (const dispatch of scopedDispatches) {
      dispatchStatusCounts[dispatch.status] += 1;
    }

    return {
      farmers: farmers.length,
      warehouseAgents: warehouseAgents.length,
      warehouses: scopedWarehouses.length,
      buyers: buyers.length,
      transporterProfiles: transporterProfiles.length,
      inventoryBatches: scopedInventoryBatches.length,
      availableInventoryBatches: scopedAvailableInventoryBatches.length,
      buyerOrders: buyerOrders.length,
      saleRecords: scopedSaleRecords.length,
      soldQuantity,
      grossSalesAmount,
      netFarmerAmountDue,
      salePaymentStatusCounts,
      dispatches: scopedDispatches.length,
      dispatchStatusCounts,
      inTransitDispatches:
        dispatchStatusCounts.departed + dispatchStatusCounts.in_transit + dispatchStatusCounts.arrived,
      deliveredDispatches: dispatchStatusCounts.delivered + dispatchStatusCounts.closed,
      issueDispatches: dispatchStatusCounts.issue_reported,
      disputes: scopedDisputes.length,
      openDisputes: scopedOpenDisputes.length,
    };
  },
});

export const getDispatchRouteSummaries = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    warehouseId: v.optional(v.id("warehouses")),
    destination: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanViewAdminObservability(role);
    if (args.requestingUserId === undefined) {
      throw new Error("Admin reporting requires requestingUserId.");
    }
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const destination = args.destination?.trim();
    const access = await getEffectiveAdminAccess(ctx, args.requestingUserId);
    const dispatches =
      args.warehouseId !== undefined
        ? await ctx.db
            .query("dispatches")
            .withIndex("by_warehouse_status", (q) => q.eq("warehouseId", args.warehouseId!))
            .take(500)
        : await ctx.db.query("dispatches").take(500);
    const summaries = new Map<string, Record<string, unknown>>();

    for (const dispatch of dispatches) {
      if (args.warehouseId !== undefined && dispatch.warehouseId !== args.warehouseId) {
        continue;
      }
      if (destination !== undefined && dispatch.destination !== destination) {
        continue;
      }
      if (!adminAccessHasPermissionForScope(access, "reports:read", await dispatchScopeTarget(ctx, dispatch))) {
        continue;
      }
      const key = `${dispatch.warehouseId}|${dispatch.destination}`;
      const existing = summaries.get(key);
      const statusCounts = {
        ...((existing?.statusCounts as Record<string, number> | undefined) ?? {}),
      };
      statusCounts[dispatch.status] = (statusCounts[dispatch.status] ?? 0) + 1;
      const transportCostTotal =
        ((existing?.transportCostTotal as number | undefined) ?? 0) +
        (dispatch.transportCost ?? 0);
      const dispatchCount = ((existing?.dispatchCount as number | undefined) ?? 0) + 1;

      summaries.set(key, {
        warehouseId: dispatch.warehouseId,
        destination: dispatch.destination,
        dispatchCount,
        totalQuantity: ((existing?.totalQuantity as number | undefined) ?? 0) + dispatch.totalQuantity,
        unit: dispatch.unit,
        transportCostTotal,
        averageTransportCost: transportCostTotal / dispatchCount,
        statusCounts,
      });
    }

    return [...summaries.values()].slice(0, limit);
  },
});

export const listRecentActivity = query({
  args: {
    requestingUserId: v.optional(v.id("users")),
    requestingActorRole: v.optional(marketplaceRole),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const role = await resolveRequestingRole(ctx.db, args);
    assertCanViewAdminObservability(role);
    if (args.requestingUserId === undefined) {
      throw new Error("Admin activity access requires requestingUserId.");
    }
    await requireAdminPermission(ctx, args.requestingUserId, "auditLogs:read", {});

    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});
