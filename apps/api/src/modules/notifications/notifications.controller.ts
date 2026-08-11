import { Body, Controller, Delete, Get, Headers, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PushSubscriptionInput } from "@kuapa-dwaso/types";
import { getApiEnvironment } from "../../config/env.js";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { CurrentPrincipal } from "../../lib/current-principal.js";
import type { AuthPrincipal } from "../../lib/auth-principal.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { WebPushProvider, webPushStatusCode } from "../../providers/web-push.provider.js";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly convex: ConvexPlatformProvider, private readonly push: WebPushProvider) {}

  @Get("push/config")
  config() { const publicKey = this.push.getPublicKey(); return { supported: publicKey !== undefined, ...(publicKey === undefined ? {} : { publicKey }) }; }

  @Post("push/subscriptions")
  @UseGuards(FirebaseAuthGuard)
  async subscribe(@CurrentPrincipal() principal: AuthPrincipal, @Body() body: PushSubscriptionInput) {
    if (principal.userId === undefined) throw new UnauthorizedException("A platform profile is required.");
    const id = await this.convex.upsertPushSubscription({ actorUserId: principal.userId, surface: body.surface, endpoint: body.endpoint, endpointHash: hashEndpoint(body.endpoint), p256dh: body.keys.p256dh, auth: body.keys.auth, ...(typeof body.expirationTime === "number" ? { expirationTime: body.expirationTime } : {}) });
    return { subscriptionId: id, status: "active" as const };
  }

  @Delete("push/subscriptions")
  @UseGuards(FirebaseAuthGuard)
  async unsubscribe(@CurrentPrincipal() principal: AuthPrincipal, @Body() body: { endpoint: string }) {
    if (principal.userId === undefined) throw new UnauthorizedException("A platform profile is required.");
    return { revoked: await this.convex.revokePushSubscription({ actorUserId: principal.userId, endpointHash: hashEndpoint(body.endpoint) }) };
  }

  @Post("deliveries/process")
  async process(@Body() body: { limit?: number } | undefined, @Headers() headers: Record<string, string | string[] | undefined>) {
    assertDeliverySecret(headers);
    const claimArgs: { limit?: number; retryProcessingBefore?: number } = { retryProcessingBefore: Date.now() - 10 * 60 * 1000 };
    if (body?.limit !== undefined) claimArgs.limit = body.limit;
    const deliveries = await this.convex.claimPendingPushDeliveries(claimArgs);
    let sent = 0; let failed = 0;
    for (const delivery of deliveries) {
      try {
        await this.push.send({ endpoint: delivery.endpoint, keys: delivery.keys, actionUrl: delivery.actionUrl });
        await this.convex.updatePushDeliveryStatus({ deliveryId: delivery.deliveryId, status: "sent" }); sent += 1;
      } catch (error) {
        const statusCode = webPushStatusCode(error);
        if (statusCode === 404 || statusCode === 410) await this.convex.revokePushSubscriptionByProvider(delivery.subscriptionId);
        await this.convex.updatePushDeliveryStatus({ deliveryId: delivery.deliveryId, status: "failed", error: error instanceof Error ? error.message : "Web Push delivery failed." }); failed += 1;
      }
    }
    return { ok: true, claimed: deliveries.length, sent, failed };
  }
}

function hashEndpoint(endpoint: string) { return createHash("sha256").update(endpoint).digest("hex"); }
function assertDeliverySecret(headers: Record<string, string | string[] | undefined>) {
  const env = getApiEnvironment(); const configured = env.notifications.deliverySecret;
  const value = headers["x-notification-delivery-secret"];
  if (configured === undefined ? env.nodeEnv === "production" : (Array.isArray(value) ? value[0] : value) !== configured) throw new UnauthorizedException("Invalid notification delivery secret.");
}
