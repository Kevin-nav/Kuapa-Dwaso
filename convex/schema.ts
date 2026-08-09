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

const authMethod = v.union(v.literal("phone"), v.literal("email_password"), v.literal("google"));
const mfaRequirement = v.union(
  v.literal("not_required"),
  v.literal("sms_required"),
  v.literal("totp_required"),
  v.literal("required")
);
const mfaStatus = v.union(
  v.literal("not_required"),
  v.literal("pending"),
  v.literal("verified"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("recovery")
);
const onboardingState = v.union(
  v.literal("not_started"),
  v.literal("profile_required"),
  v.literal("pending_invite_acceptance"),
  v.literal("pending_verification"),
  v.literal("pending_approval"),
  v.literal("complete")
);

const adminRoleKey = v.union(
  v.literal("platform_owner"),
  v.literal("operations_manager"),
  v.literal("warehouse_manager"),
  v.literal("finance_manager"),
  v.literal("support_officer"),
  v.literal("auditor"),
  v.literal("analyst"),
  v.literal("admin_viewer")
);

const adminScopeType = v.union(
  v.literal("global"),
  v.literal("region"),
  v.literal("district"),
  v.literal("warehouse"),
  v.literal("destination_market")
);

const adminRoleAssignmentStatus = v.union(
  v.literal("active"),
  v.literal("revoked"),
  v.literal("expired")
);

const adminAccessGroupStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("deactivated")
);

const adminAccessGroupMemberStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("removed")
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
  v.literal("partially_deducted_from_sale"),
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

const enhancedVerificationStatus = v.union(
  v.literal("not_required"),
  v.literal("required"),
  v.literal("pending_review"),
  v.literal("verified"),
  v.literal("changes_requested"),
  v.literal("rejected")
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
  v.literal("queued"),
  v.literal("sent"),
  v.literal("read"),
  v.literal("failed"),
  v.literal("archived")
);
const notificationPriority = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent")
);
const marketServiceScheduleStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("retired")
);
const marketDeliveryRunStatus = v.union(
  v.literal("draft"),
  v.literal("accepting_orders"),
  v.literal("cutoff_reached"),
  v.literal("ready"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("dispatched"),
  v.literal("completed")
);

const smsProvider = v.union(v.literal("mock"), v.literal("arkesel"));
const smsMessageKind = v.union(
  v.literal("notification"),
  v.literal("otp"),
  v.literal("transactional"),
  v.literal("farmer_receipt"),
  v.literal("storage_fee_reminder"),
  v.literal("reservation_alert"),
  v.literal("sale_payment_update"),
  v.literal("payout_update"),
  v.literal("buyer_order_update"),
  v.literal("buyer_reservation_update"),
  v.literal("buyer_cancellation_update"),
  v.literal("dispatch_assignment"),
  v.literal("dispatch_status_update"),
  v.literal("market_run_update"),
  v.literal("dispute_update"),
  v.literal("promotional"),
  v.literal("invite"),
  v.literal("warehouse_agent_invite")
);
const smsDeliveryStatus = v.union(
  v.literal("pending"),
  v.literal("queued"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("failed"),
  v.literal("expired"),
  v.literal("rejected")
);

const paymentProvider = v.union(v.literal("mock"), v.literal("paystack"));
const paymentTransactionStatus = v.union(
  v.literal("initialized"),
  v.literal("pending"),
  v.literal("processing"),
  v.literal("successful"),
  v.literal("failed"),
  v.literal("abandoned"),
  v.literal("reversed"),
  v.literal("refunded"),
  v.literal("manual_review")
);
const paymentEventStatus = v.union(
  v.literal("received"),
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("failed")
);
const payoutLedgerStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("processing"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("manual_review")
);

const disputeStatus = v.union(
  v.literal("open"),
  v.literal("under_review"),
  v.literal("resolved"),
  v.literal("cancelled")
);

const profileType = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("transporter"),
  v.literal("warehouse_agent"),
  v.literal("admin")
);
const profileLinkStatus = v.union(
  v.literal("pending"),
  v.literal("linked"),
  v.literal("rejected"),
  v.literal("revoked")
);
const profileLinkSource = v.union(
  v.literal("self_app"),
  v.literal("agent_assisted_claim"),
  v.literal("invite_acceptance"),
  v.literal("admin_link")
);
const platformInvitationType = v.union(
  v.literal("admin_invite"),
  v.literal("warehouse_manager_invite"),
  v.literal("warehouse_agent_invite"),
  v.literal("transporter_invite")
);
const invitationChannel = v.union(v.literal("email"), v.literal("manual_link"), v.literal("sms"));
const platformInvitationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
  v.literal("expired"),
  v.literal("cancelled")
);
const uploadAssetPurpose = v.union(
  v.literal("transporter_truck_photo"),
  v.literal("produce_intake_photo"),
  v.literal("condition_evidence"),
  v.literal("dispute_evidence"),
  v.literal("dispatch_proof_photo"),
  v.literal("profile_evidence")
);
const uploadAssetStatus = v.union(
  v.literal("pending_upload"),
  v.literal("uploaded"),
  v.literal("attached"),
  v.literal("verified"),
  v.literal("rejected"),
  v.literal("expired"),
  v.literal("deleted")
);
const uploadAccessLevel = v.union(v.literal("private"), v.literal("public_read"));
const uploadRelatedEntityType = v.union(
  v.literal("farmer"),
  v.literal("buyer"),
  v.literal("transporter_profile"),
  v.literal("warehouse_agent"),
  v.literal("inventory_batch"),
  v.literal("dispatch"),
  v.literal("dispute")
);

const actorRole = v.union(marketplaceRole, v.literal("system"));
const genericRecord = v.record(v.string(), v.any());
const smsTemplateKey = v.union(
  v.literal("farmer_receipt"),
  v.literal("storage_fee_reminder"),
  v.literal("reservation_alert"),
  v.literal("sale_payment_update"),
  v.literal("payout_update"),
  v.literal("buyer_order_update"),
  v.literal("buyer_reservation_update"),
  v.literal("buyer_cancellation_update"),
  v.literal("dispatch_assignment"),
  v.literal("dispatch_status_update"),
  v.literal("dispute_update"),
  v.literal("generic_notification"),
  v.literal("warehouse_agent_invite")
);

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

const pendingAdminRoleAssignment = v.object({
  roleKey: adminRoleKey,
  scopeType: adminScopeType,
  scopeId: v.optional(v.string()),
  scopeValue: v.optional(v.string()),
  expiresAt: v.optional(v.number())
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
    authMethods: v.optional(v.array(authMethod)),
    phoneVerified: v.optional(v.boolean()),
    emailVerified: v.optional(v.boolean()),
    mfaRequirement: v.optional(mfaRequirement),
    mfaStatus: v.optional(mfaStatus),
    mfaMethods: v.optional(v.array(v.string())),
    onboardingState: v.optional(onboardingState),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_auth_provider_id", ["authProviderId"])
    .index("by_role_status", ["role", "status"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_email", ["email"]),

  profileLinks: defineTable({
    userId: v.id("users"),
    profileType,
    profileId: v.string(),
    status: profileLinkStatus,
    source: profileLinkSource,
    linkedByUserId: v.optional(v.id("users")),
    invitationId: v.optional(v.id("platformInvitations")),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_profile", ["profileType", "profileId"])
    .index("by_profile_status", ["profileType", "profileId", "status"])
    .index("by_invitation", ["invitationId"]),

  platformInvitations: defineTable({
    type: platformInvitationType,
    channel: invitationChannel,
    status: platformInvitationStatus,
    tokenHash: v.string(),
    targetEmail: v.optional(v.string()),
    targetPhoneNumber: v.optional(v.string()),
    intendedRole: marketplaceRole,
    intendedProfileType: profileType,
    linkedProfileId: v.optional(v.string()),
    pendingAdminRoleAssignment: v.optional(pendingAdminRoleAssignment),
    mfaRequirement,
    invitedByUserId: v.id("users"),
    acceptedByUserId: v.optional(v.id("users")),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedByUserId: v.optional(v.id("users")),
    messageId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_status_expires_at", ["status", "expiresAt"])
    .index("by_target_email_status", ["targetEmail", "status"])
    .index("by_target_phone_status", ["targetPhoneNumber", "status"])
    .index("by_type_status", ["type", "status"])
    .index("by_invited_by_status", ["invitedByUserId", "status"]),

  uploadAssets: defineTable({
    ownerUserId: v.id("users"),
    ownerProfileType: v.optional(profileType),
    ownerProfileId: v.optional(v.string()),
    purpose: uploadAssetPurpose,
    status: uploadAssetStatus,
    accessLevel: uploadAccessLevel,
    bucket: v.string(),
    objectKey: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    checksumSha256: v.optional(v.string()),
    relatedEntityType: v.optional(uploadRelatedEntityType),
    relatedEntityId: v.optional(v.string()),
    createdByUserId: v.id("users"),
    completedAt: v.optional(v.number()),
    verifiedByUserId: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
    rejectedByUserId: v.optional(v.id("users")),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    expiredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_owner_status", ["ownerUserId", "status"])
    .index("by_owner_purpose_status", ["ownerUserId", "purpose", "status"])
    .index("by_object_key", ["objectKey"])
    .index("by_related_entity", ["relatedEntityType", "relatedEntityId"])
    .index("by_status_purpose", ["status", "purpose"]),

  adminRoleAssignments: defineTable({
    adminUserId: v.id("users"),
    roleKey: adminRoleKey,
    scopeType: adminScopeType,
    scopeId: v.optional(v.string()),
    scopeValue: v.optional(v.string()),
    status: adminRoleAssignmentStatus,
    assignedBy: v.id("users"),
    assignedAt: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_admin_user_status", ["adminUserId", "status"])
    .index("by_admin_user_role_status", ["adminUserId", "roleKey", "status"])
    .index("by_role_status", ["roleKey", "status"])
    .index("by_status_expires_at", ["status", "expiresAt"])
    .index("by_scope_status", ["scopeType", "scopeId", "status"]),

  adminAccessGroups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: adminAccessGroupStatus,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_status", ["status"])
    .index("by_name", ["name"]),

  adminAccessGroupMembers: defineTable({
    groupId: v.id("adminAccessGroups"),
    adminUserId: v.id("users"),
    status: adminAccessGroupMemberStatus,
    addedBy: v.id("users"),
    addedAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_admin_user_status", ["adminUserId", "status"])
    .index("by_group_status", ["groupId", "status"])
    .index("by_group_admin_user", ["groupId", "adminUserId"]),

  adminAccessGroupRoleAssignments: defineTable({
    groupId: v.id("adminAccessGroups"),
    roleKey: adminRoleKey,
    scopeType: adminScopeType,
    scopeId: v.optional(v.string()),
    scopeValue: v.optional(v.string()),
    status: adminRoleAssignmentStatus,
    assignedBy: v.id("users"),
    assignedAt: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_group_status", ["groupId", "status"])
    .index("by_group_role_status", ["groupId", "roleKey", "status"])
    .index("by_role_status", ["roleKey", "status"])
    .index("by_status_expires_at", ["status", "expiresAt"])
    .index("by_scope_status", ["scopeType", "scopeId", "status"]),

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
    .index("by_user", ["userId"])
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
    email: v.optional(v.string()),
    organizationRegistrationNumber: v.optional(v.string()),
    contactRole: v.optional(v.string()),
    registeredAddress: v.optional(v.string()),
    destinationMarket: v.optional(v.string()),
    verificationStatus,
    enhancedVerificationStatus: v.optional(enhancedVerificationStatus),
    enhancedVerificationSubmittedAt: v.optional(v.number()),
    enhancedVerificationReviewedAt: v.optional(v.number()),
    enhancedVerificationReviewedByUserId: v.optional(v.id("users")),
    enhancedVerificationReason: v.optional(v.string()),
    institutionWelcomeEmailSentAt: v.optional(v.number()),
    status: profileStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_status", ["status"])
    .index("by_verification_status", ["verificationStatus"])
    .index("by_destination_market", ["destinationMarket"]),

  transporterProfiles: defineTable({
    userId: v.optional(v.id("users")),
    fullName: v.string(),
    phoneNumber: v.string(),
    vehicleType: v.string(),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    baseLocation: v.string(),
    routesServed: v.array(v.string()),
    destinationsServed: v.array(v.string()),
    verificationStatus,
    status: profileStatus,
    rating: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_status", ["status"])
    .index("by_verification_status", ["verificationStatus"])
    .index("by_base_location", ["baseLocation"])
    .index("by_status_verification_status", ["status", "verificationStatus"]),

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
    amountDeducted: v.optional(v.number()),
    deductedSaleRecordIds: v.optional(v.array(v.id("saleRecords"))),
    status: storageFeeLedgerStatus,
    createdAt: v.number()
  })
    .index("by_batch_date", ["inventoryBatchId", "feeDate"])
    .index("by_farmer_status_date", ["farmerId", "status", "feeDate"])
    .index("by_warehouse_status_date", ["warehouseId", "status", "feeDate"])
    .index("by_status_date", ["status", "feeDate"]),

  marketServiceSchedules: defineTable({
    originWarehouseId: v.id("warehouses"),
    destinationName: v.string(),
    destinationInstructions: v.string(),
    timezone: v.string(),
    deliveryWeekday: v.number(),
    cutoffDaysBefore: v.number(),
    cutoffLocalTime: v.string(),
    arrivalStartLocalTime: v.string(),
    arrivalEndLocalTime: v.string(),
    minimumLoadQuantity: v.optional(v.number()),
    minimumLoadUnit: v.optional(v.string()),
    capacityQuantity: v.optional(v.number()),
    capacityUnit: v.optional(v.string()),
    status: marketServiceScheduleStatus,
    effectiveDate: v.string(),
    endDate: v.optional(v.string()),
    createdByUserId: v.id("users"),
    updatedByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_warehouse_status", ["originWarehouseId", "status"])
    .index("by_destination_status", ["destinationName", "status"])
    .index("by_status", ["status"]),

  marketDeliveryRuns: defineTable({
    scheduleId: v.id("marketServiceSchedules"),
    originWarehouseId: v.id("warehouses"),
    destinationName: v.string(),
    destinationInstructions: v.string(),
    timezone: v.string(),
    deliveryDate: v.string(),
    deliveryDateAt: v.number(),
    orderCutoffAt: v.number(),
    expectedArrivalStartAt: v.number(),
    expectedArrivalEndAt: v.number(),
    status: marketDeliveryRunStatus,
    minimumLoadQuantity: v.optional(v.number()),
    minimumLoadUnit: v.optional(v.string()),
    capacityQuantity: v.optional(v.number()),
    capacityUnit: v.optional(v.string()),
    buyerOrderIds: v.array(v.id("buyerOrders")),
    dispatchIds: v.array(v.id("dispatches")),
    cancellationReason: v.optional(v.string()),
    postponementReason: v.optional(v.string()),
    postponedFromRunId: v.optional(v.id("marketDeliveryRuns")),
    createdByUserId: v.id("users"),
    updatedByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_schedule_delivery_date", ["scheduleId", "deliveryDate"])
    .index("by_warehouse_status_date", ["originWarehouseId", "status", "deliveryDateAt"])
    .index("by_destination_status_date", ["destinationName", "status", "deliveryDateAt"])
    .index("by_status_date", ["status", "deliveryDateAt"])
    .index("by_status_order_cutoff", ["status", "orderCutoffAt"]),

  buyerOrders: defineTable({
    buyerId: v.id("buyers"),
    destinationMarket: v.string(),
    cropType: v.string(),
    requestedQuantity: v.number(),
    unit: v.string(),
    preferredGrade: v.optional(produceGrade),
    requestedDeliveryDate: v.optional(v.number()),
    marketDeliveryRunId: v.optional(v.id("marketDeliveryRuns")),
    deliveryDateSnapshot: v.optional(v.number()),
    orderCutoffSnapshot: v.optional(v.number()),
    expectedArrivalStartSnapshot: v.optional(v.number()),
    expectedArrivalEndSnapshot: v.optional(v.number()),
    fulfilmentInstructionsSnapshot: v.optional(v.string()),
    paymentDeadline: v.optional(v.number()),
    authorizedAfterCutoffByUserId: v.optional(v.id("users")),
    afterCutoffExceptionReason: v.optional(v.string()),
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
    .index("by_market_delivery_run", ["marketDeliveryRunId"])
    .index("by_market_delivery_run_status", ["marketDeliveryRunId", "status"])
    .index("by_destination_status", ["destinationMarket", "status"]),

  buyerOrderCharges: defineTable({
    buyerOrderId: v.id("buyerOrders"),
    label: v.string(),
    amount: v.number(),
    appliedRuleSnapshot: v.optional(feeRuleSnapshot),
    createdAt: v.number()
  }).index("by_order", ["buyerOrderId"]),

  paymentTransactions: defineTable({
    buyerOrderId: v.id("buyerOrders"),
    buyerId: v.id("buyers"),
    provider: paymentProvider,
    providerReference: v.string(),
    providerAccessCode: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: paymentTransactionStatus,
    idempotencyKey: v.string(),
    correlationId: v.optional(v.string()),
    initializedByUserId: v.id("users"),
    verifiedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
    rawProviderData: v.optional(genericRecord),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_order", ["buyerOrderId"])
    .index("by_order_status", ["buyerOrderId", "status"])
    .index("by_provider_reference", ["provider", "providerReference"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status_created_at", ["status", "createdAt"]),

  paymentWebhookEvents: defineTable({
    provider: paymentProvider,
    providerEventId: v.string(),
    providerReference: v.optional(v.string()),
    eventType: v.string(),
    status: paymentEventStatus,
    paymentTransactionId: v.optional(v.id("paymentTransactions")),
    rawPayload: genericRecord,
    processedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_provider_event", ["provider", "providerEventId"])
    .index("by_reference", ["provider", "providerReference"])
    .index("by_status_created_at", ["status", "createdAt"]),

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
    storageFeeLedgerId: v.optional(v.id("storageFeeLedger")),
    label: v.string(),
    amount: v.number(),
    appliedRuleSnapshot: v.optional(feeRuleSnapshot),
    createdAt: v.number()
  })
    .index("by_sale", ["saleRecordId"])
    .index("by_farmer", ["farmerId"])
    .index("by_batch", ["inventoryBatchId"]),

  payoutLedger: defineTable({
    saleRecordId: v.id("saleRecords"),
    farmerId: v.id("farmers"),
    buyerOrderId: v.id("buyerOrders"),
    amount: v.number(),
    currency: v.string(),
    status: payoutLedgerStatus,
    sourcePaymentTransactionId: v.optional(v.id("paymentTransactions")),
    approvedByUserId: v.optional(v.id("users")),
    processedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    provider: v.optional(paymentProvider),
    providerReference: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_sale", ["saleRecordId"])
    .index("by_farmer_status", ["farmerId", "status"])
    .index("by_order", ["buyerOrderId"])
    .index("by_status_created_at", ["status", "createdAt"]),

  dispatches: defineTable({
    marketDeliveryRunId: v.optional(v.id("marketDeliveryRuns")),
    warehouseId: v.id("warehouses"),
    destination: v.string(),
    transporterId: v.optional(v.id("transporterProfiles")),
    driverName: v.optional(v.string()),
    driverPhoneNumber: v.optional(v.string()),
    vehicleType: v.optional(v.string()),
    vehicleCapacity: v.optional(v.number()),
    vehicleCapacityUnit: v.optional(v.string()),
    saleRecordIds: v.optional(v.array(v.id("saleRecords"))),
    reservationIds: v.optional(v.array(v.id("inventoryReservations"))),
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
    .index("by_market_delivery_run", ["marketDeliveryRunId"])
    .index("by_destination_status", ["destination", "status"])
    .index("by_transporter_status", ["transporterId", "status"])
    .index("by_warehouse_destination_status", ["warehouseId", "destination", "status"]),

  notifications: defineTable({
    recipientId: v.optional(v.string()),
    recipientUserId: v.optional(v.id("users")),
    recipientRole: marketplaceRole,
    channel: v.union(v.literal("sms"), v.literal("in_app"), v.literal("email")),
    status: notificationStatus,
    title: v.string(),
    message: v.string(),
    body: v.optional(v.string()),
    messageKind: v.optional(smsMessageKind),
    templateKey: v.optional(smsTemplateKey),
    templateData: v.optional(genericRecord),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    marketDeliveryRunId: v.optional(v.id("marketDeliveryRuns")),
    actionUrl: v.optional(v.string()),
    actionRequired: v.optional(v.boolean()),
    priority: v.optional(notificationPriority),
    dueAt: v.optional(v.number()),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedByUserId: v.optional(v.id("users")),
    deduplicationKey: v.optional(v.string()),
    escalationLevel: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    readAt: v.optional(v.number())
  })
    .index("by_recipient_status", ["recipientUserId", "status"])
    .index("by_role_status", ["recipientRole", "status"])
    .index("by_status", ["status"])
    .index("by_recipient_deduplication", ["recipientUserId", "deduplicationKey"])
    .index("by_market_delivery_run", ["marketDeliveryRunId"])
    .index("by_related_entity", ["relatedEntityType", "relatedEntityId"]),

  smsDeliveries: defineTable({
    provider: smsProvider,
    providerMessageId: v.string(),
    recipient: v.string(),
    status: smsDeliveryStatus,
    idempotencyKey: v.optional(v.string()),
    messageKind: v.optional(smsMessageKind),
    templateKey: v.optional(smsTemplateKey),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    notificationId: v.optional(v.id("notifications")),
    network: v.optional(v.string()),
    providerTimestamp: v.optional(v.number()),
    creditsUsed: v.optional(v.number()),
    creditsCharged: v.optional(v.number()),
    rawCode: v.optional(v.string()),
    rawMessage: v.optional(v.string()),
    rawPayload: v.optional(genericRecord),
    errorClass: v.optional(v.string()),
    attemptedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_provider_message", ["provider", "providerMessageId"])
    .index("by_provider_message_recipient", ["provider", "providerMessageId", "recipient"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_notification_status", ["notificationId", "status"])
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_recipient_status", ["recipient", "status"])
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
