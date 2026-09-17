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
  pilotProgrammeId?: string;
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

export async function uploadPrivateEvidence(
  options: PresignUploadOptions,
): Promise<UploadResult> {
  if (apiBaseUrl === undefined) {
    throw new Error("NEXT_PUBLIC_API_URL is required for evidence uploads.");
  }
  const idToken = await options.user.getIdToken();
  const headers: Record<string, string> = {
    authorization: `Bearer ${idToken}`,
    "content-type": options.file.type,
    "x-file-name": encodeURIComponent(options.file.name),
    "x-upload-purpose": options.purpose,
    "x-upload-access-level": "private",
  };
  if (options.ownerProfileType !== undefined)
    headers["x-owner-profile-type"] = options.ownerProfileType;
  if (options.ownerProfileId !== undefined)
    headers["x-owner-profile-id"] = options.ownerProfileId;
  if (options.relatedEntityType !== undefined)
    headers["x-related-entity-type"] = options.relatedEntityType;
  if (options.relatedEntityId !== undefined)
    headers["x-related-entity-id"] = options.relatedEntityId;
  if (options.pilotProgrammeId !== undefined)
    headers["x-pilot-programme-id"] = options.pilotProgrammeId;
  const uploadResponse = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/uploads/file`,
    {
      method: "POST",
      headers,
      body: options.file,
    },
  );
  if (!uploadResponse.ok) {
    throw new Error(await uploadResponse.text());
  }
  return (await uploadResponse.json()) as UploadResult;
}

export async function getSignedReadUrl(
  user: User,
  uploadAssetId: string,
): Promise<string> {
  const result = await apiJson<{ readUrl: string }>(
    user,
    "/uploads/presign-read",
    {
      uploadAssetId,
    },
  );
  return result.readUrl;
}
