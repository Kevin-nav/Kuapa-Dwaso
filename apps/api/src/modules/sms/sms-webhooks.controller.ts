import { Body, Controller, Headers, Post } from "@nestjs/common";
import { getApiEnvironment } from "../../config/env.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import {
  assertArkeselWebhookSignature,
  normalizeArkeselDeliveryReport,
} from "../../providers/sms.provider.js";

@Controller("sms/webhooks")
export class SmsWebhooksController {
  constructor(private readonly convex: ConvexPlatformProvider) {}

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
