import { Body, Controller, HttpException, HttpStatus, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { ProfileType, UploadAccessLevel, UploadAssetPurpose, UploadRelatedEntityType } from "@kuapa-dwaso/types";
import { getApiEnvironment } from "../../config/env.js";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { RequirePermissions, RoleGuard } from "../../guards/role.guard.js";
import { CurrentPrincipal } from "../../lib/current-principal.js";
import type { AuthPrincipal } from "../../lib/auth-principal.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { InMemoryRateLimitProvider } from "../../providers/rate-limit.provider.js";
import { R2UploadProvider } from "../../providers/r2-upload.provider.js";

type PresignBody = {
  purpose: UploadAssetPurpose;
  contentType: string;
  sizeBytes: number;
  fileName?: string;
  ownerUserId?: string;
  ownerProfileType?: ProfileType;
  ownerProfileId?: string;
  relatedEntityType?: UploadRelatedEntityType;
  relatedEntityId?: string;
  accessLevel?: UploadAccessLevel;
};

type CompleteBody = {
  uploadAssetId: string;
  sizeBytes: number;
  checksumSha256?: string;
};

@Controller("uploads")
@UseGuards(FirebaseAuthGuard, RoleGuard)
export class UploadsController {
  constructor(
    private readonly convex: ConvexPlatformProvider,
    private readonly rateLimits: InMemoryRateLimitProvider,
    private readonly r2: R2UploadProvider
  ) {}

  @Post("presign")
  @RequirePermissions("uploads:create")
  async presign(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: PresignBody
  ): Promise<{
    uploadAssetId: string;
    method: "PUT";
    uploadUrl: string;
    objectKey: string;
    headers: Record<string, string>;
    expiresAt: number;
  }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const env = getApiEnvironment();
    const rateLimit = this.rateLimits.check({
      key: `upload-presign:${principal.userId}`,
      limit: env.rateLimit.uploadPresignMax,
      windowMs: env.rateLimit.windowMs
    });
    if (!rateLimit.allowed) {
      throw new HttpException(
        "Too many upload presign attempts. Try again after the rate-limit window resets.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    this.r2.assertPresignPolicy({
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes
    });

    const createUploadArgs: Parameters<ConvexPlatformProvider["createPendingUpload"]>[0] = {
      actorUserId: principal.userId,
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      bucket: this.r2.getBucketName(),
    };
    if (body.ownerUserId !== undefined) {
      createUploadArgs.ownerUserId = body.ownerUserId;
    }
    if (body.ownerProfileType !== undefined) {
      createUploadArgs.ownerProfileType = body.ownerProfileType;
    }
    if (body.ownerProfileId !== undefined) {
      createUploadArgs.ownerProfileId = body.ownerProfileId;
    }
    if (body.accessLevel !== undefined) {
      createUploadArgs.accessLevel = body.accessLevel;
    }
    if (body.fileName !== undefined) {
      createUploadArgs.fileName = body.fileName;
    }
    if (body.relatedEntityType !== undefined) {
      createUploadArgs.relatedEntityType = body.relatedEntityType;
    }
    if (body.relatedEntityId !== undefined) {
      createUploadArgs.relatedEntityId = body.relatedEntityId;
    }
    const publicBaseUrl = this.r2.getPublicBaseUrl();
    if (body.accessLevel === "public_read" && publicBaseUrl !== undefined) {
      createUploadArgs.publicBaseUrl = publicBaseUrl;
    }
    const pending = await this.convex.createPendingUpload(createUploadArgs);
    const presigned = this.r2.presignPutObject({
      objectKey: pending.objectKey,
      contentType: body.contentType
    });

    return {
      uploadAssetId: pending.uploadAssetId,
      method: "PUT",
      uploadUrl: presigned.uploadUrl,
      objectKey: pending.objectKey,
      headers: presigned.headers,
      expiresAt: presigned.expiresAt
    };
  }

  @Post("complete")
  @RequirePermissions("uploads:completeOwn")
  async complete(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: CompleteBody
  ): Promise<{ uploadAssetId: string; status: "uploaded" | "attached" }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const completeArgs: Parameters<ConvexPlatformProvider["completeUpload"]>[0] = {
      actorUserId: principal.userId,
      uploadAssetId: body.uploadAssetId,
      sizeBytes: body.sizeBytes
    };
    if (body.checksumSha256 !== undefined) {
      completeArgs.checksumSha256 = body.checksumSha256;
    }
    return await this.convex.completeUpload(completeArgs);
  }
}
