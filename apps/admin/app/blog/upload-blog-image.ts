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
  const upload = await fetch(`${apiUrl}/uploads/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type,
      "x-file-name": encodeURIComponent(file.name),
      "x-upload-purpose": purpose,
      "x-related-entity-type": "blog_post",
      "x-related-entity-id": postId,
      "x-upload-access-level": "public_read",
    },
    body: file,
    signal: requestSignal(signal),
  });
  if (!upload.ok) throw new Error(await upload.text());
  const target = (await upload.json()) as {
    uploadAssetId: Id<"uploadAssets">;
  };

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
