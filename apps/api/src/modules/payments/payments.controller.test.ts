import { describe, expect, it, vi } from "vitest";
import type { AuthPrincipal } from "../../lib/auth-principal.js";
import { PaymentsController } from "./payments.controller.js";

const principal: AuthPrincipal = {
  authProviderId: "firebase-buyer",
  firebaseIdToken: "firebase-token",
  userId: "users:buyer",
  roles: ["buyer"],
  status: "active",
  email: "buyer@example.test",
};

function createController() {
  const provider = {
    provider: "mock" as const,
    initialize: vi.fn(async (input: { reference: string }) => ({
      provider: "mock" as const,
      reference: input.reference,
      authorizationUrl: `https://mock-payments.local/${input.reference}`,
      accessCode: "mock-access",
      status: "pending" as const,
      providerStatus: "pending",
      providerMessage: "Mock payment initialized.",
    })),
    verify: vi.fn(async (reference: string) => ({
      provider: "mock" as const,
      reference,
      amount: 26_500,
      currency: "GHS",
      status: "successful" as const,
      providerStatus: "success",
      providerMessage: "Mock payment verified.",
    })),
  };
  const convex = {
    preparePilotBuyerPayment: vi.fn(async () => ({
      _id: "pilotPaymentTransactions:one",
      requestId: "pilotBuyerRequests:one",
      buyerId: "buyers:one",
      purpose: "buyer_produce" as const,
      provider: "mock" as const,
      providerReference: "KD-PILOT-MOCK-ONE",
      amountPesewas: 2_650_000,
      currency: "GHS" as const,
      status: "pending" as const,
    })),
    recordPilotProviderInitialization: vi.fn(async () => "pilotPaymentTransactions:one"),
    reconcilePilotProviderPayment: vi.fn(async () => ({})),
    reconcileProviderPayment: vi.fn(async () => ({})),
  };
  const registry = { getProvider: vi.fn(async () => provider) };
  return {
    controller: new PaymentsController(convex as never, registry as never),
    convex,
    provider,
  };
}

describe("pilot buyer payment routing", () => {
  it("initializes through the authenticated pilot mutation and provider seam", async () => {
    const { controller, convex, provider } = createController();
    const result = await controller.initializePilotPayment(
      principal,
      "pilotBuyerRequests:one",
      {
        purpose: "buyer_produce",
        amountPesewas: 2_650_000,
        idempotencyKey: "demo-payment-one",
      },
      {},
    );

    expect(convex.preparePilotBuyerPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "pilotBuyerRequests:one",
        amountPesewas: 2_650_000,
      }),
      "firebase-token",
    );
    expect(provider.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 26_500, currency: "GHS" }),
    );
    expect(convex.recordPilotProviderInitialization).toHaveBeenCalledOnce();
    expect(result.reference).toBe("KD-PILOT-MOCK-ONE");
  });

  it("routes verification by the immutable pilot reference prefix", async () => {
    const { controller, convex } = createController();

    await controller.verifyPayment(principal, {
      reference: "KD-PILOT-MOCK-ONE",
    });

    expect(convex.reconcilePilotProviderPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPesewas: 2_650_000,
        providerReference: "KD-PILOT-MOCK-ONE",
        status: "successful",
      }),
    );
    expect(convex.reconcileProviderPayment).not.toHaveBeenCalled();
  });
});
