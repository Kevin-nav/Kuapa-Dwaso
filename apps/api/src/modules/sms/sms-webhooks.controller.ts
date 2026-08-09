import { Body, Controller, Headers, Post, UnauthorizedException } from "@nestjs/common";
import type { SmsDeliveryStatus, SmsMessageKind, SmsProvider, SmsTemplateKey } from "@kuapa-dwaso/types";
import { renderSmsTemplate } from "@kuapa-dwaso/utils";
import { getApiEnvironment } from "../../config/env.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import {
  assertArkeselWebhookSignature,
  normalizeArkeselDeliveryReport,
  TransactionalSmsProvider,
} from "../../providers/sms.provider.js";

@Controller("sms/webhooks")
export class SmsWebhooksController {
  constructor(
    private readonly convex: ConvexPlatformProvider,
    private readonly sms: TransactionalSmsProvider,
  ) {}

  @Post("deliveries/process")
  async processNotificationDeliveries(
    @Body() body: { limit?: number; retryQueuedBefore?: number } | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true; claimed: number; sent: number; failed: number }> {
    const env = getApiEnvironment();
    assertDeliveryEngineAccess(headers, env);
    const claimArgs: Parameters<ConvexPlatformProvider["claimPendingSmsDeliveries"]>[0] = {};
    if (body?.limit !== undefined) {
      claimArgs.limit = body.limit;
    }
    if (body?.retryQueuedBefore !== undefined) {
      claimArgs.retryQueuedBefore = body.retryQueuedBefore;
    }
    const claimed = await this.convex.claimPendingSmsDeliveries(claimArgs);
    let sent = 0;
    let failed = 0;

    for (const notification of claimed) {
      const renderArgs: Parameters<typeof renderSmsTemplate>[0] = {
        message: notification.message,
        messageKind: notification.messageKind,
      };
      if (notification.templateKey !== undefined) {
        renderArgs.templateKey = notification.templateKey;
      }
      if (notification.templateData !== undefined) {
        renderArgs.data = notification.templateData;
      }
      const rendered = renderSmsTemplate(renderArgs);
      await this.convex.recordSmsSend(buildRecordSmsSendArgs({
        provider: env.sms.provider,
        providerMessageId: notification.idempotencyKey,
        recipient: notification.recipient,
        status: "queued",
        idempotencyKey: notification.idempotencyKey,
        messageKind: rendered.messageKind,
        templateKey: rendered.templateKey,
        relatedEntityType: notification.relatedEntityType,
        relatedEntityId: notification.relatedEntityId,
        notificationId: notification.notificationId,
      }));

      try {
        const smsInput: Parameters<TransactionalSmsProvider["sendSms"]>[0] = {
          to: notification.recipient,
          message: rendered.message,
          kind: rendered.messageKind,
          templateKey: rendered.templateKey,
          idempotencyKey: notification.idempotencyKey,
          correlationId: notification.notificationId,
        };
        if (notification.relatedEntityType !== undefined && notification.relatedEntityId !== undefined) {
          smsInput.relatedEntity = { type: notification.relatedEntityType, id: notification.relatedEntityId };
        }
        const delivery = await this.sms.sendSms(smsInput);
        for (const recipient of delivery.recipients) {
          await this.convex.recordSmsSend(buildRecordSmsSendArgs({
            provider: delivery.provider,
            providerMessageId: delivery.recipientMessageIds[recipient] ?? delivery.providerMessageId,
            recipient,
            status: delivery.status,
            idempotencyKey: notification.idempotencyKey,
            messageKind: rendered.messageKind,
            templateKey: rendered.templateKey,
            relatedEntityType: notification.relatedEntityType,
            relatedEntityId: notification.relatedEntityId,
            notificationId: notification.notificationId,
            creditsUsed: delivery.creditsUsed,
            rawCode: delivery.rawCode,
            rawMessage: delivery.rawMessage,
          }));
          sent += 1;
        }
      } catch (error) {
        await this.convex.recordSmsSend(buildRecordSmsSendArgs({
          provider: env.sms.provider,
          providerMessageId: notification.idempotencyKey,
          recipient: notification.recipient,
          status: "failed",
          idempotencyKey: notification.idempotencyKey,
          messageKind: rendered.messageKind,
          templateKey: rendered.templateKey,
          relatedEntityType: notification.relatedEntityType,
          relatedEntityId: notification.relatedEntityId,
          notificationId: notification.notificationId,
          rawMessage: safeErrorMessage(error),
          errorClass: "retryable",
        }));
        failed += 1;
      }
    }

    return { ok: true, claimed: claimed.length, sent, failed };
  }

  @Post("arkesel/delivery")
  async recordArkeselDeliveryReport(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true; status: string; smsDeliveryId: string }> {
    const env = getApiEnvironment();
    const signatureHeader = readHeader(headers, env.sms.webhookSignatureHeader);
    assertArkeselWebhookSignature({
      payload: body,
      signatureHeader,
      secret: env.sms.webhookSignatureSecret,
    });

    const report = normalizeArkeselDeliveryReport(body);
    const recordArgs: Parameters<ConvexPlatformProvider["recordSmsDeliveryReport"]>[0] = {
      provider: report.provider,
      providerMessageId: report.providerMessageId,
      recipient: report.recipient,
      status: report.status,
      rawPayload: report.rawPayload,
    };
    if (report.network !== undefined) {
      recordArgs.network = report.network;
    }
    if (report.providerTimestamp !== undefined) {
      recordArgs.providerTimestamp = report.providerTimestamp;
    }
    if (report.creditsCharged !== undefined) {
      recordArgs.creditsCharged = report.creditsCharged;
    }

    const smsDeliveryId = await this.convex.recordSmsDeliveryReport(recordArgs);
    return { ok: true, status: report.status, smsDeliveryId };
  }
}

function buildRecordSmsSendArgs(input: {
  provider: SmsProvider;
  providerMessageId: string;
  recipient: string;
  status: SmsDeliveryStatus;
  idempotencyKey: string;
  messageKind: SmsMessageKind;
  templateKey: SmsTemplateKey;
  relatedEntityType?: string | undefined;
  relatedEntityId?: string | undefined;
  notificationId: string;
  creditsUsed?: number | undefined;
  rawCode?: string | undefined;
  rawMessage?: string | undefined;
  errorClass?: string | undefined;
}): Parameters<ConvexPlatformProvider["recordSmsSend"]>[0] {
  const args: Parameters<ConvexPlatformProvider["recordSmsSend"]>[0] = {
    provider: input.provider,
    providerMessageId: input.providerMessageId,
    recipient: input.recipient,
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    messageKind: input.messageKind,
    templateKey: input.templateKey,
    notificationId: input.notificationId,
  };
  if (input.relatedEntityType !== undefined) {
    args.relatedEntityType = input.relatedEntityType;
  }
  if (input.relatedEntityId !== undefined) {
    args.relatedEntityId = input.relatedEntityId;
  }
  if (input.creditsUsed !== undefined) {
    args.creditsUsed = input.creditsUsed;
  }
  if (input.rawCode !== undefined) {
    args.rawCode = input.rawCode;
  }
  if (input.rawMessage !== undefined) {
    args.rawMessage = input.rawMessage;
  }
  if (input.errorClass !== undefined) {
    args.errorClass = input.errorClass;
  }
  return args;
}

function assertDeliveryEngineAccess(
  headers: Record<string, string | string[] | undefined>,
  env: ReturnType<typeof getApiEnvironment>,
): void {
  const configuredSecret = env.notifications.deliverySecret;
  if (configuredSecret === undefined || configuredSecret.trim().length === 0) {
    if (env.nodeEnv === "production") {
      throw new UnauthorizedException("Notification delivery secret is required in production.");
    }
    return;
  }
  if (readHeader(headers, "x-notification-delivery-secret") !== configuredSecret) {
    throw new UnauthorizedException("Invalid notification delivery secret.");
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return "SMS delivery failed.";
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  headerName: string,
): string | undefined {
  const normalizedName = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== normalizedName) {
      continue;
    }
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}
