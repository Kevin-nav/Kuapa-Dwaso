import type {
  AdminRoleKey,
  AdminScopeType,
  InvitationChannel,
  MfaRequirement,
  PlatformInvitationType,
  SmsDeliveryStatus,
  SmsMessageKind,
  SmsProvider,
  SmsTemplateKey,
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

type RecordSmsSendArgs = {
  provider: SmsProvider;
  providerMessageId: string;
  recipient: string;
  status: SmsDeliveryStatus;
  idempotencyKey?: string;
  messageKind?: SmsMessageKind;
  templateKey?: SmsTemplateKey;
  relatedEntityType?: string;
  relatedEntityId?: string;
  notificationId?: string;
  creditsUsed?: number;
  rawCode?: string;
  rawMessage?: string;
  errorClass?: string;
};

type RecordSmsDeliveryReportArgs = {
  provider: SmsProvider;
  providerMessageId: string;
  recipient: string;
  status: SmsDeliveryStatus;
  network?: string;
  providerTimestamp?: number;
  creditsCharged?: number;
  rawPayload?: Record<string, unknown>;
};

type ClaimPendingSmsDeliveriesArgs = {
  limit?: number;
  retryQueuedBefore?: number;
};

type ClaimedSmsNotification = {
  notificationId: string;
  recipient: string;
  title: string;
  message: string;
  messageKind: SmsMessageKind;
  templateKey?: SmsTemplateKey;
  templateData?: Record<string, string | number | boolean | undefined>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  idempotencyKey: string;
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

const recordSmsSend = makeFunctionReference<
  "mutation",
  RecordSmsSendArgs,
  string
>("smsDeliveries:recordSend");

const recordSmsDeliveryReport = makeFunctionReference<
  "mutation",
  RecordSmsDeliveryReportArgs,
  string
>("smsDeliveries:recordDeliveryReport");

const claimPendingSmsDeliveries = makeFunctionReference<
  "mutation",
  ClaimPendingSmsDeliveriesArgs,
  ClaimedSmsNotification[]
>("notifications:claimPendingSmsDeliveries");

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

  async recordSmsSend(args: RecordSmsSendArgs): Promise<string> {
    return await this.getClient().mutation(recordSmsSend, args);
  }

  async recordSmsDeliveryReport(args: RecordSmsDeliveryReportArgs): Promise<string> {
    return await this.getClient().mutation(recordSmsDeliveryReport, args);
  }

  async claimPendingSmsDeliveries(args: ClaimPendingSmsDeliveriesArgs): Promise<ClaimedSmsNotification[]> {
    return await this.getClient().mutation(claimPendingSmsDeliveries, args);
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
