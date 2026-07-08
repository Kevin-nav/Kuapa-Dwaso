import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { getApiEnvironment } from "../../config/env.js";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { RequireRoles, RoleGuard } from "../../guards/role.guard.js";
import type { AuthPrincipal } from "../../lib/auth-principal.js";
import { CurrentPrincipal } from "../../lib/current-principal.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import {
  assertPaystackWebhookSignature,
  normalizePaystackWebhookEvent,
  PaymentProviderRegistry,
} from "../../providers/payment.provider.js";

type InitializePaymentBody = {
  idempotencyKey?: string;
  correlationId?: string;
  callbackUrl?: string;
  currency?: string;
};

type VerifyPaymentBody = {
  reference: string;
};

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly convex: ConvexPlatformProvider,
    private readonly payments: PaymentProviderRegistry,
  ) {}

  @Post("buyer-orders/:buyerOrderId/initialize")
  @UseGuards(FirebaseAuthGuard, RoleGuard)
  @RequireRoles("buyer", "admin")
  async initializeBuyerOrderPayment(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param("buyerOrderId") buyerOrderId: string,
    @Body() body: InitializePaymentBody | undefined,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{
    paymentTransactionId: string;
    provider: string;
    reference: string;
    authorizationUrl?: string;
    accessCode?: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const provider = await this.payments.getProvider();
    const idempotencyKey =
      body?.idempotencyKey ??
      readHeader(headers, "x-idempotency-key") ??
      `payment:${buyerOrderId}:${principal.userId}`;
    const prepareArgs: Parameters<ConvexPlatformProvider["prepareBuyerPayment"]>[0] = {
      actorUserId: principal.userId,
      buyerOrderId,
      provider: provider.provider,
      idempotencyKey,
      currency: body?.currency ?? "GHS",
    };
    if (body?.correlationId !== undefined) {
      prepareArgs.correlationId = body.correlationId;
    }
    const prepared = await this.convex.prepareBuyerPayment(prepareArgs);

    if (prepared.authorizationUrl !== undefined) {
      return omitUndefinedValues({
        paymentTransactionId: prepared._id,
        provider: prepared.provider,
        reference: prepared.providerReference,
        authorizationUrl: prepared.authorizationUrl,
        accessCode: prepared.providerAccessCode,
        amount: prepared.amount,
        currency: prepared.currency,
        status: prepared.status,
      });
    }

    const initializeArgs: Parameters<typeof provider.initialize>[0] = {
      email: resolvePaymentEmail(principal, prepared.buyerId),
      amount: prepared.amount,
      currency: prepared.currency,
      reference: prepared.providerReference,
      metadata: {
        buyerOrderId,
        buyerId: prepared.buyerId,
        paymentTransactionId: prepared._id,
        correlationId: body?.correlationId,
      },
    };
    if (body?.callbackUrl !== undefined) {
      initializeArgs.callbackUrl = body.callbackUrl;
    }
    const initialized = await provider.initialize(initializeArgs);
    await this.convex.recordProviderInitialization(omitUndefinedValues({
      provider: initialized.provider,
      providerReference: initialized.reference,
      providerAccessCode: initialized.accessCode,
      authorizationUrl: initialized.authorizationUrl,
      providerStatus: initialized.providerStatus,
      providerMessage: initialized.providerMessage,
      rawProviderData: initialized.rawProviderData,
    }));

    return omitUndefinedValues({
      paymentTransactionId: prepared._id,
      provider: initialized.provider,
      reference: initialized.reference,
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
      amount: prepared.amount,
      currency: prepared.currency,
      status: initialized.status,
    });
  }

  @Post("verify")
  @UseGuards(FirebaseAuthGuard, RoleGuard)
  @RequireRoles("buyer", "admin")
  async verifyPayment(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: VerifyPaymentBody,
  ): Promise<{ ok: true; reference: string; status: string }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const provider = await this.payments.getProvider();
    const verification = await provider.verify(body.reference);
    await this.convex.reconcileProviderPayment(omitUndefinedValues({
      provider: verification.provider,
      providerReference: verification.reference,
      status: verification.status,
      amount: verification.amount,
      currency: verification.currency,
      providerStatus: verification.providerStatus,
      providerMessage: verification.providerMessage,
      rawProviderData: verification.rawProviderData,
    }));
    return { ok: true, reference: verification.reference, status: verification.status };
  }

  @Post("webhooks/paystack")
  async handlePaystackWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true }> {
    const env = getApiEnvironment();
    assertPaystackWebhookSignature({
      rawBody: JSON.stringify(body),
      signatureHeader: readHeader(headers, "x-paystack-signature"),
      secret: env.payments.webhookSecret ?? env.payments.paystackSecretKey,
    });
    const event = normalizePaystackWebhookEvent(body);
    await this.convex.recordProviderEvent(omitUndefinedValues({
      provider: event.provider,
      providerEventId: event.providerEventId,
      providerReference: event.reference,
      eventType: event.eventType,
      normalizedStatus: event.status,
      amount: event.amount,
      currency: event.currency,
      providerStatus: event.providerStatus,
      providerMessage: event.providerMessage,
      rawPayload: event.rawPayload,
    }));
    return { ok: true };
  }
}

function omitUndefinedValues<T extends Record<string, unknown>>(value: T): {
  [K in keyof T]: Exclude<T[K], undefined>;
} {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

function resolvePaymentEmail(principal: AuthPrincipal, buyerId: string): string {
  if (principal.email !== undefined && principal.email.trim().length > 0) {
    return principal.email.trim().toLowerCase();
  }
  return `buyer-${buyerId.replace(/[^a-zA-Z0-9]/g, "").slice(-24)}@payments.kuapa-dwaso.local`;
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
