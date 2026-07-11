import { uploadAssetPurposes, type UploadAssetPurpose } from "@kuapa-dwaso/types";
import { assertUploadMetadata } from "@kuapa-dwaso/utils";
import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, createHash } from "node:crypto";
import { getApiEnvironment } from "../config/env.js";

export type PresignPutObjectInput = {
  objectKey: string;
  contentType: string;
  bucket?: string;
};

export type UploadPolicyInput = {
  purpose: UploadAssetPurpose;
  contentType: string;
  sizeBytes: number;
};

export type PresignPutObjectResult = {
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: number;
  bucket: string;
};

@Injectable()
export class R2UploadProvider {
  async uploadObject(input: PresignPutObjectInput & { body: Buffer }): Promise<void> {
    const target = this.presignPutObject(input);
    const response = await fetch(target.uploadUrl, {
      method: "PUT",
      headers: target.headers,
      body: new Uint8Array(input.body),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException("Cloudflare R2 could not store the produce photo.");
    }
  }

  getPublicReadUrl(objectKey: string): string {
    const baseUrl = getApiEnvironment().uploads.r2PublicBaseUrl;
    if (baseUrl === undefined) {
      throw new ServiceUnavailableException("Cloudflare R2 public reads are not configured.");
    }
    return `${baseUrl}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  }

  getBucketName(accessLevel: "private" | "public_read" = "private"): string {
    const uploads = getApiEnvironment().uploads;
    const bucket = accessLevel === "public_read" ? uploads.r2PublicBucket : uploads.r2Bucket;
    if (bucket === undefined) {
      throw new ServiceUnavailableException("Cloudflare R2 uploads are not configured.");
    }
    return bucket;
  }

  presignPutObject(input: PresignPutObjectInput): PresignPutObjectResult {
    const presigned = this.presignObject({
      method: "PUT",
      objectKey: input.objectKey,
      ttlSeconds: getApiEnvironment().uploads.presignTtlSeconds,
      ...(input.bucket === undefined ? {} : { bucket: input.bucket })
    });

    return {
      uploadUrl: presigned.url,
      headers: {
        "Content-Type": input.contentType
      },
      expiresAt: presigned.expiresAt,
      bucket: presigned.bucket
    };
  }

  presignGetObject(input: { objectKey: string }): { readUrl: string; expiresAt: number; bucket: string } {
    const presigned = this.presignObject({
      method: "GET",
      objectKey: input.objectKey,
      ttlSeconds: getApiEnvironment().uploads.readPresignTtlSeconds
    });

    return {
      readUrl: presigned.url,
      expiresAt: presigned.expiresAt,
      bucket: presigned.bucket
    };
  }

  assertPresignPolicy(input: UploadPolicyInput): void {
    const env = getApiEnvironment();
    if (!uploadAssetPurposes.includes(input.purpose)) {
      throw new BadRequestException("Upload purpose is not allowed.");
    }

    try {
      assertUploadMetadata({
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        maxSizeBytes: env.uploads.maxSizeBytes
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Upload metadata is invalid.");
    }
  }

  private presignObject(input: {
    method: "GET" | "PUT";
    objectKey: string;
    ttlSeconds: number;
    bucket?: string;
  }): { url: string; expiresAt: number; bucket: string } {
    const env = getApiEnvironment();
    const accountId = env.uploads.r2AccountId;
    const accessKeyId = env.uploads.r2AccessKeyId;
    const secretAccessKey = env.uploads.r2SecretAccessKey;
    const bucket = input.bucket ?? env.uploads.r2Bucket;
    if (
      accountId === undefined ||
      accessKeyId === undefined ||
      secretAccessKey === undefined ||
      bucket === undefined
    ) {
      throw new ServiceUnavailableException("Cloudflare R2 uploads are not configured.");
    }

    const region = "auto";
    const service = "s3";
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const expires = Math.max(60, Math.min(input.ttlSeconds, 3600));
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const encodedKey = input.objectKey.split("/").map(encodeURIComponent).join("/");
    const canonicalUri = `/${bucket}/${encodedKey}`;
    const signedHeaders = "host";
    const queryParams = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": signedHeaders
    });
    const canonicalQueryString = [...queryParams.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    const canonicalRequest = [
      input.method,
      canonicalUri,
      canonicalQueryString,
      `host:${host}\n`,
      signedHeaders,
      "UNSIGNED-PAYLOAD"
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join("\n");
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = hmacHex(signingKey, stringToSign);
    queryParams.set("X-Amz-Signature", signature);

    return {
      url: `https://${host}${canonicalUri}?${queryParams.toString()}`,
      expiresAt: now.getTime() + expires * 1000,
      bucket
    };
  }
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}
