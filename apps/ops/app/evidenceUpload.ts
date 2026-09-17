"use client";

import type { User } from "firebase/auth";
import type {
  UploadAccessLevel,
  UploadAssetPurpose,
  UploadRelatedEntityType,
} from "@kuapa-dwaso/types";

export async function uploadEvidenceFile(input: {
  firebaseUser: User | null;
  file: File;
  purpose: UploadAssetPurpose;
  relatedEntityType?: UploadRelatedEntityType;
  relatedEntityId?: string;
  ownerUserId?: string;
  accessLevel?: UploadAccessLevel;
  pilotProgrammeId?: string;
}): Promise<string> {
  if (input.firebaseUser === null) {
    throw new Error("Sign in is required before uploading evidence.");
  }
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
    throw new Error("NEXT_PUBLIC_API_URL is required to upload evidence.");
  }
  const token = await input.firebaseUser.getIdToken();
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": input.file.type,
    "x-file-name": encodeURIComponent(input.file.name),
    "x-upload-purpose": input.purpose,
    "x-upload-access-level": input.accessLevel ?? "private",
  };
  if (input.relatedEntityType !== undefined)
    headers["x-related-entity-type"] = input.relatedEntityType;
  if (input.relatedEntityId !== undefined)
    headers["x-related-entity-id"] = input.relatedEntityId;
  if (input.ownerUserId !== undefined)
    headers["x-owner-user-id"] = input.ownerUserId;
  if (input.pilotProgrammeId !== undefined)
    headers["x-pilot-programme-id"] = input.pilotProgrammeId;
  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/uploads/file`,
    {
      method: "POST",
      headers,
      body: input.file,
    },
  );
  if (!response.ok)
    throw new Error(
      await readErrorMessage(response, "Could not upload evidence."),
    );
  return ((await response.json()) as { uploadAssetId: string }).uploadAssetId;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}
