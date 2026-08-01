import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type { SmsDeliveryStatus, SmsMessageKind, SmsProvider, SmsProviderErrorClass } from "@kuapa-dwaso/types";
import {
  estimateSmsSegments,
  normalizeGhanaPhoneNumber,
  normalizeSmsDeliveryStatus,
  type SmsSegmentEstimate,
} from "@kuapa-dwaso/utils";
import { getApiEnvironment } from "../config/env.js";

const arkeselSmsEndpoint = "https://sms.arkesel.com/api/v2/sms/send";
const maxHighFrequencySegments = 3;

export type SmsInput = {
  to: string | readonly string[];
  message: string;
  kind?: SmsMessageKind;
  templateKey?: string;
  metadata?: Record<string, unknown>;
  relatedEntity?: {
    type: string;
    id: string;
  };
  idempotencyKey?: string;
  correlationId?: string;
};

export type SmsDeliveryResult = {
  provider: SmsProvider;
  messageId: string;
  providerMessageId: string;
  recipients: string[];
  recipientMessageIds: Record<string, string>;
  status: SmsDeliveryStatus;
  creditsUsed?: number;
  rawCode?: string;
  rawMessage?: string;
  errorClass?: SmsProviderErrorClass;
  segmentEstimate: SmsSegmentEstimate;
};

export type ArkeselDeliveryReport = {
  provider: "arkesel";
  providerMessageId: string;
  recipient: string;
  status: SmsDeliveryStatus;
  network?: string;
  providerTimestamp?: number;
  creditsCharged?: number;
  rawPayload: Record<string, unknown>;
};

type NormalizedSmsInput = {
  message: string;
  recipients: string[];
  kind: SmsMessageKind;
  templateKey?: string;
  metadata?: Record<string, unknown>;
  relatedEntity?: { type: string; id: string };
  idempotencyKey?: string;
  correlationId?: string;
  segmentEstimate: SmsSegmentEstimate;
};

type ArkeselSendResponse = {
  status?: string;
  code?: string | number;
  message?: string;
  data?: unknown;
};

@Injectable()
export class TransactionalSmsProvider {
  private readonly logger = new Logger(TransactionalSmsProvider.name);

  async sendSms(input: SmsInput): Promise<SmsDeliveryResult> {
    const env = getApiEnvironment();
    if (env.sms.unsupportedProvider !== undefined) {
      throw new ServiceUnavailableException(`Unsupported SMS provider: ${env.sms.unsupportedProvider}.`);
    }

    const normalized = normalizeSmsInput(input);
    warnForExpensiveHighFrequencyMessage(normalized, this.logger);

    if (env.sms.provider === "mock") {
      return sendMockSms(normalized);
    }

    const arkeselConfig: { apiKey?: string; sender?: string } = {};
    if (env.sms.arkeselApiKey !== undefined) {
      arkeselConfig.apiKey = env.sms.arkeselApiKey;
    }
    if (env.sms.fromName !== undefined) {
      arkeselConfig.sender = env.sms.fromName;
    }
    return await sendArkeselSms(normalized, arkeselConfig);
  }
}

export function normalizeArkeselDeliveryReport(payload: unknown): ArkeselDeliveryReport {
  if (!isRecord(payload)) {
    throw new BadRequestException("Arkesel delivery report payload must be a JSON object.");
  }

  const providerMessageId = readString(payload, ["message_id", "messageId", "id"]);
  const recipient = readString(payload, ["recipient", "to", "number"]);
  const rawStatus = readString(payload, ["status", "delivery_status", "deliveryStatus"]);
  if (providerMessageId === undefined || recipient === undefined || rawStatus === undefined) {
    throw new BadRequestException("Arkesel delivery report is missing message id, recipient, or status.");
  }

  const report: ArkeselDeliveryReport = {
    provider: "arkesel",
    providerMessageId,
    recipient: normalizeGhanaPhoneNumber(recipient),
    status: normalizeSmsDeliveryStatus(rawStatus),
    rawPayload: payload,
  };

  const network = readString(payload, ["network", "operator", "carrier"]);
  if (network !== undefined) {
    report.network = network;
  }

  const providerTimestamp = parseProviderTimestamp(payload.timestamp ?? payload.delivered_at ?? payload.updated_at);
  if (providerTimestamp !== undefined) {
    report.providerTimestamp = providerTimestamp;
  }

  const creditsCharged = readNumber(payload, ["credits_charged", "creditsCharged", "credits_used", "creditsUsed"]);
  if (creditsCharged !== undefined) {
    report.creditsCharged = creditsCharged;
  }

  return report;
}

export function assertArkeselWebhookSignature(input: {
  payload: unknown;
  signatureHeader: string | undefined;
  secret: string | undefined;
}): void {
  if (input.secret === undefined || input.secret.trim().length === 0) {
    return;
  }
  if (input.signatureHeader === undefined || input.signatureHeader.trim().length === 0) {
    throw new UnauthorizedException("Missing Arkesel webhook signature.");
  }

  const expected = createHmac("sha256", input.secret)
    .update(JSON.stringify(input.payload))
    .digest("hex");
  const supplied = input.signatureHeader.trim().replace(/^sha256=/, "");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new UnauthorizedException("Invalid Arkesel webhook signature.");
  }
}

function normalizeSmsInput(input: SmsInput): NormalizedSmsInput {
  const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map((recipient) => {
    try {
      return normalizeGhanaPhoneNumber(recipient);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "SMS recipient phone number is invalid.");
    }
  });
  if (recipients.length === 0) {
    throw new BadRequestException("At least one SMS recipient is required.");
  }
  const message = input.message.trim();
  if (message.length === 0) {
    throw new BadRequestException("SMS message is required.");
  }

  const normalized: NormalizedSmsInput = {
    message,
    recipients: [...new Set(recipients)],
    kind: input.kind ?? "notification",
    segmentEstimate: estimateSmsSegments(message),
  };
  if (input.templateKey !== undefined) {
    normalized.templateKey = input.templateKey;
  }
  if (input.metadata !== undefined) {
    normalized.metadata = input.metadata;
  }
  if (input.relatedEntity !== undefined) {
    normalized.relatedEntity = input.relatedEntity;
  }
  if (input.idempotencyKey !== undefined) {
    normalized.idempotencyKey = input.idempotencyKey;
  }
  if (input.correlationId !== undefined) {
    normalized.correlationId = input.correlationId;
  }
  return normalized;
}

function warnForExpensiveHighFrequencyMessage(
  input: NormalizedSmsInput,
  logger: Logger,
): void {
  if (
    (input.kind === "notification" || input.kind === "otp") &&
    input.segmentEstimate.segments > maxHighFrequencySegments
  ) {
    logger.warn(
      `SMS ${input.kind} message uses ${input.segmentEstimate.segments} segments (${input.segmentEstimate.encoding}).`,
    );
  }
}

function sendMockSms(input: NormalizedSmsInput): SmsDeliveryResult {
  const providerMessageId = `mock-sms-${Buffer.from(
    `${input.kind}:${input.recipients.join(",")}:${input.message}:${input.correlationId ?? ""}`,
  )
    .toString("base64url")
    .slice(0, 24)}`;

  return {
    provider: "mock",
    messageId: providerMessageId,
    providerMessageId,
    recipients: input.recipients,
    recipientMessageIds: Object.fromEntries(input.recipients.map((recipient) => [recipient, providerMessageId])),
    status: "sent",
    creditsUsed: input.segmentEstimate.credits * input.recipients.length,
    segmentEstimate: input.segmentEstimate,
  };
}

async function sendArkeselSms(
  input: NormalizedSmsInput,
  config: { apiKey?: string; sender?: string },
): Promise<SmsDeliveryResult> {
  const sender = validateArkeselSender(config.sender);
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) {
    throw new ServiceUnavailableException("Arkesel SMS API key is not configured.");
  }

  const response = await fetch(arkeselSmsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      sender,
      message: input.message,
      recipients: input.recipients,
    }),
  });
  const body = await readJsonResponse(response);

  if (!response.ok || body.status === "error") {
    throw new ServiceUnavailableException({
      message: "Arkesel SMS delivery failed.",
      provider: "arkesel",
      rawCode: body.code === undefined ? String(response.status) : String(body.code),
      rawMessage: body.message,
      errorClass: isRetryableHttpStatus(response.status) ? "retryable" : "nonretryable",
    });
  }

  const receipts = extractArkeselSendReceipts(body.data, input.recipients);
  const providerMessageId = receipts.recipientMessageIds[receipts.recipients[0] ?? ""];
  if (providerMessageId === undefined) {
    throw new ServiceUnavailableException("Arkesel SMS response did not include a message id.");
  }

  const result: SmsDeliveryResult = {
    provider: "arkesel",
    messageId: providerMessageId,
    providerMessageId,
    recipients: receipts.recipients,
    recipientMessageIds: receipts.recipientMessageIds,
    status: "sent",
    segmentEstimate: input.segmentEstimate,
  };
  const creditsUsed = extractArkeselCreditsUsed(body.data);
  if (creditsUsed !== undefined) {
    result.creditsUsed = creditsUsed;
  }
  if (body.code !== undefined) {
    result.rawCode = String(body.code);
  }
  if (body.message !== undefined) {
    result.rawMessage = body.message;
  }
  return result;
}

function extractArkeselSendReceipts(
  data: unknown,
  requestedRecipients: readonly string[],
): { recipients: string[]; recipientMessageIds: Record<string, string> } {
  const entries = Array.isArray(data) ? data : [data];
  const recipientMessageIds: Record<string, string> = {};
  let sharedMessageId: string | undefined;

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }
    const messageId = readString(entry, ["id", "message_id", "messageId", "ID"]);
    if (messageId === undefined) {
      continue;
    }
    const rawRecipient = readString(entry, ["recipient", "to", "number"]);
    if (rawRecipient === undefined) {
      sharedMessageId ??= messageId;
      continue;
    }
    try {
      recipientMessageIds[normalizeGhanaPhoneNumber(rawRecipient)] = messageId;
    } catch {
      // Ignore an unparseable provider recipient and avoid recording a mismatched delivery ID.
    }
  }

  if (sharedMessageId !== undefined) {
    for (const recipient of requestedRecipients) {
      recipientMessageIds[recipient] ??= sharedMessageId;
    }
  }

  const recipients = requestedRecipients.filter((recipient) => recipientMessageIds[recipient] !== undefined);
  return { recipients, recipientMessageIds };
}

function extractArkeselCreditsUsed(data: unknown): number | undefined {
  const entries = Array.isArray(data) ? data : [data];
  const credits = entries
    .filter(isRecord)
    .map((entry) => readNumber(entry, ["credits_used", "creditsUsed"]))
    .filter((value): value is number => value !== undefined);
  return credits.length > 0 ? credits.reduce((total, value) => total + value, 0) : undefined;
}

function validateArkeselSender(sender: string | undefined): string {
  if (sender === undefined || sender.trim().length === 0) {
    throw new ServiceUnavailableException("SMS sender name is not configured.");
  }
  const normalized = sender.trim();
  if (!/^(?=.*[A-Za-z])[A-Za-z0-9]{1,11}$/.test(normalized)) {
    throw new ServiceUnavailableException("SMS sender name must be 1-11 alphanumeric characters with at least one letter.");
  }
  return normalized;
}

async function readJsonResponse(response: Response): Promise<ArkeselSendResponse> {
  try {
    return (await response.json()) as ArkeselSendResponse;
  } catch {
    return {};
  }
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  payload: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function readNumber(
  payload: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function parseProviderTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
