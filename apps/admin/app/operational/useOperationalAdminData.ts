"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import type { AdminPermissionKey } from "@kuapa-dwaso/permissions";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAdminAuth } from "../auth/AdminAuthProvider";

// Dashboard rows are intentionally open-shaped after Convex records are projected for generic tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConvexRecord = Record<string, any> & { _id: string };
type EffectiveAccess = {
  permissions: string[];
  isPlatformOwner: boolean;
  roles: unknown[];
  generatedAt: number;
};

function withId(record: ConvexRecord): ConvexRecord {
  return {
    ...record,
    id: record._id,
  };
}

function mapRecords(records: ConvexRecord[] | undefined): ConvexRecord[] {
  return (records ?? []).map(withId);
}

function mapAuditLog(record: ConvexRecord): ConvexRecord {
  return {
    ...record,
    id: record._id,
    actorName: String(record.actorName ?? record.actorId ?? "Unknown actor"),
    actorRole: String(record.actorRole ?? "system"),
  };
}

function mapDispute(record: ConvexRecord): ConvexRecord {
  const entityType = String(record.entityType ?? "record");
  const shortId = String(record._id).slice(-6);
  return {
    ...record,
    id: record._id,
    title: `${entityType.replace(/_/g, " ")} dispute ${shortId}`,
    resolutionNotes: record.resolution,
  };
}

export function useOperationalAdminData() {
  const { firebaseUser, principal, isLoading: isAuthLoading } = useAdminAuth();
  const actorUserId =
    principal?.role === "admin" && principal.status === "active"
      ? (principal.userId as Id<"users">)
      : undefined;

  const effectiveAccess = useQuery(
    api.adminAccess.getEffectiveAccess,
    actorUserId === undefined ? "skip" : { actorUserId, adminUserId: actorUserId },
  ) as EffectiveAccess | undefined;

  const permissionSet = useMemo(
    () => new Set((effectiveAccess?.permissions ?? []) as AdminPermissionKey[]),
    [effectiveAccess],
  );
  const hasPermission = (permission: AdminPermissionKey) => permissionSet.has(permission);

  const canReadWarehouses = hasPermission("warehouses:read");
  const canReadAgents = hasPermission("warehouseAgents:read");
  const canReadFarmers = hasPermission("farmers:read");
  const canReadBuyers = hasPermission("buyers:read");
  const canReadFees = hasPermission("fees:read");
  const canReadInventory = hasPermission("inventory:read");
  const canReadDisputes = hasPermission("disputes:read");
  const canReadAudit = hasPermission("auditLogs:read");
  const canReadOrders = hasPermission("orders:read");
  const canReadSales = hasPermission("sales:read");
  const canReadDispatches = hasPermission("dispatches:read");
  const canReadTransporters = hasPermission("transporters:read");
  const canReadReports = hasPermission("reports:read");
  const canReadNotifications = hasPermission("notifications:read");
  const canReadUploads = hasPermission("uploads:read");
  const canReadPayments = hasPermission("payments:read");
  const canReadPayouts = hasPermission("payouts:read");

  const warehousesQuery = useQuery(
    api.warehouses.list,
    actorUserId === undefined || !canReadWarehouses ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const agentsQuery = useQuery(
    api.warehouseAgents.list,
    actorUserId === undefined || !canReadAgents ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const farmersQuery = useQuery(
    api.farmers.list,
    actorUserId === undefined || !canReadFarmers ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const buyersQuery = useQuery(
    api.buyers.list,
    actorUserId === undefined || !canReadBuyers ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const feeRulesQuery = useQuery(
    api.feeRules.list,
    actorUserId === undefined || !canReadFees ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const storageFeeLedgerQuery = useQuery(
    api.storageFees.listForAdmin,
    actorUserId === undefined || !canReadFees ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const inventoryQuery = useQuery(
    api.inventoryBatches.listForAdmin,
    actorUserId === undefined || !canReadInventory ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const disputesQuery = useQuery(
    api.disputes.list,
    actorUserId === undefined || !canReadDisputes
      ? "skip"
      : { requestingUserId: actorUserId, requestingActorRole: "admin", limit: 100 },
  ) as ConvexRecord[] | undefined;
  const auditLogsQuery = useQuery(
    api.auditLogs.list,
    actorUserId === undefined || !canReadAudit
      ? "skip"
      : { requestingUserId: actorUserId, requestingActorRole: "admin", limit: 100 },
  ) as ConvexRecord[] | undefined;
  const ordersQuery = useQuery(
    api.buyerOrders.listForOperations,
    actorUserId === undefined || !canReadOrders ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const salesQuery = useQuery(
    api.sales.listForOperations,
    actorUserId === undefined || !canReadSales ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const dispatchesQuery = useQuery(
    api.dispatches.listForOperations,
    actorUserId === undefined || !canReadDispatches ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const transportersQuery = useQuery(
    api.transporters.list,
    actorUserId === undefined || !canReadTransporters ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const notificationsQuery = useQuery(
    api.notifications.listForAdmin,
    actorUserId === undefined || !canReadNotifications ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const paymentsQuery = useQuery(
    api.payments.listPaymentsForFinance,
    actorUserId === undefined || !canReadPayments ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const paymentWebhookEventsQuery = useQuery(
    api.payments.listWebhookEventsForFinance,
    actorUserId === undefined || !canReadPayments ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const payoutLedgerQuery = useQuery(
    api.payments.listPayoutLedgerForFinance,
    actorUserId === undefined || !canReadPayouts ? "skip" : { actorUserId, limit: 100 },
  ) as ConvexRecord[] | undefined;
  const platformSummary = useQuery(
    api.admin.getPlatformSummaryCounts,
    actorUserId === undefined || !canReadReports
      ? "skip"
      : { requestingUserId: actorUserId, requestingActorRole: "admin" },
  ) as Record<string, unknown> | undefined;

  const updateWarehouseStatusMutation = useMutation(api.warehouses.updateStatus);
  const updateAgentStatusMutation = useMutation(api.warehouseAgents.updateStatus);
  const assignWarehousesMutation = useMutation(api.warehouseAgents.assignWarehouses);
  const updateFarmerVerificationMutation = useMutation(api.farmers.updateVerificationStatus);
  const updateBuyerVerificationMutation = useMutation(api.buyers.updateVerificationStatus);
  const updateDisputeStatusMutation = useMutation(api.disputes.updateStatus);
  const replaceFeeRuleMutation = useMutation(api.feeRules.replace);
  const reconcilePaymentMutation = useMutation(api.payments.adminReconcilePayment);
  const markPaymentManualReviewMutation = useMutation(api.payments.adminMarkPaymentManualReview);
  const updatePayoutStatusMutation = useMutation(api.payments.adminUpdatePayoutStatus);

  const requireActorUserId = () => {
    if (actorUserId === undefined) {
      throw new Error("An active admin principal is required.");
    }
    return actorUserId;
  };

  const isReady = actorUserId !== undefined && effectiveAccess !== undefined;
  const isAccessLoading = actorUserId !== undefined && effectiveAccess === undefined;
  const loadingQueries = [
    canReadWarehouses ? warehousesQuery : [],
    canReadAgents ? agentsQuery : [],
    canReadFarmers ? farmersQuery : [],
    canReadBuyers ? buyersQuery : [],
    canReadFees ? feeRulesQuery : [],
    canReadFees ? storageFeeLedgerQuery : [],
    canReadInventory ? inventoryQuery : [],
    canReadDisputes ? disputesQuery : [],
    canReadAudit ? auditLogsQuery : [],
    canReadOrders ? ordersQuery : [],
    canReadSales ? salesQuery : [],
    canReadDispatches ? dispatchesQuery : [],
    canReadTransporters ? transportersQuery : [],
    canReadNotifications ? notificationsQuery : [],
    canReadPayments ? paymentsQuery : [],
    canReadPayments ? paymentWebhookEventsQuery : [],
    canReadPayouts ? payoutLedgerQuery : [],
    canReadReports ? platformSummary : {},
  ];

  const isDataLoading = isAccessLoading || (isReady && loadingQueries.some((value) => value === undefined));

  const warehouses = mapRecords(warehousesQuery);
  const agents = mapRecords(agentsQuery);
  const farmers = mapRecords(farmersQuery);
  const buyers = mapRecords(buyersQuery);
  const feeRules = mapRecords(feeRulesQuery);
  const storageFeeLedger = mapRecords(storageFeeLedgerQuery);
  const inventory = mapRecords(inventoryQuery);
  const disputes = (disputesQuery ?? []).map(mapDispute);
  const auditLogs = (auditLogsQuery ?? []).map(mapAuditLog);
  const orders = mapRecords(ordersQuery);
  const sales = mapRecords(salesQuery);
  const dispatches = mapRecords(dispatchesQuery);
  const transporters = mapRecords(transportersQuery);
  const notifications = mapRecords(notificationsQuery);
  const payments = mapRecords(paymentsQuery);
  const paymentWebhookEvents = mapRecords(paymentWebhookEventsQuery);
  const payoutLedger = mapRecords(payoutLedgerQuery);

  const summaryStats = {
    farmersCount: farmers.length,
    verifiedFarmersCount: farmers.filter((farmer) => farmer.verificationStatus === "verified").length,
    pendingFarmersCount: farmers.filter((farmer) => farmer.verificationStatus === "pending").length,
    agentsCount: agents.length,
    pendingAgentsCount: agents.filter((agent) => agent.status === "pending").length,
    warehousesCount: warehouses.length,
    activeWarehousesCount: warehouses.filter((warehouse) => warehouse.status === "active").length,
    buyersCount: buyers.length,
    inventoryBatchesCount: inventory.length,
    availableInventoryCount: inventory.filter((item) => item.status === "available").length,
    ordersCount: orders.length,
    salesCount: sales.length,
    dispatchesCount: dispatches.length,
    disputesCount: disputes.length,
    openDisputesCount: disputes.filter((dispute) => dispute.status === "open").length,
    recentActivity: auditLogs.slice(0, 10),
    platformSummary,
  };

  return {
    access: {
      firebaseUser,
      principal,
      actorUserId,
      effectiveAccess,
      isAuthLoading,
      isDataLoading,
      isReady,
      permissions: permissionSet,
      hasPermission,
      canReadWarehouses,
      canReadAgents,
      canReadFarmers,
      canReadBuyers,
      canReadFees,
      canReadInventory,
      canReadDisputes,
      canReadAudit,
      canReadOrders,
      canReadSales,
      canReadDispatches,
      canReadTransporters,
      canReadReports,
      canReadNotifications,
      canReadUploads,
      canReadPayments,
      canReadPayouts,
      canManageWarehouses: hasPermission("warehouses:manage"),
      canManageAgents: hasPermission("warehouseAgents:manage"),
      canVerifyFarmers: hasPermission("farmers:verify"),
      canManageBuyers: hasPermission("buyers:manage"),
      canManageDisputes: hasPermission("disputes:manage"),
      canManageFees: hasPermission("fees:manage"),
      canManageSalePayments: hasPermission("sales:managePaymentStatus"),
      canManagePayments: hasPermission("payments:manage"),
      canManagePayouts: hasPermission("payouts:manage"),
      canManageUploads: hasPermission("uploads:manage"),
    },
    warehouses,
    agents,
    farmers,
    buyers,
    feeRules,
    storageFeeLedger,
    inventory,
    disputes,
    auditLogs,
    orders,
    sales,
    dispatches,
    transporters,
    notifications,
    payments,
    paymentWebhookEvents,
    payoutLedger,
    summaryStats,
    actions: {
      updateWarehouseStatus: (warehouseId: string, status: "active" | "inactive" | "maintenance" | "closed", reason?: string) =>
        updateWarehouseStatusMutation({
          actorUserId: requireActorUserId(),
          warehouseId: warehouseId as Id<"warehouses">,
          status,
          ...(reason === undefined ? {} : { reason }),
        }),
      updateAgentStatus: (warehouseAgentId: string, status: "pending" | "approved" | "rejected" | "suspended" | "deactivated", reason?: string) =>
        updateAgentStatusMutation({
          actorUserId: requireActorUserId(),
          warehouseAgentId: warehouseAgentId as Id<"warehouseAgents">,
          status,
          ...(reason === undefined ? {} : { reason }),
        }),
      assignWarehousesToAgent: (warehouseAgentId: string, assignedWarehouseIds: string[]) =>
        assignWarehousesMutation({
          actorUserId: requireActorUserId(),
          warehouseAgentId: warehouseAgentId as Id<"warehouseAgents">,
          assignedWarehouseIds: assignedWarehouseIds as Id<"warehouses">[],
        }),
      updateFarmerVerification: (farmerId: string, verificationStatus: "pending" | "verified" | "rejected", reason?: string) =>
        updateFarmerVerificationMutation({
          actorUserId: requireActorUserId(),
          farmerId: farmerId as Id<"farmers">,
          verificationStatus,
          ...(reason === undefined ? {} : { reason }),
        }),
      updateBuyerVerification: (buyerId: string, verificationStatus: "pending" | "verified" | "rejected", reason?: string) =>
        updateBuyerVerificationMutation({
          actorUserId: requireActorUserId(),
          buyerId: buyerId as Id<"buyers">,
          verificationStatus,
          ...(reason === undefined ? {} : { reason }),
        }),
      resolveDispute: (disputeId: string, resolution: string) =>
        updateDisputeStatusMutation({
          actorId: String(requireActorUserId()),
          actorUserId: requireActorUserId(),
          actorRole: "admin",
          disputeId: disputeId as Id<"disputes">,
          status: "resolved",
          resolution,
        }),
      updateFeeRuleVersion: (feeRuleId: string, newRate: number, _reason?: string) => {
        const rule = feeRules.find((item) => item.id === feeRuleId);
        if (rule === undefined) {
          throw new Error("Fee rule was not loaded.");
        }
        const ratePatch =
          rule.calculationType === "per_unit_per_day"
            ? { ratePerUnitPerDay: newRate }
            : rule.calculationType === "percentage_of_gross_sale" || rule.calculationType === "percentage_of_transport_cost"
              ? { percentage: newRate }
              : rule.calculationType === "fixed_amount"
                ? { amount: newRate }
                : { ratePerUnit: newRate };
        return replaceFeeRuleMutation({
          actorUserId: requireActorUserId(),
          replacesFeeRuleId: feeRuleId as Id<"feeRules">,
          ...ratePatch,
        });
      },
      reconcilePayment: (
        paymentTransactionId: string,
        status: "initialized" | "pending" | "processing" | "successful" | "failed" | "abandoned" | "reversed" | "refunded" | "manual_review",
        reason: string,
      ) =>
        reconcilePaymentMutation({
          actorUserId: requireActorUserId(),
          paymentTransactionId: paymentTransactionId as Id<"paymentTransactions">,
          status,
          reason,
        }),
      markPaymentManualReview: (paymentTransactionId: string, reason: string) =>
        markPaymentManualReviewMutation({
          actorUserId: requireActorUserId(),
          paymentTransactionId: paymentTransactionId as Id<"paymentTransactions">,
          reason,
        }),
      updatePayoutStatus: (
        payoutLedgerId: string,
        status: "pending" | "approved" | "processing" | "paid" | "failed" | "cancelled" | "manual_review",
        reason: string,
        providerReference?: string,
      ) =>
        updatePayoutStatusMutation({
          actorUserId: requireActorUserId(),
          payoutLedgerId: payoutLedgerId as Id<"payoutLedger">,
          status,
          reason,
          ...(providerReference === undefined || providerReference.trim().length === 0
            ? {}
            : { providerReference: providerReference.trim() }),
        }),
    },
  };
}
