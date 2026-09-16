import { v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { assertAllowed } from "./workflowHelpers";

const confirmationToken = "DELETE_PREVIEW_WINDOW_DATA";
const maximumRecordsPerRun = 2_500;

type CountMap = Record<string, number>;
type PilotProgrammeId = Id<"pilotProgrammes">;
type UserId = Id<"users">;

export const run = internalMutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    farmerUserId: v.id("users"),
    buyerUserId: v.id("users"),
    transporterUserId: v.id("users"),
    operationsUserId: v.id("users"),
    backgroundFarmerUserIds: v.array(v.id("users")),
    startAt: v.number(),
    endAt: v.number(),
    execute: v.optional(v.boolean()),
    confirm: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const execute = args.execute ?? false;
    validateWindow(args.startAt, args.endAt);
    if (execute) {
      assertAllowed(
        args.confirm === confirmationToken,
        `Execution requires the exact confirmation token ${confirmationToken}.`,
      );
    } else {
      assertAllowed(
        args.confirm === undefined,
        "Do not pass a confirmation token when previewing cleanup.",
      );
    }

    const actorIds = new Set<UserId>([
      args.farmerUserId,
      args.buyerUserId,
      args.transporterUserId,
      args.operationsUserId,
      ...args.backgroundFarmerUserIds,
    ]);
    assertAllowed(
      args.backgroundFarmerUserIds.length === 2 && actorIds.size === 6,
      "Preview cleanup requires the four public actors and two distinct background farmer user IDs.",
    );

    const programme = await ctx.db.get(args.programmeId);
    assertAllowed(
      programme !== null,
      "The exact pilot programme was not found.",
    );
    assertAllowed(
      programme.datasetId === "temporary-public-preview-2026-09" &&
        programme.previewCoordinationUntil !== undefined,
      "Programme is not the bounded public preview programme. Cleanup stopped.",
    );

    await Promise.all([
      requireUserRole(ctx, args.farmerUserId, "farmer"),
      requireUserRole(ctx, args.buyerUserId, "buyer"),
      requireUserRole(ctx, args.transporterUserId, "transporter"),
      requireUserRole(ctx, args.operationsUserId, "warehouse_agent"),
      ...args.backgroundFarmerUserIds.map((userId) =>
        requireUserRole(ctx, userId, "farmer"),
      ),
    ]);
    const [
      farmers,
      backgroundFarmerProfiles,
      buyers,
      transporters,
      operationsAgents,
    ] = await Promise.all([
      ctx.db
        .query("farmers")
        .withIndex("by_user", (query) => query.eq("userId", args.farmerUserId))
        .collect(),
      Promise.all(
        args.backgroundFarmerUserIds.map((userId) =>
          ctx.db
            .query("farmers")
            .withIndex("by_user", (query) => query.eq("userId", userId))
            .collect(),
        ),
      ),
      ctx.db
        .query("buyers")
        .withIndex("by_user", (query) => query.eq("userId", args.buyerUserId))
        .collect(),
      ctx.db
        .query("transporterProfiles")
        .withIndex("by_user", (query) =>
          query.eq("userId", args.transporterUserId),
        )
        .collect(),
      ctx.db
        .query("warehouseAgents")
        .withIndex("by_user", (query) =>
          query.eq("userId", args.operationsUserId),
        )
        .collect(),
    ]);
    const farmer = requireExactlyOneProfile(farmers, "farmer");
    const backgroundFarmers = backgroundFarmerProfiles.map((profiles, index) =>
      requireExactlyOneProfile(profiles, `background farmer ${index + 1}`),
    );
    for (const backgroundFarmer of backgroundFarmers) {
      assertAllowed(
        backgroundFarmer.registrationSource === "admin" &&
          backgroundFarmer.preferredWarehouseId === undefined &&
          backgroundFarmer.phoneNumber === farmer.phoneNumber,
        "A background farmer is not an isolated preview profile. Cleanup stopped.",
      );
    }
    const previewFarmerIds = new Set([
      farmer._id,
      ...backgroundFarmers.map((profile) => profile._id),
    ]);
    for (const backgroundUserId of args.backgroundFarmerUserIds) {
      const backgroundUser = await ctx.db.get(backgroundUserId);
      assertAllowed(
        backgroundUser !== null &&
          backgroundUser.authProviderId === undefined &&
          backgroundUser.phoneNumber === undefined,
        "A background farmer is linked to public authentication or an unexpected phone. Cleanup stopped.",
      );
    }
    const backgroundFarmerProfileIds = new Set(
      backgroundFarmers.map((profile) => profile._id),
    );
    const backgroundFarmerUserIds = new Set(args.backgroundFarmerUserIds);
    const buyer = requireExactlyOneProfile(buyers, "buyer");
    const transporter = requireExactlyOneProfile(transporters, "transporter");
    assertAllowed(
      operationsAgents.length <= 1,
      "Operations user has conflicting warehouse-agent profiles. Cleanup stopped.",
    );
    const operationsAgent = operationsAgents[0];
    const operationsAssignments = await ctx.db
      .query("pilotAssignments")
      .withIndex("by_programme_user", (query) =>
        query
          .eq("programmeId", args.programmeId)
          .eq("userId", args.operationsUserId),
      )
      .collect();
    assertAllowed(
      operationsAssignments.some(
        (assignment) =>
          assignment.identityKind === "warehouse_agent" &&
          (assignment.warehouseAgentId === undefined ||
            assignment.warehouseAgentId === operationsAgent?._id),
      ),
      "Operations user has no matching assignment for the exact programme. Cleanup stopped.",
    );

    const pilotBuyerRequests = new Set<Id<"pilotBuyerRequests">>();
    const pilotBuyerAgreementRevisions = new Set<
      Id<"pilotBuyerAgreementRevisions">
    >();
    const pilotSupplyDeclarations = new Set<Id<"pilotSupplyDeclarations">>();
    const pilotFarmerOffers = new Set<Id<"pilotFarmerOffers">>();
    const pilotFarmerOfferRevisions = new Set<
      Id<"pilotFarmerOfferRevisions">
    >();
    const pilotAllocations = new Set<Id<"pilotAllocations">>();
    const pilotProcurementLots = new Set<Id<"pilotProcurementLots">>();
    const pilotInspections = new Set<Id<"pilotInspections">>();
    const pilotFulfilmentPlans = new Set<Id<"pilotFulfilmentPlans">>();
    const pilotFulfilmentStops = new Set<Id<"pilotFulfilmentStops">>();
    const pilotCustodyEvents = new Set<Id<"pilotCustodyEvents">>();
    const pilotBuyerAcceptances = new Set<Id<"pilotBuyerAcceptances">>();
    const pilotFundingReservations = new Set<Id<"pilotFundingReservations">>();
    const pilotBudgetEvents = new Set<Id<"pilotBudgetEvents">>();
    const pilotFinancialEntries = new Set<Id<"pilotFinancialEntries">>();
    const pilotPaymentTransactions = new Set<Id<"pilotPaymentTransactions">>();
    const pilotActivityEvents = new Set<Id<"pilotActivityEvents">>();
    const pilotIssues = new Set<Id<"pilotIssues">>();
    const pilotIdempotencyKeys = new Set<Id<"pilotIdempotencyKeys">>();
    const paymentWebhookEvents = new Set<Id<"paymentWebhookEvents">>();
    const notifications = new Set<Id<"notifications">>();
    const webPushDeliveries = new Set<Id<"webPushDeliveries">>();
    const smsDeliveries = new Set<Id<"smsDeliveries">>();
    const uploadAssets = new Set<Id<"uploadAssets">>();
    const auditLogs = new Set<Id<"auditLogs">>();
    const clientActionReceipts = new Set<Id<"clientActionReceipts">>();
    const warnings = new Set<string>();

    const assertScoped = (
      doc: { programmeId: PilotProgrammeId; createdAt: number },
      label: string,
    ) => {
      assertAllowed(
        doc.programmeId === args.programmeId,
        `${label} crosses into another programme. Cleanup stopped.`,
      );
      assertAllowed(
        inWindow(doc.createdAt, args.startAt, args.endAt),
        `${label} crosses the exact cleanup time window. Cleanup stopped.`,
      );
    };

    for (const request of await ctx.db
      .query("pilotBuyerRequests")
      .withIndex("by_programme_status", (query) =>
        query.eq("programmeId", args.programmeId),
      )
      .collect()) {
      if (
        request.buyerId === buyer._id &&
        request.createdByUserId === args.buyerUserId &&
        inWindow(request.createdAt, args.startAt, args.endAt)
      ) {
        pilotBuyerRequests.add(request._id);
      }
    }

    for (const declaration of await ctx.db
      .query("pilotSupplyDeclarations")
      .withIndex("by_programme_status", (query) =>
        query.eq("programmeId", args.programmeId),
      )
      .collect()) {
      if (
        previewFarmerIds.has(declaration.farmerId) &&
        inWindow(declaration.createdAt, args.startAt, args.endAt)
      ) {
        pilotSupplyDeclarations.add(declaration._id);
      }
    }

    for (const requestId of pilotBuyerRequests) {
      for (const revision of await ctx.db
        .query("pilotBuyerAgreementRevisions")
        .withIndex("by_request_revision", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(revision, `Buyer agreement ${revision._id}`);
        pilotBuyerAgreementRevisions.add(revision._id);
      }
      for (const offer of await ctx.db
        .query("pilotFarmerOffers")
        .withIndex("by_request_status", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(offer, `Farmer offer ${offer._id}`);
        assertAllowed(
          previewFarmerIds.has(offer.farmerId) &&
            pilotSupplyDeclarations.has(offer.declarationId),
          `Farmer offer ${offer._id} belongs to supply outside the exact preview farmer and time window. Cleanup stopped.`,
        );
        pilotFarmerOffers.add(offer._id);
      }
      for (const revision of await ctx.db
        .query("pilotFarmerOfferRevisions")
        .withIndex("by_request_created_at", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(revision, `Farmer offer revision ${revision._id}`);
        assertAllowed(
          pilotFarmerOffers.has(revision.offerId) &&
            pilotSupplyDeclarations.has(revision.declarationId),
          `Farmer offer revision ${revision._id} crosses outside the selected preview transaction branch. Cleanup stopped.`,
        );
        pilotFarmerOfferRevisions.add(revision._id);
      }
      for (const allocation of await ctx.db
        .query("pilotAllocations")
        .withIndex("by_request_status", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(allocation, `Allocation ${allocation._id}`);
        assertAllowed(
          previewFarmerIds.has(allocation.farmerId) &&
            pilotSupplyDeclarations.has(allocation.declarationId) &&
            pilotFarmerOffers.has(allocation.offerId),
          `Allocation ${allocation._id} belongs to supply outside the exact preview farmer and time window. Cleanup stopped.`,
        );
        pilotAllocations.add(allocation._id);
      }
      for (const lot of await ctx.db
        .query("pilotProcurementLots")
        .withIndex("by_request_disposition", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(lot, `Procurement lot ${lot._id}`);
        assertAllowed(
          previewFarmerIds.has(lot.farmerId) &&
            pilotAllocations.has(lot.allocationId),
          `Procurement lot ${lot._id} belongs to supply outside the exact preview farmer and time window. Cleanup stopped.`,
        );
        pilotProcurementLots.add(lot._id);
      }
      for (const inspection of await ctx.db
        .query("pilotInspections")
        .withIndex("by_request_quality", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(inspection, `Inspection ${inspection._id}`);
        assertAllowed(
          pilotProcurementLots.has(inspection.lotId) &&
            pilotAllocations.has(inspection.allocationId) &&
            inspection.inspectedByUserId === args.operationsUserId,
          `Inspection ${inspection._id} was not recorded inside the exact preview actor branch. Cleanup stopped.`,
        );
        pilotInspections.add(inspection._id);
      }
      for (const plan of await ctx.db
        .query("pilotFulfilmentPlans")
        .withIndex("by_request", (query) => query.eq("requestId", requestId))
        .collect()) {
        assertScoped(plan, `Fulfilment plan ${plan._id}`);
        assertAllowed(
          plan.driverUserId === undefined ||
            plan.driverUserId === args.transporterUserId,
          `Fulfilment plan ${plan._id} is assigned to another transporter. Cleanup stopped.`,
        );
        pilotFulfilmentPlans.add(plan._id);
      }
      for (const event of await ctx.db
        .query("pilotCustodyEvents")
        .withIndex("by_request_occurred_at", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(event, `Custody event ${event._id}`);
        assertAllowed(
          event.recordedByUserId === args.transporterUserId ||
            event.recordedByUserId === args.operationsUserId,
          `Custody event ${event._id} was recorded by another actor. Cleanup stopped.`,
        );
        pilotCustodyEvents.add(event._id);
      }
      for (const acceptance of await ctx.db
        .query("pilotBuyerAcceptances")
        .withIndex("by_request_revision", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(acceptance, `Buyer acceptance ${acceptance._id}`);
        assertAllowed(
          acceptance.acknowledgedByBuyerUserId === args.buyerUserId,
          `Buyer acceptance ${acceptance._id} belongs to another buyer identity. Cleanup stopped.`,
        );
        pilotBuyerAcceptances.add(acceptance._id);
      }
      for (const reservation of await ctx.db
        .query("pilotFundingReservations")
        .withIndex("by_request_status", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(reservation, `Funding reservation ${reservation._id}`);
        pilotFundingReservations.add(reservation._id);
      }
      for (const entry of await ctx.db
        .query("pilotFinancialEntries")
        .withIndex("by_request_created_at", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(entry, `Financial entry ${entry._id}`);
        pilotFinancialEntries.add(entry._id);
      }
      for (const payment of await ctx.db
        .query("pilotPaymentTransactions")
        .withIndex("by_request_status", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(payment, `Payment transaction ${payment._id}`);
        pilotPaymentTransactions.add(payment._id);
      }
      for (const issue of await ctx.db
        .query("pilotIssues")
        .withIndex("by_request_status", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(issue, `Issue ${issue._id}`);
        pilotIssues.add(issue._id);
      }
      for (const activity of await ctx.db
        .query("pilotActivityEvents")
        .withIndex("by_request_created_at", (query) =>
          query.eq("requestId", requestId),
        )
        .collect()) {
        assertScoped(activity, `Activity event ${activity._id}`);
        pilotActivityEvents.add(activity._id);
      }
    }

    for (const declarationId of pilotSupplyDeclarations) {
      for (const offer of await ctx.db
        .query("pilotFarmerOffers")
        .withIndex("by_declaration_status", (query) =>
          query.eq("declarationId", declarationId),
        )
        .collect()) {
        assertScoped(offer, `Farmer offer ${offer._id}`);
        assertAllowed(
          pilotBuyerRequests.has(offer.requestId),
          `Supply declaration ${declarationId} is linked to a request outside this cleanup window. Cleanup stopped.`,
        );
      }
    }

    for (const planId of pilotFulfilmentPlans) {
      for (const stop of await ctx.db
        .query("pilotFulfilmentStops")
        .withIndex("by_plan_sequence", (query) => query.eq("planId", planId))
        .collect()) {
        assertScoped(stop, `Fulfilment stop ${stop._id}`);
        pilotFulfilmentStops.add(stop._id);
      }
    }

    for (const offerId of pilotFarmerOffers) {
      const offer = await requireRecord(ctx, offerId, "Farmer offer");
      assertAllowed(
        pilotBuyerRequests.has(offer.requestId) &&
          pilotSupplyDeclarations.has(offer.declarationId) &&
          previewFarmerIds.has(offer.farmerId),
        `Farmer offer ${offerId} leaves the exact actor or time-window closure. Cleanup stopped.`,
      );
    }
    for (const revisionId of pilotFarmerOfferRevisions) {
      const revision = await requireRecord(
        ctx,
        revisionId,
        "Farmer offer revision",
      );
      assertAllowed(
        pilotFarmerOffers.has(revision.offerId) &&
          pilotBuyerRequests.has(revision.requestId) &&
          pilotSupplyDeclarations.has(revision.declarationId) &&
          pilotBuyerAgreementRevisions.has(revision.buyerAgreementRevisionId),
        `Farmer offer revision ${revisionId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const allocationId of pilotAllocations) {
      const allocation = await requireRecord(ctx, allocationId, "Allocation");
      assertAllowed(
        pilotBuyerRequests.has(allocation.requestId) &&
          pilotSupplyDeclarations.has(allocation.declarationId) &&
          pilotFarmerOffers.has(allocation.offerId) &&
          pilotFarmerOfferRevisions.has(allocation.offerRevisionId),
        `Allocation ${allocationId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const lotId of pilotProcurementLots) {
      const lot = await requireRecord(ctx, lotId, "Procurement lot");
      assertAllowed(
        pilotBuyerRequests.has(lot.requestId) &&
          pilotAllocations.has(lot.allocationId) &&
          pilotFarmerOfferRevisions.has(lot.offerRevisionId) &&
          (lot.parentLotId === undefined ||
            pilotProcurementLots.has(lot.parentLotId)),
        `Procurement lot ${lotId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const inspectionId of pilotInspections) {
      const inspection = await requireRecord(ctx, inspectionId, "Inspection");
      assertAllowed(
        pilotBuyerRequests.has(inspection.requestId) &&
          pilotProcurementLots.has(inspection.lotId) &&
          pilotAllocations.has(inspection.allocationId) &&
          pilotBuyerAgreementRevisions.has(
            inspection.buyerAgreementRevisionId,
          ) &&
          (inspection.supersedesInspectionId === undefined ||
            pilotInspections.has(inspection.supersedesInspectionId)),
        `Inspection ${inspectionId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const planId of pilotFulfilmentPlans) {
      const plan = await requireRecord(ctx, planId, "Fulfilment plan");
      assertAllowed(
        pilotBuyerRequests.has(plan.requestId) &&
          pilotBuyerAgreementRevisions.has(plan.buyerAgreementRevisionId) &&
          (plan.transporterId === undefined ||
            plan.transporterId === transporter._id) &&
          (plan.driverUserId === undefined ||
            plan.driverUserId === args.transporterUserId),
        `Fulfilment plan ${planId} leaves the exact actor or transaction closure. Cleanup stopped.`,
      );
    }
    for (const stopId of pilotFulfilmentStops) {
      const stop = await requireRecord(ctx, stopId, "Fulfilment stop");
      assertAllowed(
        pilotFulfilmentPlans.has(stop.planId) &&
          stop.lotIds.every((lotId) => pilotProcurementLots.has(lotId)),
        `Fulfilment stop ${stopId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const eventId of pilotCustodyEvents) {
      const event = await requireRecord(ctx, eventId, "Custody event");
      assertAllowed(
        pilotBuyerRequests.has(event.requestId) &&
          pilotProcurementLots.has(event.lotId) &&
          (event.planId === undefined ||
            pilotFulfilmentPlans.has(event.planId)) &&
          (event.stopId === undefined ||
            pilotFulfilmentStops.has(event.stopId)),
        `Custody event ${eventId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const acceptanceId of pilotBuyerAcceptances) {
      const acceptance = await requireRecord(
        ctx,
        acceptanceId,
        "Buyer acceptance",
      );
      assertAllowed(
        pilotBuyerRequests.has(acceptance.requestId) &&
          pilotFulfilmentPlans.has(acceptance.planId) &&
          pilotBuyerAgreementRevisions.has(
            acceptance.buyerAgreementRevisionId,
          ) &&
          acceptance.acknowledgedByBuyerUserId === args.buyerUserId &&
          acceptance.lines.every(
            (line) =>
              pilotProcurementLots.has(line.lotId) &&
              (line.sublotId === undefined ||
                pilotProcurementLots.has(line.sublotId)) &&
              (line.issueId === undefined || pilotIssues.has(line.issueId)),
          ),
        `Buyer acceptance ${acceptanceId} leaves the exact actor or transaction closure. Cleanup stopped.`,
      );
    }
    for (const issueId of pilotIssues) {
      const issue = await requireRecord(ctx, issueId, "Issue");
      assertAllowed(
        pilotBuyerRequests.has(issue.requestId) &&
          (issue.lotId === undefined ||
            pilotProcurementLots.has(issue.lotId)) &&
          (issue.planId === undefined ||
            pilotFulfilmentPlans.has(issue.planId)) &&
          (issue.acceptanceId === undefined ||
            pilotBuyerAcceptances.has(issue.acceptanceId)),
        `Issue ${issueId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const reservationId of pilotFundingReservations) {
      const reservation = await requireRecord(
        ctx,
        reservationId,
        "Funding reservation",
      );
      assertAllowed(
        pilotBuyerRequests.has(reservation.requestId) &&
          pilotBuyerAgreementRevisions.has(
            reservation.buyerAgreementRevisionId,
          ) &&
          pilotFarmerOfferRevisions.has(reservation.farmerOfferRevisionId),
        `Funding reservation ${reservationId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }
    for (const entryId of pilotFinancialEntries) {
      const entry = await requireRecord(ctx, entryId, "Financial entry");
      assertAllowed(
        (entry.requestId === undefined ||
          pilotBuyerRequests.has(entry.requestId)) &&
          (entry.lotId === undefined ||
            pilotProcurementLots.has(entry.lotId)) &&
          (entry.offerRevisionId === undefined ||
            pilotFarmerOfferRevisions.has(entry.offerRevisionId)) &&
          (entry.acceptanceId === undefined ||
            pilotBuyerAcceptances.has(entry.acceptanceId)) &&
          (entry.fundingReservationId === undefined ||
            pilotFundingReservations.has(entry.fundingReservationId)) &&
          (entry.settlesEntryId === undefined ||
            pilotFinancialEntries.has(entry.settlesEntryId)) &&
          (entry.reversesEntryId === undefined ||
            pilotFinancialEntries.has(entry.reversesEntryId)),
        `Financial entry ${entryId} leaves the selected transaction closure. Cleanup stopped.`,
      );
    }

    const budgetDeltas = new Map<
      Id<"pilotPurchasingBudgets">,
      { reserved: number; committed: number; spent: number }
    >();
    for (const reservationId of pilotFundingReservations) {
      for (const event of await ctx.db
        .query("pilotBudgetEvents")
        .withIndex("by_reservation_created_at", (query) =>
          query.eq("reservationId", reservationId),
        )
        .collect()) {
        assertScoped(event, `Budget event ${event._id}`);
        assertAllowed(
          event.eventType !== "capacity_added",
          `Budget event ${event._id} changes programme capacity and cannot be removed by preview cleanup.`,
        );
        assertAllowed(
          event.financialEntryId === undefined ||
            pilotFinancialEntries.has(event.financialEntryId),
          `Budget event ${event._id} leaves the selected transaction closure. Cleanup stopped.`,
        );
        pilotBudgetEvents.add(event._id);
        addBudgetDelta(budgetDeltas, event);
      }
    }

    const selectedEntities: Array<readonly [string, ReadonlySet<string>]> = [
      ["pilotBuyerRequests", pilotBuyerRequests],
      ["pilotBuyerAgreementRevisions", pilotBuyerAgreementRevisions],
      ["pilotSupplyDeclarations", pilotSupplyDeclarations],
      ["pilotFarmerOffers", pilotFarmerOffers],
      ["pilotFarmerOfferRevisions", pilotFarmerOfferRevisions],
      ["pilotAllocations", pilotAllocations],
      ["pilotProcurementLots", pilotProcurementLots],
      ["pilotInspections", pilotInspections],
      ["pilotFulfilmentPlans", pilotFulfilmentPlans],
      ["pilotFulfilmentStops", pilotFulfilmentStops],
      ["pilotCustodyEvents", pilotCustodyEvents],
      ["pilotBuyerAcceptances", pilotBuyerAcceptances],
      ["pilotFundingReservations", pilotFundingReservations],
      ["pilotBudgetEvents", pilotBudgetEvents],
      ["pilotFinancialEntries", pilotFinancialEntries],
      ["pilotPaymentTransactions", pilotPaymentTransactions],
      ["pilotIssues", pilotIssues],
    ];
    const selectedEntityIds = new Set(
      selectedEntities.flatMap(([, ids]) => [...ids].map(String)),
    );

    for (const event of await ctx.db
      .query("pilotActivityEvents")
      .withIndex("by_programme_created_at", (query) =>
        query.eq("programmeId", args.programmeId),
      )
      .collect()) {
      if (
        (event.requestId !== undefined &&
          pilotBuyerRequests.has(event.requestId)) ||
        selectedEntityIds.has(event.entityId)
      ) {
        assertScoped(event, `Activity event ${event._id}`);
        pilotActivityEvents.add(event._id);
      }
    }

    for (const receipt of await ctx.db
      .query("pilotIdempotencyKeys")
      .withIndex("by_programme_created_at", (query) =>
        query.eq("programmeId", args.programmeId),
      )
      .collect()) {
      const referencesSelectedEntity = receipt.resultRefs.some((ref) =>
        selectedEntityIds.has(ref.entityId),
      );
      if (referencesSelectedEntity) {
        assertScoped(receipt, `Idempotency receipt ${receipt._id}`);
        pilotIdempotencyKeys.add(receipt._id);
      } else if (
        actorIds.has(receipt.actorUserId) &&
        receipt.resultRefs.length === 0 &&
        inWindow(receipt.createdAt, args.startAt, args.endAt)
      ) {
        pilotIdempotencyKeys.add(receipt._id);
      }
    }

    for (const actorUserId of actorIds) {
      for (const receipt of await ctx.db
        .query("clientActionReceipts")
        .withIndex("by_actor_client_action", (query) =>
          query.eq("actorUserId", actorUserId),
        )
        .collect()) {
        if (
          receipt.resultEntityId !== undefined &&
          selectedEntityIds.has(receipt.resultEntityId)
        ) {
          assertAllowed(
            inWindow(receipt.completedAt, args.startAt, args.endAt),
            `Client action receipt ${receipt._id} crosses the exact cleanup time window. Cleanup stopped.`,
          );
          clientActionReceipts.add(receipt._id);
        }
      }
    }

    for (const paymentId of pilotPaymentTransactions) {
      const payment = await ctx.db.get(paymentId);
      assertAllowed(
        payment !== null,
        `Payment transaction ${paymentId} disappeared.`,
      );
      if (payment.provider !== "mock" && payment.provider !== "paystack") {
        throw new Error(
          `Payment transaction ${paymentId} uses an unsupported provider. Cleanup stopped.`,
        );
      }
      const provider = payment.provider;
      for (const webhook of await ctx.db
        .query("paymentWebhookEvents")
        .withIndex("by_reference", (query) =>
          query
            .eq("provider", provider)
            .eq("providerReference", payment.providerReference),
        )
        .collect()) {
        if (webhook.pilotPaymentTransactionId === paymentId) {
          assertAllowed(
            inWindow(webhook.createdAt, args.startAt, args.endAt),
            `Payment webhook ${webhook._id} crosses the exact cleanup time window. Cleanup stopped.`,
          );
          paymentWebhookEvents.add(webhook._id);
        }
      }
    }

    for (const [entityType, ids] of selectedEntities) {
      for (const entityId of ids) {
        for (const notification of await ctx.db
          .query("notifications")
          .withIndex("by_related_entity", (query) =>
            query
              .eq("relatedEntityType", entityType)
              .eq("relatedEntityId", entityId),
          )
          .collect()) {
          assertAllowed(
            inWindow(notification.createdAt, args.startAt, args.endAt),
            `Notification ${notification._id} crosses the exact cleanup time window. Cleanup stopped.`,
          );
          notifications.add(notification._id);
        }
        for (const asset of await ctx.db
          .query("uploadAssets")
          .withIndex("by_related_entity", (query) =>
            query
              .eq("relatedEntityType", entityType as never)
              .eq("relatedEntityId", entityId),
          )
          .collect()) {
          assertAllowed(
            asset.pilotProgrammeId === args.programmeId,
            `Upload ${asset._id} crosses into another programme. Cleanup stopped.`,
          );
          assertAllowed(
            inWindow(asset.createdAt, args.startAt, args.endAt),
            `Upload ${asset._id} crosses the exact cleanup time window. Cleanup stopped.`,
          );
          uploadAssets.add(asset._id);
        }
        for (const auditLog of await ctx.db
          .query("auditLogs")
          .withIndex("by_entity", (query) =>
            query.eq("entityType", entityType).eq("entityId", entityId),
          )
          .collect()) {
          assertAllowed(
            inWindow(auditLog.createdAt, args.startAt, args.endAt),
            `Audit log ${auditLog._id} crosses the exact cleanup time window. Cleanup stopped.`,
          );
          auditLogs.add(auditLog._id);
        }
        for (const delivery of await ctx.db
          .query("smsDeliveries")
          .withIndex("by_related_entity", (query) =>
            query
              .eq("relatedEntityType", entityType)
              .eq("relatedEntityId", entityId),
          )
          .collect()) {
          assertAllowed(
            inWindow(delivery.createdAt, args.startAt, args.endAt),
            `SMS delivery ${delivery._id} crosses the exact cleanup time window. Cleanup stopped.`,
          );
          smsDeliveries.add(delivery._id);
        }
      }
    }

    for (const notificationId of notifications) {
      for (const delivery of await ctx.db
        .query("webPushDeliveries")
        .withIndex("by_notification_subscription", (query) =>
          query.eq("notificationId", notificationId),
        )
        .collect()) {
        assertAllowed(
          inWindow(delivery.createdAt, args.startAt, args.endAt),
          `Push delivery ${delivery._id} crosses the exact cleanup time window. Cleanup stopped.`,
        );
        webPushDeliveries.add(delivery._id);
      }
      for (const delivery of await ctx.db
        .query("smsDeliveries")
        .withIndex("by_notification_status", (query) =>
          query.eq("notificationId", notificationId),
        )
        .collect()) {
        assertAllowed(
          inWindow(delivery.createdAt, args.startAt, args.endAt),
          `SMS delivery ${delivery._id} crosses the exact cleanup time window. Cleanup stopped.`,
        );
        smsDeliveries.add(delivery._id);
      }
    }

    for (const assetId of uploadAssets) {
      for (const auditLog of await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (query) =>
          query.eq("entityType", "upload_asset").eq("entityId", assetId),
        )
        .collect()) {
        assertAllowed(
          inWindow(auditLog.createdAt, args.startAt, args.endAt),
          `Upload audit log ${auditLog._id} crosses the exact cleanup time window. Cleanup stopped.`,
        );
        auditLogs.add(auditLog._id);
      }
    }

    const budgetAdjustments = [];
    for (const [budgetId, delta] of budgetDeltas) {
      const budget = await ctx.db.get(budgetId);
      assertAllowed(
        budget !== null,
        `Purchasing budget ${budgetId} was not found.`,
      );
      assertAllowed(
        budget.programmeId === args.programmeId,
        `Purchasing budget ${budgetId} crosses into another programme. Cleanup stopped.`,
      );
      const next = {
        reservedPesewas: budget.reservedPesewas - delta.reserved,
        committedPesewas: budget.committedPesewas - delta.committed,
        spentPesewas: budget.spentPesewas - delta.spent,
      };
      assertAllowed(
        Object.values(next).every(
          (amount) => Number.isSafeInteger(amount) && amount >= 0,
        ),
        `Removing preview finance records would make budget ${budgetId} invalid. Cleanup stopped.`,
      );
      budgetAdjustments.push({
        budgetId,
        before: {
          reservedPesewas: budget.reservedPesewas,
          committedPesewas: budget.committedPesewas,
          spentPesewas: budget.spentPesewas,
        },
        after: next,
      });
    }

    const sets: Array<readonly [TableNames, ReadonlySet<Id<TableNames>>]> = [
      ["webPushDeliveries", webPushDeliveries],
      ["smsDeliveries", smsDeliveries],
      ["notifications", notifications],
      ["paymentWebhookEvents", paymentWebhookEvents],
      ["auditLogs", auditLogs],
      ["clientActionReceipts", clientActionReceipts],
      ["pilotBudgetEvents", pilotBudgetEvents],
      ["pilotActivityEvents", pilotActivityEvents],
      ["pilotIdempotencyKeys", pilotIdempotencyKeys],
      ["pilotFinancialEntries", pilotFinancialEntries],
      ["pilotPaymentTransactions", pilotPaymentTransactions],
      ["pilotBuyerAcceptances", pilotBuyerAcceptances],
      ["pilotIssues", pilotIssues],
      ["pilotCustodyEvents", pilotCustodyEvents],
      ["pilotFulfilmentStops", pilotFulfilmentStops],
      ["pilotFulfilmentPlans", pilotFulfilmentPlans],
      ["pilotInspections", pilotInspections],
      ["pilotProcurementLots", pilotProcurementLots],
      ["pilotAllocations", pilotAllocations],
      ["pilotFundingReservations", pilotFundingReservations],
      ["pilotFarmerOfferRevisions", pilotFarmerOfferRevisions],
      ["pilotFarmerOffers", pilotFarmerOffers],
      ["pilotBuyerAgreementRevisions", pilotBuyerAgreementRevisions],
      ["pilotBuyerRequests", pilotBuyerRequests],
      ["pilotSupplyDeclarations", pilotSupplyDeclarations],
      ["uploadAssets", uploadAssets],
      ["farmers", backgroundFarmerProfileIds],
      ["users", backgroundFarmerUserIds],
    ];
    const matched: CountMap = Object.fromEntries(
      sets.map(([table, ids]) => [table, ids.size]),
    );
    matched.pilotPurchasingBudgetsAdjusted = budgetAdjustments.length;
    const totalMatched = sets.reduce((total, [, ids]) => total + ids.size, 0);
    assertAllowed(
      !execute || totalMatched <= maximumRecordsPerRun,
      `Cleanup matched ${totalMatched} records, above the execution limit of ${maximumRecordsPerRun}. Narrow the exact time window.`,
    );

    const uploadObjects = await Promise.all(
      [...uploadAssets].map(async (assetId) => {
        const asset = await ctx.db.get(assetId);
        assertAllowed(asset !== null, `Upload ${assetId} disappeared.`);
        return { bucket: asset.bucket, objectKey: asset.objectKey };
      }),
    );
    if (uploadObjects.length > 0) {
      warnings.add(
        "Upload metadata is selected, but this Convex command cannot delete the matching object-storage files. Save this output and remove those exact bucket/object keys separately.",
      );
    }

    const deleted: CountMap = Object.fromEntries(
      Object.keys(matched).map((table) => [table, 0]),
    );
    if (execute) {
      const now = Date.now();
      for (const adjustment of budgetAdjustments) {
        const budget = await ctx.db.get(adjustment.budgetId);
        assertAllowed(
          budget !== null,
          `Purchasing budget ${adjustment.budgetId} disappeared.`,
        );
        await ctx.db.patch(adjustment.budgetId, {
          ...adjustment.after,
          version: budget.version + 1,
          updatedAt: now,
        });
        deleted.pilotPurchasingBudgetsAdjusted =
          (deleted.pilotPurchasingBudgetsAdjusted ?? 0) + 1;
      }
      for (const [table, ids] of sets) {
        for (const id of ids) {
          await ctx.db.delete(id);
          deleted[table] = (deleted[table] ?? 0) + 1;
        }
      }
      await ctx.db.patch(programme._id, {
        status: "closed",
        previewCoordinationUntil: undefined,
        version: programme.version + 1,
        updatedAt: now,
      });
    }

    return {
      mode: execute ? "executed" : "preview",
      constraints: {
        programmeId: args.programmeId,
        actorUserIds: {
          farmer: args.farmerUserId,
          backgroundFarmers: args.backgroundFarmerUserIds,
          buyer: args.buyerUserId,
          transporter: args.transporterUserId,
          operations: args.operationsUserId,
        },
        startAt: args.startAt,
        endAt: args.endAt,
        endExclusive: true,
      },
      rootIds: {
        buyerRequests: [...pilotBuyerRequests],
        supplyDeclarations: [...pilotSupplyDeclarations],
      },
      matched,
      deleted,
      totalMatched,
      executionLimit: maximumRecordsPerRun,
      budgetAdjustments,
      uploadObjects,
      warnings: [...warnings],
    };
  },
});

function inWindow(value: number, startAt: number, endAt: number): boolean {
  return value >= startAt && value < endAt;
}

function validateWindow(startAt: number, endAt: number): void {
  assertAllowed(
    Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt),
    "Cleanup timestamps must be integer Unix milliseconds.",
  );
  assertAllowed(startAt < endAt, "Cleanup end must be after its start.");
  assertAllowed(
    endAt - startAt <= 14 * 24 * 60 * 60 * 1_000,
    "Cleanup window cannot exceed fourteen days.",
  );
}

async function requireUserRole(
  ctx: MutationCtx,
  userId: UserId,
  expectedRole: Doc<"users">["role"],
): Promise<void> {
  const user = await ctx.db.get(userId);
  assertAllowed(user !== null, `${expectedRole} user was not found.`);
  assertAllowed(
    user.role === expectedRole,
    `${expectedRole} user ID has role ${user.role}. Cleanup stopped.`,
  );
}

function requireExactlyOneProfile<T>(profiles: readonly T[], label: string): T {
  assertAllowed(
    profiles.length === 1,
    `${label} user must have exactly one matching profile. Cleanup stopped.`,
  );
  return profiles[0]!;
}

function addBudgetDelta(
  deltas: Map<
    Id<"pilotPurchasingBudgets">,
    { reserved: number; committed: number; spent: number }
  >,
  event: Doc<"pilotBudgetEvents">,
): void {
  const delta = deltas.get(event.budgetId) ?? {
    reserved: 0,
    committed: 0,
    spent: 0,
  };
  if (event.eventType === "reserved") delta.reserved += event.amountPesewas;
  if (event.eventType === "released") delta.reserved -= event.amountPesewas;
  if (event.eventType === "committed") {
    delta.reserved -= event.amountPesewas;
    delta.committed += event.amountPesewas;
  }
  if (event.eventType === "spent") {
    delta.committed -= event.amountPesewas;
    delta.spent += event.amountPesewas;
  }
  if (event.eventType === "reversed") {
    delta.committed += event.amountPesewas;
    delta.spent -= event.amountPesewas;
  }
  deltas.set(event.budgetId, delta);
}

async function requireRecord<T extends TableNames>(
  ctx: MutationCtx,
  id: Id<T>,
  label: string,
): Promise<Doc<T>> {
  const record = await ctx.db.get(id);
  assertAllowed(record !== null, `${label} ${id} was not found.`);
  return record;
}
