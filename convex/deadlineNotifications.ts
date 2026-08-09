import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { insertNotificationRecord } from "./notifications";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Hourly, idempotent reminders. Detailed instructions remain in-app; SMS is only a concise alert. */
export const run = internalMutation({
  args: {},
  returns: v.object({ created: v.number(), checkedAt: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const reminderEnd = now + REMINDER_WINDOW_MS;
    let created = 0;

    const runs = await ctx.db
      .query("marketDeliveryRuns")
      .withIndex("by_status_order_cutoff", (q) => q.eq("status", "accepting_orders").gt("orderCutoffAt", now).lte("orderCutoffAt", reminderEnd))
      .take(100);
    for (const marketRun of runs) {
      if (marketRun.orderCutoffAt <= now || marketRun.orderCutoffAt > reminderEnd) continue;
      for (const orderId of marketRun.buyerOrderIds) {
        const order = await ctx.db.get(orderId);
        if (
          order === null ||
          order.paymentStatus === "fully_paid" ||
          ["cancelled", "unfulfilled", "completed"].includes(order.status)
        ) continue;
        const buyer = await ctx.db.get(order.buyerId);
        if (buyer?.userId === undefined) continue;
        const notificationId = await insertNotificationRecord(ctx, {
          recipientUserId: buyer.userId,
          recipientRole: "buyer",
          channel: "in_app",
          title: "Order cutoff approaching",
          message: `Complete payment and confirm your order for ${marketRun.destinationName} before the published cutoff.`,
          relatedEntityType: "market_delivery_run",
          relatedEntityId: marketRun._id,
          marketDeliveryRunId: marketRun._id,
          actionUrl: `/buyer/orders/${order._id}`,
          actionRequired: true,
          priority: "high",
          dueAt: marketRun.orderCutoffAt,
          deduplicationKey: `run-cutoff-24h:${marketRun._id}:${buyer._id}`,
          expiresAt: marketRun.orderCutoffAt,
        });
        const notification = await ctx.db.get(notificationId);
        if (notification?.createdAt === now) created += 1;
      }
    }

    for (const status of ["active", "partially_released"] as const) {
      const reservations = await ctx.db
        .query("inventoryReservations")
        .withIndex("by_status_expires_at", (q) => q.eq("status", status).gt("expiresAt", now).lte("expiresAt", reminderEnd))
        .collect();
      for (const reservation of reservations) {
        if (reservation.expiresAt === undefined) continue;
        const order = await ctx.db.get(reservation.buyerOrderId);
        if (order === null || order.paymentStatus === "fully_paid") continue;
        const buyer = await ctx.db.get(order.buyerId);
        if (buyer?.userId === undefined) continue;
        const common = {
          recipientUserId: buyer.userId,
          recipientRole: "buyer" as const,
          title: "Reservation expires soon",
          relatedEntityType: "inventory_reservation",
          relatedEntityId: reservation._id,
          marketDeliveryRunId: order.marketDeliveryRunId,
          dueAt: reservation.expiresAt,
          expiresAt: reservation.expiresAt,
        };
        const inAppNotificationId = await insertNotificationRecord(ctx, {
          ...common,
          channel: "in_app",
          message: "Pay by the stated deadline to keep your reserved produce on this delivery run.",
          actionUrl: `/buyer/orders/${order._id}`,
          actionRequired: true,
          priority: "urgent",
          deduplicationKey: `reservation-expiry-24h:${reservation._id}`,
        });
        const inAppNotification = await ctx.db.get(inAppNotificationId);
        if (inAppNotification?.createdAt === now) created += 1;
        if (buyer.phoneNumber !== undefined) {
          const smsNotificationId = await insertNotificationRecord(ctx, {
            ...common,
            recipientId: buyer.phoneNumber,
            channel: "sms",
            message: "Your Kuapa Dwaso reservation expires soon. Open your order for the payment deadline and details.",
            messageKind: "reservation_alert",
            templateKey: "generic_notification",
            deduplicationKey: `reservation-expiry-24h-sms:${reservation._id}`,
          });
          const smsNotification = await ctx.db.get(smsNotificationId);
          if (smsNotification?.createdAt === now) created += 1;
        }
      }
    }

    return { created, checkedAt: now };
  },
});
