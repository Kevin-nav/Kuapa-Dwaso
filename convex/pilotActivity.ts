import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { query } from "./_generated/server";
import {
  requirePilotCapability,
  requirePilotPrincipal,
  requirePilotRequestRead,
} from "./pilotAccess";
import { enqueuePilotNotificationsForEvent } from "./pilotNotifications";
import { assertAllowed } from "./workflowHelpers";

type NewActivityEvent = Omit<
  Doc<"pilotActivityEvents">,
  "_id" | "_creationTime"
>;

export async function insertPilotActivityEvent(
  ctx: MutationCtx,
  event: NewActivityEvent,
): Promise<Id<"pilotActivityEvents">> {
  const eventId = await ctx.db.insert("pilotActivityEvents", event);
  await enqueuePilotNotificationsForEvent(ctx, eventId, event);
  return eventId;
}

async function targetForPrincipal(
  ctx: Parameters<typeof requirePilotPrincipal>[0],
  principal: Doc<"users">,
): Promise<string | undefined> {
  if (principal.role === "buyer")
    return String(
      (
        await ctx.db
          .query("buyers")
          .withIndex("by_user", (q) => q.eq("userId", principal._id))
          .unique()
      )?._id,
    );
  if (principal.role === "farmer")
    return String(
      (
        await ctx.db
          .query("farmers")
          .withIndex("by_user", (q) => q.eq("userId", principal._id))
          .unique()
      )?._id,
    );
  return String(principal._id);
}

function visibleAudiences(principal: Doc<"users">) {
  if (principal.role === "warehouse_agent") return new Set(["pilot_ops"]);
  if (principal.role === "admin")
    return new Set(["pilot_ops", "finance", "admin", "audit"]);
  return new Set([principal.role]);
}

export const listForRequest = query({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    if (principal.role === "buyer")
      await requirePilotRequestRead(ctx, principal, request);
    else if (principal.role === "admin" || principal.role === "warehouse_agent")
      await requirePilotCapability(ctx, principal, request.programmeId, "pilot:read");
    const limit = args.limit ?? 25;
    assertAllowed(
      Number.isSafeInteger(limit) && limit > 0 && limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    const page = await ctx.db
      .query("pilotActivityEvents")
      .withIndex("by_request_created_at", (q) => q.eq("requestId", args.requestId))
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: limit });
    const targetId = await targetForPrincipal(ctx, principal);
    const audiences = visibleAudiences(principal);
    return {
      ...page,
      page: page.page.flatMap((event) => {
        const views = event.recipientViews.filter(
          (view) =>
            audiences.has(view.audience) &&
            (view.targetId === targetId ||
              (view.targetId === undefined &&
                !["farmer", "transporter"].includes(principal.role))),
        );
        return views.length === 0
          ? []
          : [
              {
                eventId: event._id,
                entityType: event.entityType,
                entityId: event.entityId,
                entityRevision: event.entityRevision,
                eventName: event.eventName,
                reasonCode: event.reasonCode,
                actorUserId: event.actorUserId,
                views,
                createdAt: event.createdAt,
              },
            ];
      }),
    };
  },
});
