import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type {
  ProfileType,
  UploadAccessLevel,
  UploadAssetPurpose,
  UploadRelatedEntityType,
} from "@kuapa-dwaso/types";
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
  pilotProgrammeId?: string;
  accessLevel?: UploadAccessLevel | "public_read";
};

type CompleteBody = {
  uploadAssetId: string;
  sizeBytes: number;
  checksumSha256?: string;
};

type ReadBody = {
  uploadAssetId: string;
};

@Controller("uploads")
@UseGuards(FirebaseAuthGuard, RoleGuard)
export class UploadsController {
  constructor(
    private readonly convex: ConvexPlatformProvider,
    private readonly rateLimits: InMemoryRateLimitProvider,
    private readonly r2: R2UploadProvider,
  ) {}

  @Post("produce-photo")
  @RequirePermissions("uploads:create")
  async uploadProducePhoto(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("content-type") contentType: string | undefined,
    @Headers("x-file-name") fileName: string | undefined,
    @Body() body: Buffer,
  ): Promise<{ uploadAssetId: string; status: "uploaded" | "attached" }> {
    if (principal.userId === undefined)
      throw new UnauthorizedException("Convex user profile is required.");
    if (!Buffer.isBuffer(body))
      throw new BadRequestException("A produce image file is required.");
    const normalizedContentType = contentType?.split(";", 1)[0] ?? "";
    this.r2.assertPresignPolicy({
      purpose: "produce_intake_photo",
      contentType: normalizedContentType,
      sizeBytes: body.byteLength,
    });
    const bucket = this.r2.getBucketName("public_read");
    const pending = await this.convex.createPendingUpload(
      {
        actorUserId: principal.userId,
        purpose: "produce_intake_photo",
        contentType: normalizedContentType,
        sizeBytes: body.byteLength,
        accessLevel: "public_read",
        bucket,
        ...(fileName === undefined ? {} : { fileName }),
      },
      principal.firebaseIdToken,
    );
    try {
      await this.r2.uploadObject({
        objectKey: pending.objectKey,
        contentType: normalizedContentType,
        bucket,
        body,
      });
    } catch (error) {
      await this.convex.discardUpload(
        {
          actorUserId: principal.userId,
          uploadAssetId: pending.uploadAssetId,
          reason: "R2 object write failed before upload completion.",
        },
        principal.firebaseIdToken,
      );
      throw error;
    }
    return await this.convex.completeUpload(
      {
        actorUserId: principal.userId,
        uploadAssetId: pending.uploadAssetId,
        sizeBytes: body.byteLength,
      },
      principal.firebaseIdToken,
    );
  }

  @Post("file")
  @RequirePermissions("uploads:create")
  async uploadFile(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Headers("content-type") contentType: string | undefined,
    @Headers("x-file-name") encodedFileName: string | undefined,
    @Headers("x-upload-purpose") purpose: UploadAssetPurpose | undefined,
    @Headers("x-owner-user-id") ownerUserId: string | undefined,
    @Headers("x-owner-profile-type") ownerProfileType: ProfileType | undefined,
    @Headers("x-owner-profile-id") ownerProfileId: string | undefined,
    @Headers("x-related-entity-type")
    relatedEntityType: UploadRelatedEntityType | undefined,
    @Headers("x-related-entity-id") relatedEntityId: string | undefined,
    @Headers("x-pilot-programme-id") pilotProgrammeId: string | undefined,
    @Headers("x-upload-access-level")
    requestedAccessLevel: UploadAccessLevel | "public_read" | undefined,
    @Body() body: Buffer,
  ): Promise<{ uploadAssetId: string; status: "uploaded" | "attached" }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    if (!Buffer.isBuffer(body) || purpose === undefined) {
      throw new BadRequestException("An upload purpose and file are required.");
    }
    const env = getApiEnvironment();
    const rateLimit = this.rateLimits.check({
      key: `upload-file:${principal.userId}`,
      limit: env.rateLimit.uploadPresignMax,
      windowMs: env.rateLimit.windowMs,
    });
    if (!rateLimit.allowed) {
      throw new HttpException(
        "Too many upload attempts. Try again after the rate-limit window resets.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const normalizedContentType = contentType?.split(";", 1)[0] ?? "";
    this.r2.assertPresignPolicy({
      purpose,
      contentType: normalizedContentType,
      sizeBytes: body.byteLength,
    });
    const publicPurposes: UploadAssetPurpose[] = [
      "produce_intake_photo",
      "blog_hero_image",
      "blog_content_image",
    ];
    const accessLevel: UploadAccessLevel =
      requestedAccessLevel === "public_read" ? "public_read" : "private";
    if (accessLevel === "public_read" && !publicPurposes.includes(purpose)) {
      throw new BadRequestException(
        "Only approved public media purposes may use public read access.",
      );
    }
    const isBlogMedia =
      purpose === "blog_hero_image" || purpose === "blog_content_image";
    if (
      isBlogMedia &&
      (accessLevel !== "public_read" ||
        relatedEntityType !== "blog_post" ||
        !relatedEntityId?.trim())
    ) {
      throw new BadRequestException(
        "Public story media must be linked to an existing story.",
      );
    }
    const isPilotEvidence =
      purpose.startsWith("pilot_") ||
      relatedEntityType?.startsWith("pilot") === true;
    const isStagedInspectionEvidence = purpose === "pilot_inspection_evidence";
    if (isPilotEvidence && !pilotProgrammeId?.trim()) {
      throw new BadRequestException("Pilot evidence requires a programme.");
    }
    if (
      isPilotEvidence &&
      !isStagedInspectionEvidence &&
      (relatedEntityType === undefined || !relatedEntityId?.trim())
    ) {
      throw new BadRequestException(
        "Pilot evidence requires a related pilot entity.",
      );
    }
    if (isPilotEvidence && accessLevel === "public_read") {
      throw new BadRequestException("Pilot evidence must remain private.");
    }

    const bucket = this.r2.getBucketName(accessLevel);
    const createUploadArgs: Parameters<
      ConvexPlatformProvider["createPendingUpload"]
    >[0] = {
      actorUserId: principal.userId,
      purpose,
      contentType: normalizedContentType,
      sizeBytes: body.byteLength,
      accessLevel,
      bucket,
      ...(ownerUserId === undefined ? {} : { ownerUserId }),
      ...(ownerProfileType === undefined ? {} : { ownerProfileType }),
      ...(ownerProfileId === undefined ? {} : { ownerProfileId }),
      ...(relatedEntityType === undefined ? {} : { relatedEntityType }),
      ...(relatedEntityId === undefined ? {} : { relatedEntityId }),
      ...(pilotProgrammeId === undefined ? {} : { pilotProgrammeId }),
      ...(encodedFileName === undefined
        ? {}
        : { fileName: decodeUploadFileName(encodedFileName) }),
    };
    const pending = await this.convex.createPendingUpload(
      createUploadArgs,
      principal.firebaseIdToken,
    );
    try {
      await this.r2.uploadObject({
        objectKey: pending.objectKey,
        contentType: normalizedContentType,
        bucket,
        body,
      });
    } catch (error) {
      await this.convex.discardUpload(
        {
          actorUserId: principal.userId,
          uploadAssetId: pending.uploadAssetId,
          reason: "R2 object write failed before upload completion.",
        },
        principal.firebaseIdToken,
      );
      throw error;
    }
    return await this.convex.completeUpload(
      {
        actorUserId: principal.userId,
        uploadAssetId: pending.uploadAssetId,
        sizeBytes: body.byteLength,
      },
      principal.firebaseIdToken,
    );
  }

  @Post("presign")
  @RequirePermissions("uploads:create")
  async presign(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: PresignBody,
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
      windowMs: env.rateLimit.windowMs,
    });
    if (!rateLimit.allowed) {
      throw new HttpException(
        "Too many upload presign attempts. Try again after the rate-limit window resets.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.r2.assertPresignPolicy({
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
    });

    const publicPurposes: UploadAssetPurpose[] = [
      "produce_intake_photo",
      "blog_hero_image",
      "blog_content_image",
    ];
    const isBlogMedia =
      body.purpose === "blog_hero_image" ||
      body.purpose === "blog_content_image";
    if (
      isBlogMedia &&
      (body.accessLevel !== "public_read" ||
        body.relatedEntityType !== "blog_post" ||
        !body.relatedEntityId?.trim())
    ) {
      throw new BadRequestException(
        "Public story media must be linked to an existing story.",
      );
    }
    if (
      body.accessLevel === "public_read" &&
      !publicPurposes.includes(body.purpose)
    ) {
      throw new BadRequestException(
        "Only approved public media purposes may use public read access.",
      );
    }
    const isPilotEvidence =
      body.purpose.startsWith("pilot_") ||
      body.relatedEntityType?.startsWith("pilot") === true;
    if (
      isPilotEvidence &&
      (body.pilotProgrammeId === undefined ||
        body.pilotProgrammeId.trim().length === 0)
    ) {
      throw new BadRequestException("Pilot evidence requires a programme.");
    }
    if (
      isPilotEvidence &&
      (body.relatedEntityType === undefined ||
        body.relatedEntityId === undefined ||
        body.relatedEntityId.trim().length === 0)
    ) {
      throw new BadRequestException(
        "Pilot evidence requires a related pilot entity.",
      );
    }
    if (isPilotEvidence && body.accessLevel === "public_read") {
      throw new BadRequestException("Pilot evidence must remain private.");
    }

    const createUploadArgs: Parameters<
      ConvexPlatformProvider["createPendingUpload"]
    >[0] = {
      actorUserId: principal.userId,
      purpose: body.purpose,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      bucket: this.r2.getBucketName(body.accessLevel ?? "private"),
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
    if (body.pilotProgrammeId !== undefined) {
      createUploadArgs.pilotProgrammeId = body.pilotProgrammeId;
    }
    const pending = await this.convex.createPendingUpload(
      createUploadArgs,
      principal.firebaseIdToken,
    );
    const presigned = this.r2.presignPutObject({
      objectKey: pending.objectKey,
      contentType: body.contentType,
      bucket: this.r2.getBucketName(body.accessLevel ?? "private"),
    });

    return {
      uploadAssetId: pending.uploadAssetId,
      method: "PUT",
      uploadUrl: presigned.uploadUrl,
      objectKey: pending.objectKey,
      headers: presigned.headers,
      expiresAt: presigned.expiresAt,
    };
  }

  @Post("complete")
  @RequirePermissions("uploads:completeOwn")
  async complete(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: CompleteBody,
  ): Promise<{ uploadAssetId: string; status: "uploaded" | "attached" }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const completeArgs: Parameters<
      ConvexPlatformProvider["completeUpload"]
    >[0] = {
      actorUserId: principal.userId,
      uploadAssetId: body.uploadAssetId,
      sizeBytes: body.sizeBytes,
    };
    if (body.checksumSha256 !== undefined) {
      completeArgs.checksumSha256 = body.checksumSha256;
    }
    return await this.convex.completeUpload(
      completeArgs,
      principal.firebaseIdToken,
    );
  }

  @Post("presign-read")
  async presignRead(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: ReadBody,
  ): Promise<{
    method: "GET";
    readUrl: string;
    uploadAssetId: string;
    objectKey: string;
    contentType: string;
    expiresAt: number;
  }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const asset = await this.convex.getReadableUploadObject(
      {
        actorUserId: principal.userId,
        uploadAssetId: body.uploadAssetId,
      },
      principal.firebaseIdToken,
    );
    if (asset === null) {
      throw new NotFoundException("Upload asset was not found.");
    }
    const publicReadUrl =
      asset.accessLevel === "public_read"
        ? this.r2.getPublicReadUrl(asset.objectKey)
        : undefined;
    const presigned =
      publicReadUrl === undefined
        ? this.r2.presignGetObject({ objectKey: asset.objectKey })
        : undefined;

    return {
      method: "GET",
      readUrl: publicReadUrl ?? presigned!.readUrl,
      uploadAssetId: asset.uploadAssetId,
      objectKey: asset.objectKey,
      contentType: asset.contentType,
      expiresAt: presigned?.expiresAt ?? 0,
    };
  }
}

function decodeUploadFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
