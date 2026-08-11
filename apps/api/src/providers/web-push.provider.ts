import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import webPush from "web-push";
import { getApiEnvironment } from "../config/env.js";

export type WebPushSendInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  actionUrl: string;
};

@Injectable()
export class WebPushProvider {
  getPublicKey(): string | undefined {
    return getApiEnvironment().notifications.vapidPublicKey;
  }

  async send(input: WebPushSendInput): Promise<{ provider: "mock" | "vapid"; statusCode: number }> {
    const env = getApiEnvironment().notifications;
    if (env.webPushProvider === "mock") return { provider: "mock", statusCode: 201 };
    if (env.vapidSubject === undefined || env.vapidPublicKey === undefined || env.vapidPrivateKey === undefined) throw new ServiceUnavailableException("Web Push VAPID configuration is incomplete.");
    webPush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    const result = await webPush.sendNotification(
      { endpoint: input.endpoint, keys: input.keys },
      JSON.stringify({ actionUrl: safeActionUrl(input.actionUrl) }),
      { TTL: 300, urgency: "high" },
    );
    return { provider: "vapid", statusCode: result.statusCode };
  }
}

function safeActionUrl(value: string): string {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function webPushStatusCode(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined;
}
