import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { R2UploadProvider } from "./r2-upload.provider.js";

describe("R2UploadProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects disallowed content types and oversized uploads", () => {
    process.env.UPLOAD_MAX_SIZE_BYTES = "1024";
    const provider = new R2UploadProvider();

    expect(() =>
      provider.assertPresignPolicy({
        purpose: "produce_intake_photo",
        contentType: "application/pdf",
        sizeBytes: 512
      })
    ).toThrow(BadRequestException);
    expect(() =>
      provider.assertPresignPolicy({
        purpose: "produce_intake_photo",
        contentType: "image/png",
        sizeBytes: 2_048
      })
    ).toThrow(BadRequestException);
  });

  it("allows configured image upload purposes within the size limit", () => {
    process.env.UPLOAD_MAX_SIZE_BYTES = "1024";
    const provider = new R2UploadProvider();

    expect(() =>
      provider.assertPresignPolicy({
        purpose: "condition_evidence",
        contentType: "image/webp",
        sizeBytes: 1_024
      })
    ).not.toThrow();
    expect(() =>
      provider.assertPresignPolicy({
        purpose: "dispatch_proof_photo",
        contentType: "image/jpeg",
        sizeBytes: 1_024
      })
    ).not.toThrow();
  });

  it("fails closed when R2 credentials are missing", () => {
    delete process.env.CLOUDFLARE_R2_BUCKET;
    const provider = new R2UploadProvider();

    expect(() => provider.getBucketName()).toThrow(ServiceUnavailableException);
  });

  it("creates S3-compatible presigned PUT URLs without exposing credentials", () => {
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = "account123";
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "access123";
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret123";
    process.env.CLOUDFLARE_R2_BUCKET = "uploads";
    process.env.R2_PRESIGN_TTL_SECONDS = "120";
    const provider = new R2UploadProvider();

    const result = provider.presignPutObject({
      objectKey: "uploads/produce-intake-photo/user-1/asset-1.webp",
      contentType: "image/webp"
    });

    expect(result.bucket).toBe("uploads");
    expect(result.headers).toEqual({ "Content-Type": "image/webp" });
    expect(result.uploadUrl).toContain("https://account123.r2.cloudflarestorage.com/uploads/");
    expect(result.uploadUrl).toContain("X-Amz-Signature=");
    expect(result.uploadUrl).not.toContain("secret123");
  });

  it("creates short-lived S3-compatible presigned GET URLs without public bucket URLs", () => {
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = "account123";
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = "access123";
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "secret123";
    process.env.CLOUDFLARE_R2_BUCKET = "uploads";
    process.env.R2_READ_PRESIGN_TTL_SECONDS = "300";
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL = "https://public.example.com";
    const provider = new R2UploadProvider();

    const result = provider.presignGetObject({
      objectKey: "uploads/condition-evidence/user-1/asset-1.webp"
    });

    expect(result.bucket).toBe("uploads");
    expect(result.readUrl).toContain("https://account123.r2.cloudflarestorage.com/uploads/");
    expect(result.readUrl).toContain("X-Amz-Expires=300");
    expect(result.readUrl).toContain("X-Amz-Signature=");
    expect(result.readUrl).not.toContain("public.example.com");
    expect(result.readUrl).not.toContain("secret123");
  });
});
