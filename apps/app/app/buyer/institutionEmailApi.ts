"use client";

import type { User } from "firebase/auth";

export async function sendInstitutionWelcomeEmail(user: User, buyerId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is required for institution email delivery.");
  const token = await user.getIdToken();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/buyers/institution-welcome`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ buyerId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Institution welcome email could not be sent.");
  }
}
