import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("warehouse_agent"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("admin")
);

const userStatus = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("rejected"),
  v.literal("deactivated")
);

const warehouseStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("maintenance"),
  v.literal("closed")
);

const warehouseAgentStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended"),
  v.literal("deactivated")
);

const verificationStatus = v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"));
const profileStatus = v.union(v.literal("active"), v.literal("suspended"), v.literal("deactivated"));
const registrationSource = v.union(v.literal("self_app"), v.literal("agent_assisted"), v.literal("admin"));
const produceGrade = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("mixed"),
  v.literal("ungraded")
);

const inventoryBatchStatus = v.union(
  v.literal("received"),
  v.literal("verified"),
  v.literal("available"),
  v.literal("partially_reserved"),
  v.literal("reserved"),
  v.literal("partially_sold"),
  v.literal("sold"),
  v.literal("prepared_for_dispatch"),
  v.literal("dispatched"),
  v.literal("withdrawn"),
  v.literal("expired"),
  v.literal("spoiled"),
  v.literal("disputed")
);

const inventoryReservationStatus = v.union(
  v.literal("active"),
  v.literal("partially_released"),
  v.literal("fulfilled"),
  v.literal("released"),
  v.literal("expired"),
  v.literal("cancelled")
);

const storageFeeLedgerStatus = v.union(
  v.literal("accrued"),
  v.literal("deducted_from_sale"),
  v.literal("paid"),
  v.literal("waived"),
  v.literal("disputed")
);

const buyerType = v.union(
  v.literal("market_trader"),
  v.literal("retailer"),
  v.literal("restaurant"),
  v.literal("hotel"),
  v.literal("school"),
  v.literal("processor"),
  v.literal("exporter"),
  v.literal("institution"),
  v.literal("other")
);

const buyerOrderStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("awaiting_payment"),
  v.literal("confirmed"),
  v.literal("matched_to_inventory"),
  v.literal("reserved"),
  v.literal("preparing"),
  v.literal("ready_for_dispatch"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("unfulfilled"),
  v.literal("disputed")
);

const buyerOrderPaymentStatus = v.union(
  v.literal("not_required"),
  v.literal("awaiting_payment"),
  v.literal("deposit_paid"),
  v.literal("fully_paid"),
  v.literal("payment_on_delivery"),
  v.literal("failed"),
  v.literal("refunded"),
  v.literal("disputed")
);

const salePaymentStatus = v.union(
  v.literal("pending"),
  v.literal("part_paid"),
  v.literal("paid"),
  v.literal("withheld"),
  v.literal("disputed")
);

const dispatchStatus = v.union(
  v.literal("planned"),
  v.literal("loading"),
  v.literal("departed"),
  v.literal("in_transit"),
  v.literal("arrived"),
  v.literal("delivered"),
  v.literal("closed"),
  v.literal("cancelled"),
  v.literal("issue_reported")
);

const feeRuleStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("inactive"),
  v.literal("archived")
);

const feeCalculationType = v.union(
  v.literal("fixed_amount"),
  v.literal("per_unit"),
  v.literal("per_unit_per_day"),
  v.literal("percentage_of_gross_sale"),
  v.literal("percentage_of_transport_cost")
);

const feePayer = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("platform"),
  v.literal("shared"),
  v.literal("included_in_price")
);

const notificationStatus = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("read"),
  v.literal("failed"),
  v.literal("archived")
);

const disputeStatus = v.union(
  v.literal("open"),
  v.literal("under_review"),
  v.literal("resolved"),
  v.literal("cancelled")
);

const actorRole = v.union(marketplaceRole, v.literal("system"));
const genericRecord = v.record(v.string(), v.any());

const feeRuleScope = v.object({
  warehouseId: v.optional(v.string()),
  cropType: v.optional(v.string()),
  unit: v.optional(v.string()),
  grade: v.optional(produceGrade),
  destinationMarket: v.optional(v.string())
});

const feeRuleSnapshot = v.object({
  feeRuleId: v.optional(v.string()),
  feeRuleVersion: v.optional(v.number()),
  label: v.string(),
  calculationType: feeCalculationType,
  payer: feePayer,
  amount: v.optional(v.number()),
  percentage: v.optional(v.number()),
  ratePerUnit: v.optional(v.number()),
  ratePerUnitPerDay: v.optional(v.number()),
  currency: v.string(),
  scope: v.optional(feeRuleScope),
  snapshottedAt: v.number()
});

export default defineSchema({
  users: defineTable({
    authProviderId: v.optional(v.string()),
    authProvider: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.string(),
    role: marketplaceRole,
    status: userStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_auth_provider_id", ["authProviderId"])
    .index("by_role_status", ["role", "status"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_email", ["email"]),

  warehouses: defineTable({
    code: v.string(),
    name: v.string(),
    community: v.string(),
    district: v.optional(v.string()),
    region: v.optional(v.string()),
    servedCommunities: v.array(v.string()),
    supportedCrops: v.array(v.string()),
    storageCapacity: v.optional(v.number()),
    capacityUnit: v.optional(v.string()),
    assignedWarehouseAgentIds: v.array(v.id("warehouseAgents")),
    destinationMarketsServed: v.array(v.string()),
    operatingDays: v.array(v.string()),
    dispatchDays: v.optional(v.array(v.string())),
    status: warehouseStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_community_status", ["community", "status"])
    .index("by_district_status", ["district", "status"])
    .index("by_region_status", ["region", "status"]),

  warehouseAgents: defineTable({
    userId: v.id("users"),
    agentCode: v.string(),
    fullName: v.string(),
    phoneNumber: v.string(),
    assignedWarehouseIds: v.array(v.id("warehouses")),
    status: warehouseAgentStatus,
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_agent_code", ["agentCode"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"]),

  farmers: defineTable({
    userId: v.optional(v.id("users")),
    farmerCode: v.string(),
    fullName: v.string(),
    phoneNumber: v.string(),
    community: v.string(),
    region: v.optional(v.string()),
    householdPhoneOwnerName: v.optional(v.string()),
    preferredWarehouseId: v.optional(v.id("warehouses")),
    registrationSource,
    verificationStatus,
    status: profileStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_farmer_code", ["farmerCode"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_preferred_warehouse", ["preferredWarehouseId"])
    .index("by_preferred_warehouse_verification_status", ["preferredWarehouseId", "verificationStatus"])
    .index("by_verification_status", ["verificationStatus"]),

  buyers: defineTable({
    userId: v.optional(v.id("users")),
    fullName: v.string(),
    displayName: v.optional(v.string()),
    phoneNumber: v.string(),
    buyerType,
    organizationName: v.optional(v.string()),
    destinationMarket: v.optional(v.string()),
    verificationStatus,
    status: profileStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_status", ["status"])
    .index("by_verification_status", ["verificationStatus"])
    .index("by_destination_market", ["destinationMarket"]),

  storageRateRules: defineTable({
    warehouseId: v.optional(v.id("warehouses")),
    cropType: v.optional(v.string()),
    unit: v.string(),
    grade: v.optional(produceGrade),
    ratePerUnitPerDay: v.number(),
    currency: v.string(),
    status: feeRuleStatus,
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_warehouse_status_effective", ["warehouseId", "status", "effectiveFrom"])
    .index("by_crop_unit_grade_status", ["cropType", "unit", "grade", "status"])
    .index("by_status_effective", ["status", "effectiveFrom"]),

  feeRules: defineTable({
    code: v.string(),
    label: v.string(),
    scope: feeRuleScope,
    calculationType: feeCalculationType,
    payer: feePayer,
    amount: v.optional(v.number()),
    percentage: v.optional(v.number()),
    ratePerUnit: v.optional(v.number()),
    ratePerUnitPerDay: v.optional(v.number()),
    currency: v.string(),
    status: feeRuleStatus,
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_code_version", ["code", "version"])
    .index("by_status_effective", ["status", "effectiveFrom"]),

  inventoryBatches: defineTable({
    receiptCode: v.string(),
    farmerId: v.id("farmers"),
    warehouseId: v.id("warehouses"),
    receivedByWarehouseAgentId: v.id("warehouseAgents"),
    cropType: v.string(),
    variety: v.optional(v.string()),
    quantityReceived: v.number(),
    quantityAvailable: v.number(),
    unit: v.string(),
    grade: produceGrade,
    photos: v.array(v.string()),
    conditionNotes: v.optional(v.string()),
    receivedAt: v.number(),
    expectedShelfLifeDays: v.optional(v.number()),
    sellByDate: v.optional(v.number()),
    storageRateSnapshot: feeRuleSnapshot,
    storageFeeAccrued: v.number(),
    lastFeeCalculatedAt: v.number(),
    askingPricePerUnit: v.optional(v.number()),
    minimumPricePerUnit: v.optional(v.number()),
    status: inventoryBatchStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_receipt_code", ["receiptCode"])
    .index("by_farmer", ["farmerId"])
    .index("by_warehouse_status", ["warehouseId", "status"])
    .index("by_warehouse_crop_grade_status", ["warehouseId", "cropType", "grade", "status"])
    .index("by_crop_grade_status", ["cropType", "grade", "status"])
    .index("by_sell_by_date", ["sellByDate"])
    .index("by_status", ["status"]),

  inventoryReservations: defineTable({
    buyerOrderId: v.id("buyerOrders"),
    inventoryBatchId: v.id("inventoryBatches"),
    warehouseId: v.id("warehouses"),
    farmerId: v.id("farmers"),
    quantityReserved: v.number(),
    quantityReleased: v.number(),
    quantityFulfilled: v.number(),
    unit: v.string(),
    expiresAt: v.optional(v.number()),
    status: inventoryReservationStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_order", ["buyerOrderId"])
    .index("by_batch_status", ["inventoryBatchId", "status"])
    .index("by_status_expires_at", ["status", "expiresAt"])
    .index("by_warehouse_status", ["warehouseId", "status"]),

  storageFeeLedger: defineTable({
    inventoryBatchId: v.id("inventoryBatches"),
    farmerId: v.id("farmers"),
    warehouseId: v.id("warehouses"),
    feeDate: v.number(),
    quantityCharged: v.number(),
    unit: v.string(),
    appliedRuleSnapshot: feeRuleSnapshot,
    amount: v.number(),
    status: storageFeeLedgerStatus,
    createdAt: v.number()
  })
    .index("by_batch_date", ["inventoryBatchId", "feeDate"])
    .index("by_farmer_status_date", ["farmerId", "status", "feeDate"])
    .index("by_warehouse_status_date", ["warehouseId", "status", "feeDate"])
    .index("by_status_date", ["status", "feeDate"]),

  buyerOrders: defineTable({
    buyerId: v.id("buyers"),
    destinationMarket: v.string(),
    cropType: v.string(),
    requestedQuantity: v.number(),
    unit: v.string(),
    preferredGrade: v.optional(produceGrade),
    requestedDeliveryDate: v.optional(v.number()),
    maxPricePerUnit: v.optional(v.number()),
    matchedInventoryBatchIds: v.array(v.id("inventoryBatches")),
    subtotalAmount: v.optional(v.number()),
    transportFee: v.optional(v.number()),
    serviceFee: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    paymentStatus: buyerOrderPaymentStatus,
    status: buyerOrderStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_buyer", ["buyerId"])
    .index("by_buyer_status", ["buyerId", "status"])
    .index("by_status", ["status"])
    .index("by_payment_status", ["paymentStatus"])
    .index("by_destination_status", ["destinationMarket", "status"]),

  buyerOrderCharges: defineTable({
    buyerOrderId: v.id("buyerOrders"),
    label: v.string(),
    amount: v.number(),
    appliedRuleSnapshot: v.optional(feeRuleSnapshot),
    createdAt: v.number()
  }).index("by_order", ["buyerOrderId"]),

  saleRecords: defineTable({
    buyerOrderId: v.id("buyerOrders"),
    inventoryBatchId: v.id("inventoryBatches"),
    farmerId: v.id("farmers"),
    warehouseId: v.id("warehouses"),
    quantitySold: v.number(),
    unit: v.string(),
    pricePerUnit: v.number(),
    grossAmount: v.number(),
    storageFeeDeducted: v.number(),
    handlingFeeDeducted: v.optional(v.number()),
    commissionDeducted: v.optional(v.number()),
    transportFeeDeducted: v.optional(v.number()),
    adjustmentAmount: v.optional(v.number()),
    netAmountDueToFarmer: v.number(),
    paymentStatus: salePaymentStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_order", ["buyerOrderId"])
    .index("by_batch", ["inventoryBatchId"])
    .index("by_farmer_payment_status", ["farmerId", "paymentStatus"])
    .index("by_warehouse_payment_status", ["warehouseId", "paymentStatus"])
    .index("by_payment_status", ["paymentStatus"]),

  saleDeductions: defineTable({
    saleRecordId: v.id("saleRecords"),
    farmerId: v.id("farmers"),
    inventoryBatchId: v.id("inventoryBatches"),
    label: v.string(),
    amount: v.number(),
    appliedRuleSnapshot: v.optional(feeRuleSnapshot),
    createdAt: v.number()
  })
    .index("by_sale", ["saleRecordId"])
    .index("by_farmer", ["farmerId"])
    .index("by_batch", ["inventoryBatchId"]),

  dispatches: defineTable({
    warehouseId: v.id("warehouses"),
    destination: v.string(),
    transporterId: v.optional(v.id("users")),
    driverName: v.optional(v.string()),
    driverPhoneNumber: v.optional(v.string()),
    vehicleType: v.optional(v.string()),
    vehicleCapacity: v.optional(v.number()),
    buyerOrderIds: v.array(v.id("buyerOrders")),
    inventoryBatchIds: v.array(v.id("inventoryBatches")),
    totalQuantity: v.number(),
    unit: v.string(),
    plannedDepartureAt: v.optional(v.number()),
    departedAt: v.optional(v.number()),
    expectedArrivalAt: v.optional(v.number()),
    arrivedAt: v.optional(v.number()),
    transportCost: v.optional(v.number()),
    transportPayer: feePayer,
    status: dispatchStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_warehouse_status", ["warehouseId", "status"])
    .index("by_status", ["status"])
    .index("by_destination_status", ["destination", "status"])
    .index("by_transporter_status", ["transporterId", "status"]),

  notifications: defineTable({
    recipientId: v.optional(v.string()),
    recipientUserId: v.optional(v.id("users")),
    recipientRole: marketplaceRole,
    channel: v.union(v.literal("sms"), v.literal("in_app"), v.literal("email")),
    status: notificationStatus,
    title: v.string(),
    message: v.string(),
    body: v.optional(v.string()),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    readAt: v.optional(v.number())
  })
    .index("by_recipient_status", ["recipientUserId", "status"])
    .index("by_role_status", ["recipientRole", "status"])
    .index("by_status", ["status"])
    .index("by_related_entity", ["relatedEntityType", "relatedEntityId"]),

  auditLogs: defineTable({
    actorId: v.string(),
    actorRole,
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    before: v.optional(genericRecord),
    after: v.optional(genericRecord),
    metadata: v.optional(genericRecord),
    createdAt: v.number()
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_actor", ["actorId"])
    .index("by_actor_action", ["actorId", "action"])
    .index("by_created_at", ["createdAt"])
    .index("by_action", ["action"]),

  disputes: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    status: disputeStatus,
    openedByUserId: v.optional(v.id("users")),
    openedByRole: v.optional(marketplaceRole),
    warehouseId: v.optional(v.id("warehouses")),
    summary: v.string(),
    resolution: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number())
  })
    .index("by_status", ["status"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_warehouse_status", ["warehouseId", "status"]),

  appSettings: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.optional(v.number()),
    updatedByUserId: v.optional(v.id("users"))
  }).index("by_key", ["key"])
});
