import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const marketplaceRole = v.union(
  v.literal("farmer"),
  v.literal("agent"),
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

const agentStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended")
);

const verificationStatus = v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"));
const registrationSource = v.union(v.literal("sms"), v.literal("agent"), v.literal("web"));
const produceGrade = v.union(v.literal("A"), v.literal("B"), v.literal("C"), v.literal("mixed"));

const listingStatus = v.union(
  v.literal("draft"),
  v.literal("pending_verification"),
  v.literal("active"),
  v.literal("in_bulk_lot"),
  v.literal("reserved"),
  v.literal("sold"),
  v.literal("expired"),
  v.literal("disputed"),
  v.literal("cancelled")
);

const bulkLotStatus = v.union(
  v.literal("forming"),
  v.literal("active"),
  v.literal("buyer_interest"),
  v.literal("negotiation"),
  v.literal("reserved"),
  v.literal("transport_pending"),
  v.literal("in_transit"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("disputed")
);

const dealStatus = v.union(
  v.literal("offer_received"),
  v.literal("countered"),
  v.literal("accepted_pending_farmer_approval"),
  v.literal("accepted"),
  v.literal("transport_pending"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("disputed")
);

const paymentStatus = v.union(
  v.literal("not_required"),
  v.literal("pending"),
  v.literal("deposit_paid"),
  v.literal("fully_paid"),
  v.literal("payment_on_delivery"),
  v.literal("released"),
  v.literal("failed"),
  v.literal("refunded"),
  v.literal("disputed")
);

const approvalActionType = v.union(
  v.literal("ACCEPT_DEAL"),
  v.literal("MARK_PICKED_UP"),
  v.literal("CONFIRM_PAYMENT"),
  v.literal("CHANGE_PRICE"),
  v.literal("CHANGE_PHONE"),
  v.literal("REMOVE_FROM_BULK_LOT")
);

const approvalStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("expired")
);

const transportRequestStatus = v.union(
  v.literal("requested"),
  v.literal("matched"),
  v.literal("accepted"),
  v.literal("at_pickup"),
  v.literal("picked_up"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("cancelled"),
  v.literal("issue_reported")
);

const transportPayer = v.union(
  v.literal("buyer_pays"),
  v.literal("seller_pays"),
  v.literal("shared"),
  v.literal("included_in_price")
);

const actorRole = v.union(marketplaceRole, v.literal("system"));
const genericRecord = v.record(v.string(), v.any());

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

  farmers: defineTable({
    userId: v.optional(v.id("users")),
    farmerCode: v.string(),
    fullName: v.string(),
    phoneNumber: v.string(),
    community: v.string(),
    region: v.optional(v.string()),
    assignedAgentId: v.optional(v.id("agents")),
    registrationSource,
    verificationStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_farmer_code", ["farmerCode"])
    .index("by_phone_number", ["phoneNumber"])
    .index("by_assigned_agent", ["assignedAgentId"])
    .index("by_verification_status", ["verificationStatus"]),

  agents: defineTable({
    userId: v.id("users"),
    agentCode: v.string(),
    fullName: v.string(),
    phoneNumber: v.string(),
    operatingAreas: v.array(v.string()),
    status: agentStatus,
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_agent_code", ["agentCode"])
    .index("by_status", ["status"]),

  buyers: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    phoneNumber: v.optional(v.string()),
    organizationName: v.optional(v.string()),
    preferredLocations: v.array(v.string()),
    status: userStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  produceListings: defineTable({
    farmerId: v.id("farmers"),
    agentId: v.id("agents"),
    cropType: v.string(),
    quantity: v.number(),
    unit: v.string(),
    grade: produceGrade,
    askingPrice: v.optional(v.number()),
    negotiable: v.boolean(),
    locationArea: v.string(),
    approximatePickupArea: v.optional(v.string()),
    availableFrom: v.number(),
    availableUntil: v.number(),
    images: v.array(v.string()),
    status: listingStatus,
    lastVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_farmer", ["farmerId"])
    .index("by_agent", ["agentId"])
    .index("by_crop_location_status", ["cropType", "locationArea", "status"])
    .index("by_status_available_until", ["status", "availableUntil"]),

  bulkLots: defineTable({
    cropType: v.string(),
    locationArea: v.string(),
    totalQuantity: v.number(),
    unit: v.string(),
    farmerCount: v.number(),
    listingIds: v.array(v.id("produceListings")),
    agentId: v.id("agents"),
    grade: produceGrade,
    priceRange: v.optional(
      v.object({
        min: v.number(),
        max: v.number()
      })
    ),
    pickupWindowStart: v.number(),
    pickupWindowEnd: v.number(),
    status: bulkLotStatus,
    transportReady: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_crop_location_status", ["cropType", "locationArea", "status"])
    .index("by_agent", ["agentId"])
    .index("by_status", ["status"]),

  deals: defineTable({
    buyerId: v.id("buyers"),
    bulkLotId: v.id("bulkLots"),
    agentId: v.id("agents"),
    cropType: v.string(),
    quantity: v.number(),
    unit: v.string(),
    offerPricePerUnit: v.optional(v.number()),
    finalPricePerUnit: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    status: dealStatus,
    paymentStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_buyer", ["buyerId"])
    .index("by_agent", ["agentId"])
    .index("by_bulk_lot", ["bulkLotId"])
    .index("by_status", ["status"])
    .index("by_payment_status", ["paymentStatus"]),

  transportProviders: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    phoneNumber: v.string(),
    vehicleType: v.string(),
    vehicleCapacity: v.number(),
    capacityUnit: v.string(),
    baseLocation: v.string(),
    routesServed: v.array(v.string()),
    verificationStatus,
    rating: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_verification_status_base_location", ["verificationStatus", "baseLocation"]),

  transportRequests: defineTable({
    dealId: v.id("deals"),
    pickupLocation: v.string(),
    destination: v.string(),
    requiredCapacity: v.number(),
    unit: v.string(),
    preferredPickupDate: v.number(),
    transportPayer,
    assignedTransporterId: v.optional(v.id("transportProviders")),
    status: transportRequestStatus,
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_deal", ["dealId"])
    .index("by_status", ["status"])
    .index("by_assigned_transporter", ["assignedTransporterId"]),

  approvalRequests: defineTable({
    code: v.string(),
    farmerId: v.id("farmers"),
    requestedByAgentId: v.id("agents"),
    actionType: approvalActionType,
    status: approvalStatus,
    summary: v.string(),
    payload: genericRecord,
    expiresAt: v.number(),
    createdAt: v.number(),
    respondedAt: v.optional(v.number())
  })
    .index("by_farmer_status", ["farmerId", "status"])
    .index("by_code", ["code"])
    .index("by_expires_at", ["expiresAt"])
    .index("by_requested_by_agent", ["requestedByAgentId"]),

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
    .index("by_created_at", ["createdAt"])
    .index("by_action", ["action"]),

  disputes: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    status: v.union(v.literal("open"), v.literal("under_review"), v.literal("resolved"), v.literal("cancelled")),
    openedByUserId: v.optional(v.id("users")),
    summary: v.string(),
    resolution: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number())
  })
    .index("by_status", ["status"])
    .index("by_entity", ["entityType", "entityId"]),

  notifications: defineTable({
    recipientUserId: v.optional(v.id("users")),
    recipientRole: v.optional(marketplaceRole),
    channel: v.union(v.literal("sms"), v.literal("in_app"), v.literal("email")),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("read"), v.literal("failed"), v.literal("archived")),
    title: v.string(),
    body: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    readAt: v.optional(v.number())
  })
    .index("by_recipient_status", ["recipientUserId", "status"])
    .index("by_status", ["status"]),

  appSettings: defineTable({
    key: v.string(),
    value: v.string()
  }).index("by_key", ["key"])
});
