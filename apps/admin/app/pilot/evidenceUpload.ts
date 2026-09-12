"use client";

import type { User } from "firebase/auth";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: unknown };
    return typeof body.message === "string" ? body.message : fallback;
  } catch { return fallback; }
}

export async function uploadFinancialEvidence(input: {
  user: User;
  file: File;
  programmeId: string;
  relatedEntityType: "pilotProgrammes" | "pilotBuyerRequests" | "pilotFinancialEntries";
  relatedEntityId: string;
}) {
  if (!apiBaseUrl) throw new Error("NEXT_PUBLIC_API_URL is required for financial evidence uploads.");
  const token = await input.user.getIdToken();
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const presignResponse = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/uploads/presign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      purpose: "pilot_financial_evidence",
      contentType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      fileName: input.file.name,
      accessLevel: "private",
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      pilotProgrammeId: input.programmeId,
    }),
  });
  if (!presignResponse.ok) throw new Error(await readError(presignResponse, "Could not prepare the evidence upload."));
  const presigned = await presignResponse.json() as { uploadAssetId: string; uploadUrl: string; method: "PUT"; headers: Record<string, string> };
  const uploadResponse = await fetch(presigned.uploadUrl, { method: presigned.method, headers: presigned.headers, body: input.file });
  if (!uploadResponse.ok) throw new Error("Evidence did not reach storage. Retry before recording payment.");
  const completeResponse = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/uploads/complete`, { method: "POST", headers, body: JSON.stringify({ uploadAssetId: presigned.uploadAssetId, sizeBytes: input.file.size }) });
  if (!completeResponse.ok) throw new Error(await readError(completeResponse, "Could not attach the uploaded evidence."));
  return presigned.uploadAssetId;
}
