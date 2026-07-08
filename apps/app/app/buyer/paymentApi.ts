"use client";

import type { User } from "firebase/auth";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

export type InitializeBuyerOrderPaymentResult = {
  paymentTransactionId: string;
  provider: string;
  reference: string;
  authorizationUrl?: string;
  accessCode?: string;
  amount: number;
  currency: string;
  status: string;
};

export type VerifyBuyerPaymentResult = {
  ok: true;
  reference: string;
  status: string;
};

export async function initializeBuyerOrderPayment(input: {
  firebaseUser: User;
  buyerOrderId: string;
  callbackUrl: string;
}): Promise<InitializeBuyerOrderPaymentResult> {
  const response = await paymentFetch(
    input.firebaseUser,
    `/payments/buyer-orders/${encodeURIComponent(input.buyerOrderId)}/initialize`,
    {
      method: "POST",
      body: JSON.stringify({
        callbackUrl: input.callbackUrl,
        idempotencyKey: `buyer-order:${input.buyerOrderId}`,
      }),
    },
  );
  return (await response.json()) as InitializeBuyerOrderPaymentResult;
}

export async function verifyBuyerPayment(input: {
  firebaseUser: User;
  reference: string;
}): Promise<VerifyBuyerPaymentResult> {
  const response = await paymentFetch(input.firebaseUser, "/payments/verify", {
    method: "POST",
    body: JSON.stringify({ reference: input.reference }),
  });
  return (await response.json()) as VerifyBuyerPaymentResult;
}

async function paymentFetch(
  firebaseUser: User,
  path: string,
  init: RequestInit,
): Promise<Response> {
  if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is required for buyer payments.");
  }

  const token = await firebaseUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw new Error(await readPaymentError(response));
  }
  return response;
}

async function readPaymentError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === "string" && body.message.trim().length > 0) {
      return body.message;
    }
    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join(" ");
    }
    if (typeof body.error === "string" && body.error.trim().length > 0) {
      return body.error;
    }
  } catch {
    // Fall through to the generic message.
  }
  return `Payment request failed with status ${response.status}.`;
}
