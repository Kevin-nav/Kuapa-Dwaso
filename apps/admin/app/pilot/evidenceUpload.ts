"use client";

import type { User } from "firebase/auth";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}

export async function uploadFinancialEvidence(input: {
  user: User;
  file: File;
  programmeId: string;
  relatedEntityType:
    | "pilotProgrammes"
    | "pilotBuyerRequests"
    | "pilotFinancialEntries";
  relatedEntityId: string;
}) {
  if (!apiBaseUrl)
    throw new Error(
      "NEXT_PUBLIC_API_URL is required for financial evidence uploads.",
    );
  const token = await input.user.getIdToken();
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": input.file.type,
    "x-file-name": encodeURIComponent(input.file.name),
    "x-upload-purpose": "pilot_financial_evidence",
    "x-upload-access-level": "private",
    "x-related-entity-type": input.relatedEntityType,
    "x-related-entity-id": input.relatedEntityId,
    "x-pilot-programme-id": input.programmeId,
  };
  const uploadResponse = await fetch(
    `${apiBaseUrl.replace(/\/$/, "")}/uploads/file`,
    {
      method: "POST",
      headers,
      body: input.file,
    },
  );
  if (!uploadResponse.ok)
    throw new Error(
      await readError(uploadResponse, "Could not upload the evidence."),
    );
  return ((await uploadResponse.json()) as { uploadAssetId: string })
    .uploadAssetId;
}
