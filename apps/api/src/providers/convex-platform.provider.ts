import type {
  AdminRoleKey,
  AdminScopeType,
  InvitationChannel,
  MfaRequirement,
  PlatformInvitationType,
  UploadAccessLevel,
  UploadAssetPurpose,
  UploadRelatedEntityType,
} from "@kuapa-dwaso/types";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getApiEnvironment } from "../config/env.js";

type CreateInvitationArgs = {
  actorUserId: string;
  type: PlatformInvitationType;
  channel: InvitationChannel;
  tokenHash: string;
  targetEmail?: string;
  targetPhoneNumber?: string;
  linkedProfileId?: string;
  pendingAdminRoleAssignment?: {
    roleKey: AdminRoleKey;
    scopeType: AdminScopeType;
    scopeId?: string;
    scopeValue?: string;
    expiresAt?: number;
  };
  expiresAt: number;
  mfaRequirement?: MfaRequirement;
  messageId?: string;
};

type AcceptInvitationArgs = {
  tokenHash: string;
  identity: {
    authProviderId: string;
    phoneNumber?: string;
    email?: string;
    displayName?: string;
    phoneVerified?: boolean;
    emailVerified?: boolean;
    signInProvider?: string;
    mfaSatisfied?: boolean;
    mfaMethods?: string[];
  };
};

type AcceptInvitationResult = {
  invitationId: string;
  userId: string;
  profileType: string;
  profileId?: string;
  status: "accepted";
  mfaRequired: boolean;
};

type CreatePendingUploadArgs = {
  actorUserId: string;
  ownerUserId?: string;
  ownerProfileType?: string;
  ownerProfileId?: string;
  purpose: UploadAssetPurpose;
  contentType: string;
  sizeBytes: number;
  accessLevel?: UploadAccessLevel;
  bucket: string;
  objectKey?: string;
  fileName?: string;
  relatedEntityType?: UploadRelatedEntityType;
  relatedEntityId?: string;
};

type CompleteUploadArgs = {
  actorUserId: string;
  uploadAssetId: string;
  sizeBytes: number;
  checksumSha256?: string;
};

const createInvitation = makeFunctionReference<
  "mutation",
  CreateInvitationArgs,
  string
>("invitations:create");

const acceptInvitation = makeFunctionReference<
  "mutation",
  AcceptInvitationArgs,
  AcceptInvitationResult
>("invitations:accept");

const createPendingUpload = makeFunctionReference<
  "mutation",
  CreatePendingUploadArgs,
  { uploadAssetId: string; objectKey: string }
>("uploads:createPending");

const completeUpload = makeFunctionReference<
  "mutation",
  CompleteUploadArgs,
  string
>("uploads:complete");

@Injectable()
export class ConvexPlatformProvider {
  private client: ConvexHttpClient | undefined;

  async createInvitation(args: CreateInvitationArgs): Promise<string> {
    return await this.getClient().mutation(createInvitation, args);
  }

  async acceptInvitation(args: AcceptInvitationArgs): Promise<AcceptInvitationResult> {
    return await this.getClient().mutation(acceptInvitation, args);
  }

  async createPendingUpload(args: CreatePendingUploadArgs): Promise<{
    uploadAssetId: string;
    objectKey: string;
  }> {
    return await this.getClient().mutation(createPendingUpload, args);
  }

  async completeUpload(args: CompleteUploadArgs): Promise<string> {
    return await this.getClient().mutation(completeUpload, args);
  }

  private getClient(): ConvexHttpClient {
    if (this.client !== undefined) {
      return this.client;
    }
    const env = getApiEnvironment();
    if (env.auth.convexUrl === undefined) {
      throw new ServiceUnavailableException("Convex URL is not configured.");
    }
    this.client = new ConvexHttpClient(env.auth.convexUrl);
    return this.client;
  }
}
