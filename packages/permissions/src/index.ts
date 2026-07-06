import type {
  BuyerOrderStatus,
  DispatchStatus,
  InventoryBatchStatus,
  InventoryReservationStatus,
  MarketplaceRole,
  SalePaymentStatus,
} from "@kuapa-dwaso/types";

export const permissionKeys = [
  "warehouses:create",
  "warehouses:update",
  "warehouses:configureFees",
  "warehouseAgents:manage",
  "transporters:manage",
  "farmers:create",
  "farmers:verify",
  "inventory:create",
  "inventory:update",
  "inventory:updateStatus",
  "inventory:adjustQuantity",
  "fees:configure",
  "fees:applyAdjustment",
  "orders:create",
  "orders:reserveInventory",
  "orders:updateStatus",
  "sales:create",
  "sales:updatePaymentStatus",
  "dispatches:create",
  "dispatches:assignTransporter",
  "dispatches:updateStatus",
  "notifications:send",
  "auditLogs:view",
  "disputes:create",
  "disputes:manage",
  "users:updateStatus",
] as const;
export type PermissionKey = (typeof permissionKeys)[number];

const permissionsByRole: Record<MarketplaceRole, ReadonlySet<PermissionKey>> = {
  farmer: new Set(["disputes:create"]),
  warehouse_agent: new Set([
    "farmers:create",
    "inventory:create",
    "inventory:update",
    "inventory:updateStatus",
    "inventory:adjustQuantity",
    "orders:reserveInventory",
    "sales:create",
    "dispatches:create",
    "dispatches:assignTransporter",
    "dispatches:updateStatus",
    "disputes:create",
    "notifications:send",
  ]),
  buyer: new Set(["orders:create", "disputes:create"]),
  transporter: new Set(["dispatches:updateStatus", "disputes:create"]),
  admin: new Set(permissionKeys),
};

export function principalHasAnyRole(
  roles: readonly MarketplaceRole[],
  requiredRoles: readonly MarketplaceRole[],
): boolean {
  return requiredRoles.some((requiredRole) => roles.includes(requiredRole));
}

export function roleHasPermission(
  role: MarketplaceRole,
  permission: PermissionKey,
): boolean {
  return permissionsByRole[role].has(permission);
}

export function principalHasAnyPermission(
  roles: readonly MarketplaceRole[],
  requiredPermissions: readonly PermissionKey[],
): boolean {
  return roles.some((role) =>
    requiredPermissions.some((permission) => roleHasPermission(role, permission)),
  );
}

export function canCreateWarehouse(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "warehouses:create");
}

export function canUpdateWarehouse(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "warehouses:update");
}

export function canManageWarehouseAgents(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "warehouseAgents:manage");
}

export function canManageTransporters(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "transporters:manage");
}

export function canCreateFarmerProfile(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "farmers:create");
}

export function canVerifyFarmer(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "farmers:verify");
}

export function canCreateInventoryBatch(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "inventory:create");
}

export function canUpdateInventoryBatch(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "inventory:update");
}

export function canUpdateInventoryBatchStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "inventory:updateStatus");
}

export function canAdjustInventoryQuantity(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "inventory:adjustQuantity");
}

export function canConfigureFees(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "fees:configure");
}

export function canApplyFeeAdjustment(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "fees:applyAdjustment");
}

export function canCreateBuyerOrder(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "orders:create");
}

export function canReserveInventory(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "orders:reserveInventory");
}

export function canUpdateBuyerOrderStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "orders:updateStatus");
}

export function canCreateSaleRecord(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "sales:create");
}

export function canUpdateSalePaymentStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "sales:updatePaymentStatus");
}

export function canCreateDispatch(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "dispatches:create");
}

export function canAssignDispatchTransporter(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "dispatches:assignTransporter");
}

export function canUpdateDispatchStatus(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "dispatches:updateStatus");
}

export function canSendNotification(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "notifications:send");
}

export function canViewAuditLogs(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "auditLogs:view");
}

export function canCreateDispute(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "disputes:create");
}

export function canManageDisputes(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "disputes:manage");
}

export function canUpdateUsers(role: MarketplaceRole): boolean {
  return roleHasPermission(role, "users:updateStatus");
}

export const allowedInventoryBatchStatusTransitions: Readonly<
  Record<InventoryBatchStatus, readonly InventoryBatchStatus[]>
> = {
  received: ["verified", "withdrawn", "spoiled", "disputed"],
  verified: ["available", "withdrawn", "spoiled", "disputed"],
  available: [
    "partially_reserved",
    "reserved",
    "partially_sold",
    "sold",
    "withdrawn",
    "expired",
    "spoiled",
    "disputed",
  ],
  partially_reserved: [
    "available",
    "reserved",
    "partially_sold",
    "sold",
    "withdrawn",
    "expired",
    "spoiled",
    "disputed",
  ],
  reserved: [
    "available",
    "partially_reserved",
    "partially_sold",
    "sold",
    "prepared_for_dispatch",
    "disputed",
  ],
  partially_sold: [
    "available",
    "partially_reserved",
    "sold",
    "prepared_for_dispatch",
    "withdrawn",
    "expired",
    "spoiled",
    "disputed",
  ],
  sold: ["prepared_for_dispatch", "disputed"],
  prepared_for_dispatch: ["dispatched", "disputed"],
  dispatched: ["disputed"],
  withdrawn: ["disputed"],
  expired: ["spoiled", "withdrawn", "disputed"],
  spoiled: ["disputed"],
  disputed: [],
};

export const allowedInventoryReservationStatusTransitions: Readonly<
  Record<InventoryReservationStatus, readonly InventoryReservationStatus[]>
> = {
  active: ["partially_released", "fulfilled", "released", "expired", "cancelled"],
  partially_released: ["fulfilled", "released", "expired", "cancelled"],
  fulfilled: [],
  released: [],
  expired: [],
  cancelled: [],
};

export const allowedBuyerOrderStatusTransitions: Readonly<
  Record<BuyerOrderStatus, readonly BuyerOrderStatus[]>
> = {
  draft: ["submitted", "cancelled"],
  submitted: ["awaiting_payment", "confirmed", "matched_to_inventory", "cancelled", "unfulfilled", "disputed"],
  awaiting_payment: ["confirmed", "cancelled", "unfulfilled", "disputed"],
  confirmed: ["matched_to_inventory", "cancelled", "unfulfilled", "disputed"],
  matched_to_inventory: ["reserved", "cancelled", "unfulfilled", "disputed"],
  reserved: ["preparing", "cancelled", "unfulfilled", "disputed"],
  preparing: ["ready_for_dispatch", "cancelled", "disputed"],
  ready_for_dispatch: ["in_transit", "cancelled", "disputed"],
  in_transit: ["delivered", "disputed"],
  delivered: ["completed", "disputed"],
  completed: ["disputed"],
  cancelled: [],
  unfulfilled: ["disputed"],
  disputed: [],
};

export const allowedSalePaymentStatusTransitions: Readonly<
  Record<SalePaymentStatus, readonly SalePaymentStatus[]>
> = {
  pending: ["part_paid", "paid", "withheld", "disputed"],
  part_paid: ["paid", "withheld", "disputed"],
  paid: ["disputed"],
  withheld: ["part_paid", "paid", "disputed"],
  disputed: [],
};

export const allowedDispatchStatusTransitions: Readonly<
  Record<DispatchStatus, readonly DispatchStatus[]>
> = {
  planned: ["loading", "cancelled", "issue_reported"],
  loading: ["departed", "cancelled", "issue_reported"],
  departed: ["in_transit", "arrived", "issue_reported"],
  in_transit: ["arrived", "delivered", "issue_reported"],
  arrived: ["delivered", "issue_reported"],
  delivered: ["closed", "issue_reported"],
  closed: [],
  cancelled: [],
  issue_reported: ["loading", "departed", "in_transit", "arrived", "delivered", "closed", "cancelled"],
};

export function canTransitionInventoryBatchStatus(
  currentStatus: InventoryBatchStatus,
  nextStatus: InventoryBatchStatus,
): boolean {
  return allowedInventoryBatchStatusTransitions[currentStatus].includes(nextStatus);
}

export function canTransitionInventoryReservationStatus(
  currentStatus: InventoryReservationStatus,
  nextStatus: InventoryReservationStatus,
): boolean {
  return allowedInventoryReservationStatusTransitions[currentStatus].includes(nextStatus);
}

export function canTransitionBuyerOrderStatus(
  currentStatus: BuyerOrderStatus,
  nextStatus: BuyerOrderStatus,
): boolean {
  return allowedBuyerOrderStatusTransitions[currentStatus].includes(nextStatus);
}

export function canTransitionSalePaymentStatus(
  currentStatus: SalePaymentStatus,
  nextStatus: SalePaymentStatus,
): boolean {
  return allowedSalePaymentStatusTransitions[currentStatus].includes(nextStatus);
}

export function canTransitionDispatchStatus(
  currentStatus: DispatchStatus,
  nextStatus: DispatchStatus,
): boolean {
  return allowedDispatchStatusTransitions[currentStatus].includes(nextStatus);
}

export const activeReservationStatuses: readonly InventoryReservationStatus[] = [
  "active",
  "partially_released",
] as const;

export function isActiveReservationStatus(
  status: InventoryReservationStatus,
): boolean {
  return activeReservationStatuses.includes(status);
}

export function calculateInventoryBatchAvailableQuantity(
  quantityReceived: number,
  fulfilledSaleQuantity: number,
  reservations: readonly {
    quantityReserved: number;
    quantityReleased?: number;
    quantityFulfilled?: number;
    status: InventoryReservationStatus;
  }[],
): number {
  const reservedQuantity = reservations
    .filter((reservation) => isActiveReservationStatus(reservation.status))
    .reduce(
      (total, reservation) =>
        total +
        reservation.quantityReserved -
        (reservation.quantityReleased ?? 0) -
        (reservation.quantityFulfilled ?? 0),
      0,
    );

  return Math.max(0, quantityReceived - fulfilledSaleQuantity - reservedQuantity);
}
