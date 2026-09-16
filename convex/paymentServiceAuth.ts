import { assertAllowed } from "./workflowHelpers";

declare const process: { env: Record<string, string | undefined> };

export function assertPaymentServiceSecret(serviceSecret: string): void {
  const configured = process.env.PAYMENT_PROVIDER_SERVICE_SECRET;
  assertAllowed(
    configured !== undefined &&
      configured.length >= 24 &&
      serviceSecret === configured,
    "Payment provider service authentication failed.",
  );
}
