"use client";

import type { User } from "firebase/auth";
import type { UploadAssetPurpose, UploadRelatedEntityType } from "@kuapa-dwaso/types";

type PresignResponse = {
  uploadAssetId: string;
  method: "PUT";
  uploadUrl: string;
  objectKey: string;
  headers: Record<string, string>;
  expiresAt: number;
};

export async function uploadEvidenceFile(input: {
  firebaseUser: User | null;
  file: File;
  purpose: UploadAssetPurpose;
  relatedEntityType: UploadRelatedEntityType;
  relatedEntityId: string;
  ownerUserId?: string;
}): Promise<string> {
  if (input.firebaseUser === null) {
    throw new Error("Sign in is required before uploading evidence.");
  }
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is required to upload evidence.");
  }
  const token = await input.firebaseUser.getIdToken();
  const presignResponse = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/uploads/presign`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      purpose: input.purpose,
      contentType: input.file.type,
      sizeBytes: input.file.size,
      fileName: input.file.name,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      ownerUserId: input.ownerUserId,
      accessLevel: "private",
    }),
  });
  if (!presignResponse.ok) {
    throw new Error(await readErrorMessage(presignResponse, "Could not prepare evidence upload."));
  }
  const presigned = (await presignResponse.json()) as PresignResponse;
  const putResponse = await fetch(presigned.uploadUrl, {
    method: presigned.method,
    headers: presigned.headers,
    body: input.file,
  });
  if (!putResponse.ok) {
    throw new Error("Storage upload failed. Please retry from a stable connection.");
  }
  const completeResponse = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/uploads/complete`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      uploadAssetId: presigned.uploadAssetId,
      sizeBytes: input.file.size,
    }),
  });
  if (!completeResponse.ok) {
    throw new Error(await readErrorMessage(completeResponse, "Could not complete evidence upload."));
  }
  return presigned.uploadAssetId;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}
