import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { PaymentProvider, PaymentTransactionStatus } from "@kuapa-dwaso/types";
import { getApiEnvironment } from "../config/env.js";

const paystackBaseUrl = "https://api.paystack.co";

export type PaymentInitializeInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentInitializeResult = {
  provider: PaymentProvider;
  reference: string;
  authorizationUrl?: string;
  accessCode?: string;
  status: PaymentTransactionStatus;
  providerStatus?: string;
  providerMessage?: string;
  rawProviderData?: Record<string, unknown>;
};

export type PaymentVerificationResult = {
  provider: PaymentProvider;
  reference: string;
  amount?: number;
  currency?: string;
  status: PaymentTransactionStatus;
  providerStatus?: string;
  providerMessage?: string;
  rawProviderData?: Record<string, unknown>;
};

export type NormalizedPaymentEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  reference?: string;
  amount?: number;
  currency?: string;
  status: PaymentTransactionStatus;
  providerStatus?: string;
  providerMessage?: string;
  rawPayload: Record<string, unknown>;
};

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult>;
  verify(reference: string): Promise<PaymentVerificationResult>;
}

@Injectable()
export class PaymentProviderRegistry {
  async getProvider(): Promise<PaymentProviderAdapter> {
    const env = getApiEnvironment();
    if (env.payments.unsupportedProvider !== undefined) {
      throw new ServiceUnavailableException(`Unsupported payment provider: ${env.payments.unsupportedProvider}.`);
    }
    if (env.payments.provider === "paystack") {
      return new PaystackPaymentProvider(env.payments.paystackSecretKey);
    }
    return new MockPaymentProvider();
  }
}

export class MockPaymentProvider implements PaymentProviderAdapter {
  readonly provider = "mock" as const;

  async initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    return {
      provider: this.provider,
      reference: input.reference,
      authorizationUrl: `https://mock-payments.local/checkout/${encodeURIComponent(input.reference)}`,
      accessCode: `mock_access_${input.reference}`,
      status: "pending",
      providerStatus: "pending",
      providerMessage: "Mock payment initialized.",
      rawProviderData: {
        reference: input.reference,
        amount: input.amount,
        currency: input.currency,
      },
    };
  }

  async verify(reference: string): Promise<PaymentVerificationResult> {
    return {
      provider: this.provider,
      reference,
      status: "successful",
      providerStatus: "success",
      providerMessage: "Mock payment verified.",
      rawProviderData: { reference, status: "success" },
    };
  }
}

export class PaystackPaymentProvider implements PaymentProviderAdapter {
  readonly provider = "paystack" as const;

  constructor(private readonly secretKey: string | undefined) {}

  async initialize(input: PaymentInitializeInput): Promise<PaymentInitializeResult> {
    const body = {
      email: input.email,
      amount: toPaystackMinorAmount(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    };
    const response = await this.request<PaystackInitializeResponse>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify(removeUndefined(body)),
    });
    if (response.status !== true || response.data?.reference === undefined) {
      throw new ServiceUnavailableException(response.message ?? "Paystack transaction initialization failed.");
    }
    return removeUndefined({
      provider: this.provider,
      reference: response.data.reference,
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      status: "pending",
      providerStatus: response.status ? "pending" : "failed",
      providerMessage: response.message,
      rawProviderData: response as unknown as Record<string, unknown>,
    });
  }

  async verify(reference: string): Promise<PaymentVerificationResult> {
    const response = await this.request<PaystackVerifyResponse>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
    });
    if (response.status !== true || response.data?.reference === undefined) {
      throw new ServiceUnavailableException(response.message ?? "Paystack transaction verification failed.");
    }
    const amount = response.data.amount;
    return removeUndefined({
      provider: this.provider,
      reference: response.data.reference,
      amount: amount === undefined ? undefined : fromPaystackMinorAmount(amount),
      currency: response.data.currency,
      status: normalizePaystackTransactionStatus(response.data.status),
      providerStatus: response.data.status,
      providerMessage: response.data.gateway_response ?? response.message,
      rawProviderData: response as unknown as Record<string, unknown>,
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (this.secretKey === undefined || this.secretKey.trim().length === 0) {
      throw new ServiceUnavailableException("Paystack secret key is not configured.");
    }
    const response = await fetch(`${paystackBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = await readJson<T>(response);
    if (!response.ok) {
      throw new ServiceUnavailableException({
        message: "Paystack request failed.",
        statusCode: response.status,
        response: body,
      });
    }
    return body;
  }
}

export function normalizePaystackWebhookEvent(payload: unknown): NormalizedPaymentEvent {
  if (!isRecord(payload)) {
    throw new BadRequestException("Paystack webhook payload must be a JSON object.");
  }
  const eventType = readString(payload, "event") ?? "unknown";
  const data = isRecord(payload.data) ? payload.data : {};
  const reference = readString(data, "reference");
  const providerStatus = readString(data, "status");
  const providerEventId = readProviderEventId(payload, data, eventType, reference);
  const amount = readNumber(data, "amount");
  return removeUndefined({
    provider: "paystack" as const,
    providerEventId,
    eventType,
    reference,
    amount: amount === undefined ? undefined : fromPaystackMinorAmount(amount),
    currency: readString(data, "currency"),
    status: normalizePaystackTransactionStatus(providerStatus),
    providerStatus,
    providerMessage: readString(data, "gateway_response") ?? readString(payload, "message"),
    rawPayload: payload,
  });
}

export function assertPaystackWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | undefined;
  secret: string | undefined;
}): void {
  if (input.secret === undefined || input.secret.trim().length === 0) {
    return;
  }
  if (input.signatureHeader === undefined || input.signatureHeader.trim().length === 0) {
    throw new UnauthorizedException("Missing Paystack webhook signature.");
  }
  const expected = createHmac("sha512", input.secret).update(input.rawBody).digest("hex");
  const supplied = input.signatureHeader.trim();
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    throw new UnauthorizedException("Invalid Paystack webhook signature.");
  }
}

export function normalizePaystackTransactionStatus(status: string | undefined): PaymentTransactionStatus {
  switch (status?.trim().toLowerCase()) {
    case "success":
      return "successful";
    case "pending":
      return "pending";
    case "ongoing":
    case "processing":
    case "queued":
      return "processing";
    case "abandoned":
      return "abandoned";
    case "failed":
      return "failed";
    case "reversed":
      return "reversed";
    default:
      return "manual_review";
  }
}

function toPaystackMinorAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException("Payment amount must be positive.");
  }
  return Math.round(amount * 100);
}

function fromPaystackMinorAmount(amount: number): number {
  return Math.round(amount) / 100;
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function readProviderEventId(
  payload: Record<string, unknown>,
  data: Record<string, unknown>,
  eventType: string,
  reference: string | undefined,
): string {
  const direct = readString(payload, "id") ?? readString(data, "id");
  if (direct !== undefined) {
    return `${eventType}:${direct}`;
  }
  if (reference !== undefined) {
    return `${eventType}:${reference}:${readString(data, "status") ?? "unknown"}`;
  }
  return `${eventType}:${Buffer.from(JSON.stringify(payload)).toString("base64url").slice(0, 48)}`;
}

function readString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function readNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeUndefined<T extends Record<string, unknown>>(value: T): {
  [K in keyof T]: Exclude<T[K], undefined>;
} {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

type PaystackInitializeResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    gateway_response?: string;
  };
};
