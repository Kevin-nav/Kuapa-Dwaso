import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api.js";

const rootDir = resolve(import.meta.dirname, "../../..");
loadEnvFile(resolve(rootDir, ".env.local"));

const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (convexUrl === undefined || convexUrl.trim().length === 0) {
  throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required to run the backend smoke flow.");
}

const client = new ConvexHttpClient(convexUrl);
const now = Date.now();
const runId = (process.env.SMOKE_RUN_ID ?? new Date(now).toISOString())
  .replace(/[^0-9A-Za-z]+/g, "")
  .slice(0, 14);
const codeRunId = runId.toUpperCase();
const plusDigits = runId.replace(/\D/g, "").padEnd(12, "0").slice(-12);

const smoke = {
  warehouseCode: `SMOKE-${codeRunId}`.slice(0, 24),
  cropType: `Smoke Tomatoes ${runId}`,
  unit: "crates",
  grade: "B",
  destinationMarket: "Smoke Tarkwa Market",
  adminAuthProviderId: "smoke-backend-admin",
  agentAuthProviderId: `smoke-backend-agent-${runId}`,
  buyerAuthProviderId: `smoke-backend-buyer-${runId}`,
  transporterAuthProviderId: `smoke-backend-transporter-${runId}`,
  scopedAdminAuthProviderId: `smoke-backend-scoped-admin-${runId}`,
  farmerPhoneNumber: `+23359${plusDigits.slice(-7)}`,
  buyerPhoneNumber: `+23358${plusDigits.slice(-7)}`,
  agentPhoneNumber: `+23357${plusDigits.slice(-7)}`,
  transporterPhoneNumber: `+23356${plusDigits.slice(-7)}`,
};

const results = [];

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").split("#")[0]?.trim();
    if (key.length > 0 && process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function mutation(name, ref, args) {
  const value = await client.mutation(ref, args);
  results.push({ step: name, ok: true });
  return value;
}

async function query(name, ref, args) {
  const value = await client.query(ref, args);
  results.push({ step: name, ok: true });
  return value;
}

async function main() {
  console.log(`Running backend smoke flow against ${convexUrl}`);
  console.log(`Smoke run id: ${runId}`);

  const adminUserId = await mutation("admin user upserted", api.users.upsertProfileByAuthProviderId, {
    authProviderId: smoke.adminAuthProviderId,
    authProvider: "smoke",
    email: "backend-smoke-admin@example.test",
    name: "Backend Smoke Admin",
    role: "admin",
    status: "active",
    authMethods: ["email_password"],
    emailVerified: true,
    mfaRequirement: "not_required",
    mfaStatus: "not_required",
  });
  try {
    await mutation("platform owner bootstrap", api.adminAccess.bootstrapFirstPlatformOwner, {
      adminUserId,
      reason: "backend smoke flow first platform owner bootstrap",
    });
  } catch (error) {
    if (!String(error?.message ?? error).includes("platform owner already exists")) {
      throw error;
    }
    results.push({ step: "platform owner bootstrap skipped", ok: true });
  }

  const summaryBefore = await query("admin summary before", api.admin.getPlatformSummaryCounts, {
    requestingUserId: adminUserId,
    requestingActorRole: "admin",
  });
  const receivedAt = now - 3 * 24 * 60 * 60 * 1000;

  let warehouse = await query("warehouse lookup", api.warehouses.getByCode, {
    code: smoke.warehouseCode,
  });
  const warehouseId =
    warehouse?._id ??
    (await mutation("warehouse created", api.warehouses.create, {
      actorUserId: adminUserId,
      code: smoke.warehouseCode,
      name: `Smoke Warehouse ${runId}`,
      community: "Smoke Community",
      district: "Smoke District",
      region: "Smoke Region",
      servedCommunities: ["Smoke Community"],
      supportedCrops: [smoke.cropType],
      storageCapacity: 1000,
      capacityUnit: smoke.unit,
      destinationMarketsServed: [smoke.destinationMarket],
      operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      dispatchDays: ["Friday"],
      status: "active",
    }));
  await mutation("warehouse activated", api.warehouses.updateStatus, {
    actorUserId: adminUserId,
    warehouseId,
    status: "active",
    reason: "backend smoke flow",
  });

  const agentUserId = await mutation("warehouse agent user upserted", api.users.upsertProfileByAuthProviderId, {
    authProviderId: smoke.agentAuthProviderId,
    authProvider: "smoke",
    phoneNumber: smoke.agentPhoneNumber,
    email: `backend-smoke-agent-${runId}@example.test`,
    name: `Backend Smoke Agent ${runId}`,
    role: "warehouse_agent",
    status: "active",
  });
  const existingAgent = await query("warehouse agent lookup", api.warehouseAgents.getByUser, {
    actorUserId: adminUserId,
    userId: agentUserId,
  });
  const warehouseAgentId =
    existingAgent?._id ??
    (await mutation("warehouse agent created", api.warehouseAgents.create, {
      actorUserId: adminUserId,
      userId: agentUserId,
      fullName: `Backend Smoke Agent ${runId}`,
      phoneNumber: smoke.agentPhoneNumber,
      assignedWarehouseIds: [],
      status: "pending",
    }));
  await mutation("warehouse agent approved", api.warehouseAgents.updateStatus, {
    actorUserId: adminUserId,
    warehouseAgentId,
    status: "approved",
    reason: "backend smoke flow",
  });
  await mutation("warehouse agent assigned", api.warehouseAgents.assignWarehouse, {
    actorUserId: adminUserId,
    warehouseAgentId,
    warehouseId,
  });

  let farmer = await query("farmer lookup", api.farmers.getByPhoneNumber, {
    actorUserId: adminUserId,
    phoneNumber: smoke.farmerPhoneNumber,
  });
  const farmerId =
    farmer?._id ??
    (await mutation("farmer registered", api.farmers.createProfile, {
      actorUserId: agentUserId,
      fullName: `Backend Smoke Farmer ${runId}`,
      phoneNumber: smoke.farmerPhoneNumber,
      community: "Smoke Community",
      region: "Smoke Region",
      preferredWarehouseId: warehouseId,
      registrationSource: "agent_assisted",
    }));
  await mutation("farmer verified", api.farmers.updateVerificationStatus, {
    actorUserId: adminUserId,
    farmerId,
    verificationStatus: "verified",
    reason: "backend smoke flow",
  });

  await mutation("storage rate configured", api.feeRules.createStorageRateRule, {
    actorUserId: adminUserId,
    warehouseId,
    cropType: smoke.cropType,
    unit: smoke.unit,
    grade: smoke.grade,
    ratePerUnitPerDay: 1.5,
    currency: "GHS",
    status: "active",
    effectiveFrom: receivedAt - 60_000,
  });
  await mutation("handling fee rule configured", api.feeRules.create, {
    actorUserId: adminUserId,
    code: `SMOKE-HANDLING-${codeRunId}`,
    label: "Smoke handling fee",
    scope: {
      warehouseId,
      cropType: smoke.cropType,
      unit: smoke.unit,
      grade: smoke.grade,
      destinationMarket: smoke.destinationMarket,
    },
    calculationType: "per_unit",
    payer: "farmer",
    ratePerUnit: 0.25,
    currency: "GHS",
    status: "active",
    effectiveFrom: now - 60_000,
  });
  await mutation("buyer service fee rule configured", api.feeRules.create, {
    actorUserId: adminUserId,
    code: `SMOKE-SERVICE-${codeRunId}`,
    label: "Smoke buyer service fee",
    scope: {
      warehouseId,
      cropType: smoke.cropType,
      unit: smoke.unit,
      grade: smoke.grade,
      destinationMarket: smoke.destinationMarket,
    },
    calculationType: "percentage_of_gross_sale",
    payer: "buyer",
    percentage: 2,
    currency: "GHS",
    status: "active",
    effectiveFrom: now - 60_000,
  });

  const inventoryBatchId = await mutation("produce intake created", api.inventoryBatches.createIntake, {
    actorUserId: agentUserId,
    farmerId,
    warehouseId,
    cropType: smoke.cropType,
    quantityReceived: 10,
    unit: smoke.unit,
    grade: smoke.grade,
    photos: ["smoke://produce-photo"],
    conditionNotes: "Smoke/demo inventory batch.",
    receivedAt,
    expectedShelfLifeDays: 7,
    sellByDate: now + 4 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 180,
    minimumPricePerUnit: 160,
    status: "received",
  });
  await mutation("inventory verified", api.inventoryBatches.updateStatus, {
    actorUserId: agentUserId,
    inventoryBatchId,
    status: "verified",
    reason: "backend smoke flow",
  });
  await mutation("inventory available", api.inventoryBatches.updateStatus, {
    actorUserId: agentUserId,
    inventoryBatchId,
    status: "available",
    reason: "backend smoke flow",
  });

  const storageFeeLedgerId = await mutation("storage fee accrued", api.storageFees.accrueForBatch, {
    actorUserId: adminUserId,
    inventoryBatchId,
    feeDate: now,
    days: 3,
  });
  const storageFees = await query("storage fee ledger visible", api.storageFees.listByBatch, {
    actorUserId: adminUserId,
    inventoryBatchId,
    limit: 10,
  });
  assert(storageFees.some((fee) => fee._id === storageFeeLedgerId && fee.amount === 45), "Expected GHS 45 storage fee ledger entry.");

  const buyerUserId = await mutation("buyer user upserted", api.users.upsertProfileByAuthProviderId, {
    authProviderId: smoke.buyerAuthProviderId,
    authProvider: "smoke",
    phoneNumber: smoke.buyerPhoneNumber,
    email: `backend-smoke-buyer-${runId}@example.test`,
    name: `Backend Smoke Buyer ${runId}`,
    role: "buyer",
    status: "active",
  });
  const buyerId = await mutation("buyer profile created", api.buyers.createOrUpdateProfile, {
    actorUserId: buyerUserId,
    userId: buyerUserId,
    fullName: `Backend Smoke Buyer ${runId}`,
    displayName: `Smoke Buyer ${runId}`,
    phoneNumber: smoke.buyerPhoneNumber,
    buyerType: "market_trader",
    organizationName: "Smoke Produce Buyers",
    destinationMarket: smoke.destinationMarket,
    verificationStatus: "verified",
    status: "active",
  });

  const availableInventory = await query("buyer browsed available inventory", api.buyerOrders.listAvailableInventory, {
    cropType: smoke.cropType,
    unit: smoke.unit,
    warehouseId,
    destinationMarket: smoke.destinationMarket,
    grade: smoke.grade,
    minimumQuantity: 5,
    limit: 10,
  });
  assert(availableInventory.some((batch) => batch.inventoryBatchId === inventoryBatchId && batch.availableQuantity >= 5), "Expected smoke inventory to be buyer-visible.");

  const buyerOrderId = await mutation("buyer order created and reserved", api.buyerOrders.create, {
    actorUserId: buyerUserId,
    buyerId,
    destinationMarket: smoke.destinationMarket,
    cropType: smoke.cropType,
    requestedQuantity: 5,
    unit: smoke.unit,
    preferredGrade: smoke.grade,
    maxPricePerUnit: 200,
    reservationExpiresAt: now + 24 * 60 * 60 * 1000,
    clientRequestId: `backend-smoke-${runId}`,
  });
  const orderAfterReservation = await query("reserved order loaded", api.buyerOrders.getById, {
    actorUserId: adminUserId,
    buyerOrderId,
  });
  assert(orderAfterReservation.status === "reserved", "Expected buyer order to be reserved.");
  assert(orderAfterReservation.reservations.length === 1, "Expected exactly one inventory reservation.");
  assert(orderAfterReservation.reservations[0].quantityReserved === 5, "Expected 5 crates reserved.");
  const reservationId = orderAfterReservation.reservations[0]._id;

  const batchAfterReservation = await query("batch after reservation loaded", api.inventoryBatches.getById, {
    actorUserId: adminUserId,
    inventoryBatchId,
  });
  assert(batchAfterReservation.status === "partially_reserved", "Expected batch to be partially reserved.");

  const saleRecordIds = await mutation("sale created from reservation", api.sales.createFromBuyerOrder, {
    actorUserId: agentUserId,
    buyerOrderId,
  });
  assert(saleRecordIds.length === 1, "Expected one sale record.");
  const sale = await query("sale detail loaded", api.sales.getById, {
    actorUserId: adminUserId,
    saleRecordId: saleRecordIds[0],
  });
  assert(sale.grossAmount === 900, "Expected GHS 900 gross sale.");
  assert(sale.storageFeeDeducted === 22.5, "Expected proportional GHS 22.50 storage deduction.");
  assert(sale.handlingFeeDeducted === 1.25, "Expected GHS 1.25 handling deduction.");
  assert(sale.netAmountDueToFarmer === 876.25, "Expected GHS 876.25 net due to farmer.");

  const preparedPayment = await mutation("buyer payment prepared", api.payments.prepareBuyerPayment, {
    actorUserId: buyerUserId,
    buyerOrderId,
    provider: "mock",
    idempotencyKey: `backend-smoke-payment-${runId}`,
    correlationId: `backend-smoke-${runId}`,
    currency: "GHS",
  });
  await mutation("mock payment provider initialization recorded", api.payments.recordProviderInitialization, {
    provider: "mock",
    providerReference: preparedPayment.providerReference,
    providerAccessCode: `mock-access-${runId}`,
    authorizationUrl: `https://mock-payments.local/checkout/${preparedPayment.providerReference}`,
    providerStatus: "pending",
    providerMessage: "backend smoke mock initialization",
  });
  await mutation("mock payment reconciled", api.payments.reconcileProviderPayment, {
    provider: "mock",
    providerReference: preparedPayment.providerReference,
    status: "successful",
    amount: preparedPayment.amount,
    currency: preparedPayment.currency,
    providerStatus: "success",
    providerMessage: "backend smoke mock payment verified",
  });
  const orderAfterPayment = await query("paid order loaded", api.buyerOrders.getById, {
    actorUserId: adminUserId,
    buyerOrderId,
  });
  assert(orderAfterPayment.paymentStatus === "fully_paid", "Expected buyer order to be fully paid.");
  const saleAfterPayment = await query("sale after payment loaded", api.sales.getById, {
    actorUserId: adminUserId,
    saleRecordId: saleRecordIds[0],
  });
  assert(saleAfterPayment.paymentStatus === "withheld", "Expected farmer sale funds to be withheld pending payout.");
  const paymentLedger = await query("payment transactions listed", api.payments.listPaymentsForFinance, {
    actorUserId: adminUserId,
    buyerOrderId,
    limit: 10,
  });
  assert(paymentLedger.some((payment) => payment.providerReference === preparedPayment.providerReference && payment.status === "successful"), "Expected successful payment transaction.");
  const payoutLedger = await query("payout ledger listed", api.payments.listPayoutLedgerForFinance, {
    actorUserId: adminUserId,
    buyerOrderId,
    status: "pending",
    limit: 10,
  });
  assert(payoutLedger.some((entry) => entry.saleRecordId === saleRecordIds[0] && entry.amount === sale.netAmountDueToFarmer), "Expected pending payout ledger entry.");

  await mutation("sale payment marked paid", api.sales.updatePaymentStatus, {
    actorUserId: adminUserId,
    saleRecordId: saleRecordIds[0],
    paymentStatus: "paid",
    reason: "backend smoke flow",
  });

  const dispatchId = await mutation("dispatch created", api.dispatches.create, {
    actorUserId: agentUserId,
    buyerOrderIds: [buyerOrderId],
    destination: smoke.destinationMarket,
    driverName: `Smoke Driver ${runId}`,
    driverPhoneNumber: smoke.transporterPhoneNumber,
    vehicleType: "truck",
    vehicleCapacity: 50,
    vehicleCapacityUnit: smoke.unit,
    plannedDepartureAt: now + 2 * 60 * 60 * 1000,
    expectedArrivalAt: now + 6 * 60 * 60 * 1000,
    transportCost: 120,
    transportPayer: "buyer",
    clientRequestId: `backend-smoke-${runId}`,
  });
  for (const status of ["loading", "departed", "in_transit", "arrived", "delivered", "closed"]) {
    await mutation(`dispatch status ${status}`, api.dispatches.updateStatus, {
      actorUserId: agentUserId,
      dispatchId,
      status,
      reason: "backend smoke flow",
    });
  }
  const dispatch = await query("dispatch detail loaded", api.dispatches.getById, {
    actorUserId: adminUserId,
    dispatchId,
  });
  assert(dispatch.status === "closed", "Expected dispatch to close.");

  const intakeNotifications = await query("intake notifications listed", api.notifications.listByRelatedEntity, {
    actorUserId: adminUserId,
    relatedEntityType: "inventory_batch",
    relatedEntityId: inventoryBatchId,
    limit: 10,
  });
  assert(intakeNotifications.length >= 2, "Expected intake and receipt notifications.");
  const reservationNotifications = await query("reservation notifications listed", api.notifications.listByRelatedEntity, {
    actorUserId: adminUserId,
    relatedEntityType: "inventory_reservation",
    relatedEntityId: reservationId,
    limit: 10,
  });
  assert(reservationNotifications.length >= 1, "Expected reservation notification.");
  const saleNotifications = await query("sale notifications listed", api.notifications.listByRelatedEntity, {
    actorUserId: adminUserId,
    relatedEntityType: "sale_record",
    relatedEntityId: saleRecordIds[0],
    limit: 10,
  });
  assert(saleNotifications.length >= 2, "Expected sale and payment notifications.");
  const dispatchNotifications = await query("dispatch notifications listed", api.notifications.listByRelatedEntity, {
    actorUserId: adminUserId,
    relatedEntityType: "dispatch",
    relatedEntityId: dispatchId,
    limit: 20,
  });
  assert(dispatchNotifications.length >= 6, "Expected dispatch lifecycle notifications.");
  const relatedNotifications = await query("recent audit loaded", api.admin.listRecentActivity, {
    requestingUserId: adminUserId,
    requestingActorRole: "admin",
    limit: 100,
  });
  assert(relatedNotifications.length > 0, "Expected audited lifecycle activity.");

  const summaryAfter = await query("admin summary after", api.admin.getPlatformSummaryCounts, {
    requestingUserId: adminUserId,
    requestingActorRole: "admin",
  });
  assert(summaryAfter.inventoryBatches >= summaryBefore.inventoryBatches + 1, "Admin summary did not include new inventory.");
  assert(summaryAfter.buyerOrders >= summaryBefore.buyerOrders + 1, "Admin summary did not include new order.");
  assert(summaryAfter.saleRecords >= summaryBefore.saleRecords + 1, "Admin summary did not include new sale.");
  assert(summaryAfter.dispatches >= summaryBefore.dispatches + 1, "Admin summary did not include new dispatch.");
  assert(summaryAfter.salePaymentStatusCounts.paid >= summaryBefore.salePaymentStatusCounts.paid + 1, "Admin summary did not include paid sale.");
  assert(summaryAfter.dispatchStatusCounts.closed >= summaryBefore.dispatchStatusCounts.closed + 1, "Admin summary did not include closed dispatch.");

  const scopedAdminUserId = await mutation("scoped admin user upserted", api.users.upsertProfileByAuthProviderId, {
    authProviderId: smoke.scopedAdminAuthProviderId,
    authProvider: "smoke",
    email: `backend-smoke-scoped-admin-${runId}@example.test`,
    name: `Backend Smoke Scoped Admin ${runId}`,
    role: "admin",
    status: "active",
    authMethods: ["email_password"],
    emailVerified: true,
    mfaRequirement: "not_required",
    mfaStatus: "not_required",
  });
  await mutation("scoped warehouse manager assigned", api.adminAccess.assignDirectRole, {
    actorUserId: adminUserId,
    adminUserId: scopedAdminUserId,
    roleKey: "warehouse_manager",
    scopeType: "warehouse",
    scopeId: warehouseId,
  });
  const outOfScopeWarehouseId = await mutation("out of scope warehouse created", api.warehouses.create, {
    actorUserId: adminUserId,
    code: `SMOKE-OOS-${codeRunId}`.slice(0, 24),
    name: `Smoke Out Of Scope Warehouse ${runId}`,
    community: "Other Smoke Community",
    district: "Other Smoke District",
    region: "Other Smoke Region",
    servedCommunities: ["Other Smoke Community"],
    supportedCrops: [smoke.cropType],
    destinationMarketsServed: ["Other Smoke Market"],
    operatingDays: ["Monday"],
    status: "active",
  });
  let outOfScopeDenied = false;
  try {
    await mutation("scoped manager out of scope status update", api.warehouses.updateStatus, {
      actorUserId: scopedAdminUserId,
      warehouseId: outOfScopeWarehouseId,
      status: "inactive",
      reason: "backend smoke flow should be denied",
    });
  } catch {
    outOfScopeDenied = true;
    results.push({ step: "scoped manager out-of-scope denied", ok: true });
  }
  assert(outOfScopeDenied, "Expected scoped warehouse manager to be denied out-of-scope mutation.");

  console.log(JSON.stringify({
    ok: true,
    runId,
    ids: {
      adminUserId,
      warehouseId,
      warehouseAgentId,
      farmerId,
      inventoryBatchId,
      storageFeeLedgerId,
      buyerId,
      buyerOrderId,
      saleRecordIds,
      paymentTransactionId: preparedPayment._id,
      dispatchId,
    },
    sale: {
      grossAmount: sale.grossAmount,
      storageFeeDeducted: sale.storageFeeDeducted,
      handlingFeeDeducted: sale.handlingFeeDeducted,
      netAmountDueToFarmer: sale.netAmountDueToFarmer,
    },
    summaryDelta: {
      inventoryBatches: summaryAfter.inventoryBatches - summaryBefore.inventoryBatches,
      buyerOrders: summaryAfter.buyerOrders - summaryBefore.buyerOrders,
      saleRecords: summaryAfter.saleRecords - summaryBefore.saleRecords,
      dispatches: summaryAfter.dispatches - summaryBefore.dispatches,
      paidSales: summaryAfter.salePaymentStatusCounts.paid - summaryBefore.salePaymentStatusCounts.paid,
      paymentTransactions: paymentLedger.length,
      pendingPayouts: payoutLedger.length,
      closedDispatches: summaryAfter.dispatchStatusCounts.closed - summaryBefore.dispatchStatusCounts.closed,
      notifications:
        intakeNotifications.length +
        reservationNotifications.length +
        saleNotifications.length +
        dispatchNotifications.length,
    },
    steps: results.map((result) => result.step),
  }, null, 2));
}

main().catch((error) => {
  console.error("Backend smoke flow failed.");
  console.error(error);
  process.exitCode = 1;
});
