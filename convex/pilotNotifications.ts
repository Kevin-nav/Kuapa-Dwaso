import { v } from "convex/values";
import { pilotSmsMessage } from "@kuapa-dwaso/utils/pilot-notifications";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";

type ActivityEvent = Omit<
  Doc<"pilotActivityEvents">,
  "_id" | "_creationTime"
>;
type RecipientView = ActivityEvent["recipientViews"][number];

const smsEvents = new Set([
  "pilot.offer.sent",
  "pilot.offer.revised",
  "pilot.offer.expired",
  "pilot.quality.shortfall",
  "pilot.collection.changed",
  "pilot.delivery.accepted",
  "pilot.delivery.rejected",
  "pilot.payment.recorded",
  "pilot.payment.overdue",
  "pilot.issue.resolved",
]);

function notificationRole(audience: RecipientView["audience"]) {
  if (audience === "pilot_ops") return "warehouse_agent" as const;
  if (audience === "finance" || audience === "audit") return "admin" as const;
  return audience;
}

function actionUrl(event: ActivityEvent, audience: RecipientView["audience"]) {
  if (event.requestId === undefined) return "/pilot";
  if (audience === "buyer") return `/buyer/requests/${event.requestId}`;
  if (audience === "farmer") return "/farmer/offers";
  if (audience === "transporter") return "/transporter/jobs";
  return `/operational/pilot/requests/${event.requestId}`;
}

async function directRecipient(
  ctx: MutationCtx,
  event: ActivityEvent,
  view: RecipientView,
): Promise<Id<"users"> | undefined> {
  if (view.audience === "transporter" && view.targetId !== undefined)
    return view.targetId as Id<"users">;
  if (view.audience === "pilot_ops" && view.targetId !== undefined)
    return view.targetId as Id<"users">;
  if (view.audience === "buyer") {
    const buyerId =
      view.targetId ??
      (event.requestId === undefined
        ? undefined
        : (await ctx.db.get(event.requestId))?.buyerId);
    if (buyerId === undefined) return undefined;
    return (await ctx.db.get(buyerId as Id<"buyers">))?.userId;
  }
  if (view.audience === "farmer" && view.targetId !== undefined)
    return (await ctx.db.get(view.targetId as Id<"farmers">))?.userId;
  if (view.audience === "admin" && view.targetId !== undefined)
    return view.targetId as Id<"users">;
  return undefined;
}

async function recipientsForView(
  ctx: MutationCtx,
  event: ActivityEvent,
  view: RecipientView,
) {
  const direct = await directRecipient(ctx, event, view);
  if (direct !== undefined) return [direct];
  if (!["pilot_ops", "finance", "admin", "audit"].includes(view.audience))
    return [];
  const assignments = await ctx.db
    .query("pilotAssignments")
    .withIndex("by_programme_status", (q) =>
      q.eq("programmeId", event.programmeId).eq("status", "active"),
    )
    .collect();
  return [
    ...new Set(
      assignments
        .filter((assignment) => {
          if (assignment.expiresAt !== undefined && assignment.expiresAt <= Date.now())
            return false;
          if (view.audience === "pilot_ops")
            return assignment.capabilities.includes("pilot:read");
          return assignment.identityKind === "admin";
        })
        .map((assignment) => assignment.userId),
    ),
  ];
}

async function isSampleProgramme(ctx: MutationCtx, event: ActivityEvent) {
  return (await ctx.db.get(event.programmeId))?.datasetProvenance === "sample_only";
}

export async function enqueuePilotNotificationsForEvent(
  ctx: MutationCtx,
  eventId: Id<"pilotActivityEvents">,
  event: ActivityEvent,
) {
  const samplePrefix = (await isSampleProgramme(ctx, event)) ? "Sample: " : "";
  const notificationIds: Id<"notifications">[] = [];
  for (const view of event.recipientViews) {
    const recipients = await recipientsForView(ctx, event, view);
    for (const recipientUserId of recipients) {
      const role = notificationRole(view.audience);
      notificationIds.push(
        await insertNotificationRecord(ctx, {
          recipientUserId,
          recipientRole: role,
          channel: "in_app",
          title: `${samplePrefix}${view.title}`,
          message: view.detail,
          messageKind: "transactional",
          templateKey: "generic_notification",
          relatedEntityType: event.entityType,
          relatedEntityId: event.entityId,
          actionUrl: actionUrl(event, view.audience),
          actionRequired: event.eventName.includes("issue") || event.eventName.includes("rejected"),
          priority: event.eventName.includes("overdue") ? "urgent" : "normal",
          deduplicationKey: `pilot-event:${eventId}:${view.audience}:${recipientUserId}:in-app`,
        }),
      );
      const user = await ctx.db.get(recipientUserId);
      if (smsEvents.has(event.eventName) && user?.phoneNumber !== undefined)
        notificationIds.push(
          await insertNotificationRecord(ctx, {
            recipientId: user.phoneNumber,
            recipientUserId,
            recipientRole: role,
            channel: "sms",
            title: `${samplePrefix}${view.title}`,
            message: pilotSmsMessage({
              sample: samplePrefix.length > 0,
              title: view.title,
              detail: view.detail,
            }),
            messageKind: "transactional",
            templateKey: "generic_notification",
            relatedEntityType: event.entityType,
            relatedEntityId: event.entityId,
            actionRequired: true,
            priority: "high",
            deduplicationKey: `pilot-event:${eventId}:${view.audience}:${recipientUserId}:sms`,
          }),
        );
    }
  }
  return notificationIds;
}

export const enqueueForEvent = internalMutation({
  args: { eventId: v.id("pilotActivityEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (event === null) return [];
    return await enqueuePilotNotificationsForEvent(ctx, event._id, event);
  },
});
