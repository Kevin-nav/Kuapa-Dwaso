"use client";

import type { User } from "firebase/auth";

type PresignReadResponse = {
  method: "GET";
  readUrl: string;
  uploadAssetId: string;
  objectKey: string;
  contentType: string;
  expiresAt: number;
};

export async function getEvidenceReadUrl(input: {
  firebaseUser: User | null;
  uploadAssetId: string;
}): Promise<PresignReadResponse> {
  if (input.firebaseUser === null) {
    throw new Error("Sign in is required before opening evidence.");
  }
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is required to open evidence.");
  }
  const token = await input.firebaseUser.getIdToken();
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/uploads/presign-read`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      uploadAssetId: input.uploadAssetId,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Could not open evidence."));
  }
  return (await response.json()) as PresignReadResponse;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}
