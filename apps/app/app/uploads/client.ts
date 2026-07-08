"use client";

import type {
  ProfileType,
  UploadAssetPurpose,
  UploadRelatedEntityType,
} from "@kuapa-dwaso/types";
import type { User } from "firebase/auth";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

type PresignUploadOptions = {
  user: User;
  file: File;
  purpose: UploadAssetPurpose;
  ownerProfileType?: ProfileType;
  ownerProfileId?: string;
  relatedEntityType?: UploadRelatedEntityType;
  relatedEntityId?: string;
};

type UploadResult = {
  uploadAssetId: string;
  status: "uploaded" | "attached";
};

async function apiJson<TResponse>(
  user: User,
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  if (apiBaseUrl === undefined) {
    throw new Error("NEXT_PUBLIC_API_URL is required for evidence uploads.");
  }
  const idToken = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as TResponse;
}

export async function uploadPrivateEvidence(options: PresignUploadOptions): Promise<UploadResult> {
  const presign = await apiJson<{
    uploadAssetId: string;
    method: "PUT";
    uploadUrl: string;
    headers: Record<string, string>;
  }>(options.user, "/uploads/presign", {
    purpose: options.purpose,
    contentType: options.file.type,
    sizeBytes: options.file.size,
    fileName: options.file.name,
    ownerProfileType: options.ownerProfileType,
    ownerProfileId: options.ownerProfileId,
    relatedEntityType: options.relatedEntityType,
    relatedEntityId: options.relatedEntityId,
    accessLevel: "private",
  });

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: presign.method,
    headers: presign.headers,
    body: options.file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Signed upload failed. Please try again.");
  }

  return await apiJson<UploadResult>(options.user, "/uploads/complete", {
    uploadAssetId: presign.uploadAssetId,
    sizeBytes: options.file.size,
  });
}

export async function getSignedReadUrl(user: User, uploadAssetId: string): Promise<string> {
  const result = await apiJson<{ readUrl: string }>(user, "/uploads/presign-read", {
    uploadAssetId,
  });
  return result.readUrl;
}
