import type { Id } from "../../../../convex/_generated/dataModel";

export type BlogImagePurpose = "blog_hero_image" | "blog_content_image";

export type UploadedBlogImage = {
  url: string;
  uploadAssetId: Id<"uploadAssets">;
};

type UploadBlogImageInput = {
  file: File;
  purpose: BlogImagePurpose;
  postId: Id<"blogPosts">;
  token: string;
  signal: AbortSignal;
};

const requestTimeoutMs = 60_000;

function requestSignal(parentSignal: AbortSignal): AbortSignal {
  return AbortSignal.any([parentSignal, AbortSignal.timeout(requestTimeoutMs)]);
}

/** Uploads an authorized story image and returns its public media URL. */
export async function uploadBlogImage({
  file,
  purpose,
  postId,
  token,
  signal,
}: UploadBlogImageInput): Promise<UploadedBlogImage> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const presign = await fetch(`${apiUrl}/uploads/presign`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      purpose,
      contentType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
      relatedEntityType: "blog_post",
      relatedEntityId: postId,
      accessLevel: "public_read",
    }),
    signal: requestSignal(signal),
  });
  if (!presign.ok) throw new Error(await presign.text());
  const target = (await presign.json()) as {
    uploadAssetId: Id<"uploadAssets">;
    uploadUrl: string;
    headers: Record<string, string>;
  };

  const put = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: target.headers,
    body: file,
    signal: requestSignal(signal),
  });
  if (!put.ok) throw new Error("The image could not be uploaded.");

  const complete = await fetch(`${apiUrl}/uploads/complete`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      uploadAssetId: target.uploadAssetId,
      sizeBytes: file.size,
    }),
    signal: requestSignal(signal),
  });
  if (!complete.ok) throw new Error(await complete.text());

  const read = await fetch(`${apiUrl}/uploads/presign-read`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ uploadAssetId: target.uploadAssetId }),
    signal: requestSignal(signal),
  });
  if (!read.ok) throw new Error(await read.text());
  const readable = (await read.json()) as { readUrl: string };
  return { url: readable.readUrl, uploadAssetId: target.uploadAssetId };
}
