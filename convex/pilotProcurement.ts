import { v, type Infer } from "convex/values";
import {
  calculatePilotOfferAmounts,
  calculatePilotAmountPesewas,
  pilotPurchasingBudgetAvailablePesewas,
} from "@kuapa-dwaso/utils/pilot";
import {
  assertPilotQuantityGrams,
  assertExpectedVersion,
} from "@kuapa-dwaso/validators/pilot";
import { mutation, type MutationCtx } from "./_generated/server";
import { pilotPaymentDueAt } from "@kuapa-dwaso/utils/pilot-finance";
import { requirePilotCapability, requirePilotPrincipal } from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  replayEntityId,
} from "./pilotIdempotency";
import { assertAllowed } from "./workflowHelpers";
import { insertPilotActivityEvent } from "./pilotActivity";

export const purchaseCollectionArgs = v.object({
  requestId: v.id("pilotBuyerRequests"),
  lotId: v.id("pilotProcurementLots"),
  planId: v.id("pilotFulfilmentPlans"),
  stopId: v.id("pilotFulfilmentStops"),
  farmerOfferRevisionId: v.id("pilotFarmerOfferRevisions"),
  inspectionId: v.id("pilotInspections"),
  buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
  acceptedGrams: v.number(),
  evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
  fundingReservationId: v.id("pilotFundingReservations"),
  expectedFundingReservationVersion: v.number(),
  expectedBudgetVersion: v.number(),
  expectedLotVersion: v.number(),
  expectedPlanVersion: v.number(),
  idempotencyKey: v.string(),
});

/** All title, custody, budget and payable writes share the caller's Convex transaction. */
export async function acceptCollectionPurchaseHandler(
  ctx: MutationCtx,
  args: Infer<typeof purchaseCollectionArgs>,
) {
  const principal = await requirePilotPrincipal(ctx);
  const request = await ctx.db.get(args.requestId);
  assertAllowed(request !== null, "Purchase request was not found.");
  const planForAccess = await ctx.db.get(args.planId);
  if (principal.role === "transporter")
    assertAllowed(
      planForAccess !== null && planForAccess.driverUserId === principal._id,
      "Driver is not assigned to this purchase collection.",
    );
  else
    await requirePilotCapability(
      ctx,
      principal,
      request.programmeId,
      "custody:record",
    );
  const receipt = await beginPilotIdempotency(ctx, {
    programmeId: request.programmeId,
    actorUserId: principal._id,
    operationName: "pilotProcurement.acceptCollectionPurchase",
    idempotencyKey: args.idempotencyKey,
    requestHash: JSON.stringify(args),
  });
  if (receipt.kind === "replay")
    return {
      lotId: replayEntityId<"pilotProcurementLots">(
        receipt.receipt,
        "pilotProcurementLots",
      ),
      custodyEventId: replayEntityId<"pilotCustodyEvents">(
        receipt.receipt,
        "pilotCustodyEvents",
      ),
      farmerPayableEntryId: replayEntityId<"pilotFinancialEntries">(
        receipt.receipt,
        "pilotFinancialEntries",
      ),
      activityEventId: replayEntityId<"pilotActivityEvents">(
        receipt.receipt,
        "pilotActivityEvents",
      ),
    };
  const now = Date.now();
  assertPilotQuantityGrams(args.acceptedGrams, "acceptedGrams");
  for (const version of [
    args.expectedFundingReservationVersion,
    args.expectedBudgetVersion,
    args.expectedLotVersion,
    args.expectedPlanVersion,
  ])
    assertExpectedVersion(version);
  const [
    programme,
    lot,
    plan,
    stop,
    revision,
    inspection,
    agreement,
    reservation,
  ] = await Promise.all([
    ctx.db.get(request.programmeId),
    ctx.db.get(args.lotId),
    ctx.db.get(args.planId),
    ctx.db.get(args.stopId),
    ctx.db.get(args.farmerOfferRevisionId),
    ctx.db.get(args.inspectionId),
    ctx.db.get(args.buyerAgreementRevisionId),
    ctx.db.get(args.fundingReservationId),
  ]);
  assertAllowed(
    programme !== null &&
      lot !== null &&
      plan !== null &&
      stop !== null &&
      revision !== null &&
      inspection !== null &&
      agreement !== null &&
      reservation !== null,
    "Purchase collection links were not found.",
  );
  assertAllowed(
    programme.status === "active" &&
      (programme.datasetProvenance === "sample_only" ||
        programme.commercialConfigurationStatus === "approved"),
    "Purchase programme must be active with approved live terms or explicit sample provenance.",
  );
  assertAllowed(
    request.commercialMode === "kuapa_purchase" &&
      ["confirmed", "fulfilling"].includes(request.status) &&
      request.cancellationState === "none" &&
      request.currentAgreementRevisionId === agreement._id &&
      agreement.state === "acknowledged" &&
      agreement.expiresAt > now &&
      agreement.requestId === request._id &&
      agreement.programmeId === programme._id &&
      agreement.commercialMode === "kuapa_purchase",
    "Purchase requires current confirmed buyer terms without cancellation.",
  );
  assertAllowed(
    lot.version === args.expectedLotVersion &&
      lot.requestId === request._id &&
      lot.programmeId === programme._id &&
      lot.commercialMode === "kuapa_purchase" &&
      lot.offerRevisionId === revision._id &&
      lot.titleOwnerKind === "farmer" &&
      lot.titleOwnerFarmerId === lot.farmerId &&
      lot.currentCustodianKind === "farmer" &&
      lot.qualityStatus === "passed" &&
      lot.rejectedGrams === 0 &&
      lot.sourceGrams === args.acceptedGrams &&
      lot.clearedGrams === args.acceptedGrams &&
      lot.dispositionStatus === "allocated_to_plan",
    "Only an unchanged, farmer-owned, fully cleared planned lot can be purchased.",
  );
  const [offer, allocation, budget] = await Promise.all([
    ctx.db.get(revision.offerId),
    ctx.db.get(lot.allocationId),
    ctx.db.get(reservation.budgetId),
  ]);
  assertAllowed(
    offer !== null && allocation !== null && budget !== null,
    "Purchase agreement, allocation or budget was not found.",
  );
  assertAllowed(
    offer.status === "accepted" &&
      offer.acceptedRevisionId === revision._id &&
      offer.currentRevisionId === revision._id &&
      offer.farmerId === lot.farmerId &&
      revision.requestId === request._id &&
      revision.programmeId === programme._id &&
      revision.buyerAgreementRevisionId === agreement._id &&
      revision.commercialMode === "kuapa_purchase" &&
      allocation.offerRevisionId === revision._id &&
      allocation.requestId === request._id &&
      allocation.status === "quality_cleared" &&
      allocation.clearedGrams >= args.acceptedGrams,
    "Purchase offer and cleared allocation must still match the farmer's accepted terms.",
  );
  assertAllowed(
    inspection.programmeId === programme._id &&
      inspection.requestId === request._id &&
      inspection.buyerAgreementRevisionId === agreement._id &&
      inspection.allocationId === allocation._id &&
      (inspection.lotId === lot._id || inspection.lotId === lot.parentLotId) &&
      ["passed", "partial"].includes(inspection.qualityStatus) &&
      inspection.acceptedGrams >= args.acceptedGrams &&
      inspection.evidenceUploadAssetIds.length > 0,
    "Purchase needs the current evidenced inspection of this lot or its identified parent.",
  );
  const inspections = await ctx.db
    .query("pilotInspections")
    .withIndex("by_lot_created_at", (q) => q.eq("lotId", inspection.lotId))
    .collect();
  assertAllowed(
    !inspections.some((item) => item.supersedesInspectionId === inspection._id),
    "The collection inspection has been superseded.",
  );
  assertAllowed(
    plan.version === args.expectedPlanVersion &&
      plan.requestId === request._id &&
      plan.programmeId === programme._id &&
      plan.buyerAgreementRevisionId === agreement._id &&
      ["ready", "collecting"].includes(plan.status) &&
      plan.cancellationState === "none" &&
      plan.readinessBlockers.length === 0 &&
      plan.transporterId !== undefined &&
      plan.driverUserId !== undefined &&
      plan.vehicleCapacityGrams !== undefined &&
      plan.vehicleCapacityGrams >= plan.plannedGrams &&
      stop.planId === plan._id &&
      stop.programmeId === programme._id &&
      stop.stopType === "collection" &&
      ["planned", "arrived"].includes(stop.status) &&
      stop.lotIds.includes(lot._id) &&
      stop.collectedGrams + args.acceptedGrams <= stop.plannedGrams,
    "Purchase collection needs the current ready plan, assigned vehicle and collection stop.",
  );
  const driver = await ctx.db.get(plan.driverUserId);
  const transporter = await ctx.db.get(plan.transporterId);
  assertAllowed(
    driver !== null &&
      driver.status === "active" &&
      driver.role === "transporter" &&
      transporter !== null &&
      transporter.userId === driver._id &&
      transporter.status === "active" &&
      transporter.verificationStatus === "verified",
    "The assigned transporter must still be approved and active.",
  );
  if (
    agreement.paymentTerms.some(
      (paymentTerm) => paymentTerm.trigger === "cleared_buyer_funds",
    )
  ) {
    const produce = calculatePilotAmountPesewas({
      quantityGrams: agreement.quantityGrams,
      rate: agreement.producePriceRate,
    });
    const required =
      produce +
      agreement.chargeTerms
        .filter((charge) => charge.payer === "buyer")
        .reduce(
          (sum, charge) =>
            sum +
            calculatePilotAmountPesewas({
              quantityGrams: agreement.quantityGrams,
              basisPesewas: produce,
              rate: charge.rate,
            }),
          0,
        );
    const payments = await ctx.db
      .query("pilotPaymentTransactions")
      .withIndex("by_request_status", (q) =>
        q.eq("requestId", request._id).eq("status", "succeeded"),
      )
      .collect();
    assertAllowed(
      payments.reduce((sum, payment) => sum + payment.amountPesewas, 0) >=
        required,
      "The agreed buyer prepayment must clear before purchase collection.",
    );
  }
  const issues = await ctx.db
    .query("pilotIssues")
    .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
    .collect();
  assertAllowed(
    !issues.some((issue) => !["closed", "resolved"].includes(issue.status)),
    "Resolve the request's blocking issues before purchase collection.",
  );
  const history = await ctx.db
    .query("pilotCustodyEvents")
    .withIndex("by_lot_occurred_at", (q) => q.eq("lotId", lot._id))
    .collect();
  assertAllowed(
    !history.some((event) => event.eventType === "collected"),
    "This lot has already been collected.",
  );
  assertAllowed(
    args.evidenceUploadAssetIds.length > 0 &&
      args.evidenceUploadAssetIds.length <= 20 &&
      new Set(args.evidenceUploadAssetIds).size ===
        args.evidenceUploadAssetIds.length,
    "Collection requires one to twenty distinct evidence files.",
  );
  for (const assetId of args.evidenceUploadAssetIds) {
    const asset = await ctx.db.get(assetId);
    assertAllowed(
      asset !== null &&
        asset.ownerUserId === principal._id &&
        asset.pilotProgrammeId === programme._id &&
        asset.accessLevel === "private" &&
        ["uploaded", "verified", "attached"].includes(asset.status) &&
        ["pilot_collection_evidence", "pilot_custody_evidence"].includes(
          asset.purpose,
        ) &&
        asset.relatedEntityType === "pilotProcurementLots" &&
        asset.relatedEntityId === lot._id,
      "Collection evidence must be completed, private, actor-owned and staged against this lot.",
    );
  }
  // Fixed lot prices and fixed fees are charged once across a revision, not once per split lot.
  const allocatedLots = await ctx.db
    .query("pilotProcurementLots")
    .withIndex("by_allocation", (q) => q.eq("allocationId", allocation._id))
    .collect();
  let priorPurchasedGrams = 0;
  for (const candidate of allocatedLots) {
    const events = await ctx.db
      .query("pilotCustodyEvents")
      .withIndex("by_lot_occurred_at", (q) => q.eq("lotId", candidate._id))
      .collect();
    if (events.some((event) => event.eventType === "collected"))
      priorPurchasedGrams += candidate.sourceGrams;
  }
  assertAllowed(
    priorPurchasedGrams + args.acceptedGrams <= revision.offeredGrams,
    "Purchase quantity exceeds the accepted offer.",
  );
  assertAllowed(
    (revision.priceBasis === "per_kg" &&
      revision.priceRate.unit === "per_kg") ||
      (revision.priceBasis === "fixed_lot" &&
        revision.priceRate.unit === "fixed" &&
        priorPurchasedGrams === 0 &&
        args.acceptedGrams === revision.offeredGrams),
    "A fixed-lot purchase must collect the entire agreed lot; split collection requires revised per-kg terms.",
  );
  const cumulative = calculatePilotOfferAmounts({
    offeredGrams: priorPurchasedGrams + args.acceptedGrams,
    priceRate: revision.priceRate,
    chargeTerms: revision.chargeTerms,
  });
  const prior =
    priorPurchasedGrams === 0
      ? 0
      : calculatePilotOfferAmounts({
          offeredGrams: priorPurchasedGrams,
          priceRate: revision.priceRate,
          chargeTerms: revision.chargeTerms,
        }).expectedNetPesewas;
  const amountPesewas = cumulative.expectedNetPesewas - prior;
  assertAllowed(
    Number.isSafeInteger(amountPesewas) && amountPesewas > 0,
    "Purchase payable must be a positive exact amount.",
  );
  assertAllowed(
    reservation.version === args.expectedFundingReservationVersion &&
      reservation.programmeId === programme._id &&
      reservation.requestId === request._id &&
      reservation.buyerAgreementRevisionId === agreement._id &&
      reservation.farmerOfferRevisionId === revision._id &&
      ["active", "partly_consumed"].includes(reservation.status) &&
      reservation.expiresAt > now &&
      budget.version === args.expectedBudgetVersion &&
      budget.programmeId === programme._id &&
      budget.status === "active" &&
      budget.datasetProvenance === programme.datasetProvenance,
    "Purchase funding is stale, expired, inactive or belongs to different terms.",
  );
  pilotPurchasingBudgetAvailablePesewas(budget);
  const availableReservation =
    reservation.produceAmountPesewas +
    reservation.knownCostAmountPesewas -
    reservation.consumedPesewas -
    reservation.releasedPesewas;
  const priorEntries = await ctx.db
    .query("pilotFinancialEntries")
    .withIndex("by_request_created_at", (q) => q.eq("requestId", request._id))
    .collect();
  const purchasedPesewas = priorEntries
    .filter(
      (entry) =>
        entry.fundingReservationId === reservation._id &&
        entry.postingKind === "obligation" &&
        entry.purpose === "farmer_proceeds",
    )
    .reduce((sum, entry) => sum + entry.amountPesewas, 0);
  assertAllowed(
    availableReservation >= amountPesewas &&
      budget.reservedPesewas >= amountPesewas &&
      reservation.produceAmountPesewas - purchasedPesewas >= amountPesewas,
    "Reserved purchase capacity is insufficient; known-cost capacity cannot fund produce.",
  );
  const terms = revision.paymentTerms.filter(
    (term) =>
      term.trigger === "purchase_collection_acceptance" ||
      term.trigger === "fixed_date",
  );
  assertAllowed(
    terms.length === 1,
    "Purchase needs one explicit farmer payment deadline.",
  );
  const term = terms[0]!;
  assertAllowed(
    Number.isSafeInteger(term.offsetCalendarDays) &&
      term.offsetCalendarDays >= 0 &&
      term.timezone === "Africa/Accra",
    "Purchase payment deadline is invalid.",
  );
  const dueAt = pilotPaymentDueAt(term, now);
  const postingKey = `purchase:${lot._id}`;
  assertAllowed(
    !priorEntries.some((entry) => entry.postingKey === `${postingKey}:payable`),
    "Purchase payable was already posted.",
  );
  const common = {
    programmeId: programme._id,
    requestId: request._id,
    lotId: lot._id,
    offerRevisionId: revision._id,
    fundingReservationId: reservation._id,
    basis: "actual" as const,
    payer: { kind: "kuapa_dwaso" as const, displayNameSnapshot: "Kuapa Dwaso" },
    payee: {
      kind: "farmer" as const,
      id: String(lot.farmerId),
      displayNameSnapshot: "Farmer",
    },
    amountPesewas,
    currency: "GHS" as const,
    evidenceUploadAssetIds: args.evidenceUploadAssetIds,
    provenance: programme.datasetProvenance,
    reasonCode: "purchase_collection_acceptance",
    recordedByUserId: principal._id,
    createdAt: now,
  };
  const farmerPayableEntryId = await ctx.db.insert("pilotFinancialEntries", {
    ...common,
    postingKind: "obligation",
    purpose: "farmer_proceeds",
    dueAt,
    postingKey: `${postingKey}:payable`,
  });
  await ctx.db.insert("pilotFinancialEntries", {
    ...common,
    postingKind: "cost",
    purpose: "purchase_inventory",
    postingKey: `${postingKey}:inventory`,
  });
  await ctx.db.patch(budget._id, {
    reservedPesewas: budget.reservedPesewas - amountPesewas,
    committedPesewas: budget.committedPesewas + amountPesewas,
    version: budget.version + 1,
    updatedAt: now,
  });
  await ctx.db.patch(reservation._id, {
    consumedPesewas: reservation.consumedPesewas + amountPesewas,
    status:
      availableReservation === amountPesewas ? "consumed" : "partly_consumed",
    version: reservation.version + 1,
    updatedAt: now,
  });
  await ctx.db.insert("pilotBudgetEvents", {
    programmeId: programme._id,
    budgetId: budget._id,
    reservationId: reservation._id,
    financialEntryId: farmerPayableEntryId,
    eventType: "committed",
    amountPesewas,
    postingKey: `${postingKey}:committed`,
    reasonCode: "purchase_collection_acceptance",
    recordedByUserId: principal._id,
    createdAt: now,
  });
  const custodyEventId = await ctx.db.insert("pilotCustodyEvents", {
    programmeId: programme._id,
    requestId: request._id,
    lotId: lot._id,
    planId: plan._id,
    stopId: stop._id,
    eventType: "collected",
    grams: args.acceptedGrams,
    fromCustodian: {
      kind: "farmer",
      id: String(lot.farmerId),
      displayNameSnapshot: "Farmer",
    },
    toCustodian: {
      kind: "transporter",
      id: String(plan.transporterId),
      displayNameSnapshot: "Assigned transporter",
    },
    location: stop.location,
    evidenceUploadAssetIds: args.evidenceUploadAssetIds,
    recordedByUserId: principal._id,
    occurredAt: now,
    createdAt: now,
  });
  await ctx.db.patch(lot._id, {
    titleOwnerKind: "kuapa_dwaso",
    titleOwnerFarmerId: undefined,
    currentCustodianKind: "transporter",
    currentCustodianId: String(plan.transporterId),
    currentLocation: stop.location,
    version: lot.version + 1,
    updatedAt: now,
  });
  await ctx.db.patch(stop._id, {
    collectedGrams: stop.collectedGrams + args.acceptedGrams,
    status:
      stop.collectedGrams + args.acceptedGrams === stop.plannedGrams
        ? "completed"
        : "arrived",
    version: stop.version + 1,
    updatedAt: now,
  });
  await ctx.db.patch(plan._id, {
    status: "collecting",
    version: plan.version + 1,
    updatedAt: now,
  });
  const activityEventId = await insertPilotActivityEvent(ctx, {
    programmeId: programme._id,
    requestId: request._id,
    entityType: "pilotProcurementLots",
    entityId: lot._id,
    entityRevision: lot.version + 1,
    eventName: "pilot.purchase.collection_accepted",
    actorUserId: principal._id,
    recipientViews: [
      {
        audience: "farmer",
        targetId: String(lot.farmerId),
        title: "Maize purchased at collection",
        detail: `Kuapa Dwaso owes GHS ${(amountPesewas / 100).toFixed(2)}. Payment deadline: ${new Date(dueAt).toISOString()}.`,
      },
      {
        audience: "pilot_ops",
        title: "Purchase collection accepted",
        detail: `${args.acceptedGrams}g collected. Farmer payment obligation recorded.`,
      },
    ],
    createdAt: now,
  });
  await completePilotIdempotency(ctx, receipt.receiptId, [
    { entityType: "pilotProcurementLots", entityId: lot._id },
    { entityType: "pilotCustodyEvents", entityId: custodyEventId },
    { entityType: "pilotFinancialEntries", entityId: farmerPayableEntryId },
    { entityType: "pilotActivityEvents", entityId: activityEventId },
  ]);
  return {
    lotId: lot._id,
    custodyEventId,
    farmerPayableEntryId,
    activityEventId,
  };
}

export const acceptCollectionPurchase = mutation({
  args: purchaseCollectionArgs,
  handler: acceptCollectionPurchaseHandler,
});
