import { Body, Controller, Headers, HttpException, HttpStatus, Post, UseGuards, UnauthorizedException } from "@nestjs/common";
import type { AdminRoleKey, AdminScopeType, InvitationChannel, MfaRequirement, PlatformInvitationType } from "@kuapa-dwaso/types";
import { getApiEnvironment } from "../../config/env.js";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { RequirePermissions, RoleGuard } from "../../guards/role.guard.js";
import { CurrentPrincipal } from "../../lib/current-principal.js";
import type { AuthPrincipal } from "../../lib/auth-principal.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ResendEmailProvider } from "../../providers/email.provider.js";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { InviteTemplatesProvider } from "../../providers/invite-templates.provider.js";
import { InviteTokenProvider } from "../../providers/invite-token.provider.js";
import { InMemoryRateLimitProvider } from "../../providers/rate-limit.provider.js";
import { SmsInviteProvider } from "../../providers/sms.provider.js";

type CreateInviteBody = {
  type: PlatformInvitationType;
  channel: InvitationChannel;
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
  expiresAt?: number;
  mfaRequirement?: MfaRequirement;
};

type AcceptInviteBody = {
  token: string;
  displayName?: string;
};

@Controller("invitations")
export class InvitationsController {
  constructor(
    private readonly convex: ConvexPlatformProvider,
    private readonly email: ResendEmailProvider,
    private readonly firebase: FirebaseAdminTokenVerifier,
    private readonly rateLimits: InMemoryRateLimitProvider,
    private readonly sms: SmsInviteProvider,
    private readonly templates: InviteTemplatesProvider,
    private readonly tokens: InviteTokenProvider
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard, RoleGuard)
  @RequirePermissions("users:updateStatus")
  async createInvite(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: CreateInviteBody
  ): Promise<{ invitationId: string; deliveryProvider: string; messageId?: string }> {
    if (principal.userId === undefined) {
      throw new UnauthorizedException("Convex user profile is required.");
    }
    const env = getApiEnvironment();
    const rateLimit = this.rateLimits.check({
      key: `invite-send:${principal.userId}`,
      limit: env.rateLimit.inviteSendMax,
      windowMs: env.rateLimit.windowMs
    });
    if (!rateLimit.allowed) {
      throw new HttpException(
        "Too many invitation send attempts. Try again after the rate-limit window resets.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const token = this.tokens.createToken();
    const expiresAt = body.expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
    const inviteUrl = this.templates.buildInviteUrl(token.rawToken);
    let delivery: { provider: string; messageId?: string };
    let smsDelivery: Awaited<ReturnType<SmsInviteProvider["sendInviteSms"]>> | undefined;

    if (body.channel === "email") {
      const targetEmail = requireValue(body.targetEmail, "targetEmail");
      const template = this.templates.adminInviteEmail({
        inviteUrl,
        type: body.type,
        expiresAt
      });
      delivery = await this.email.sendInviteEmail({
        to: targetEmail,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
    } else {
      const targetPhoneNumber = requireValue(body.targetPhoneNumber, "targetPhoneNumber");
      smsDelivery = await this.sms.sendInviteSms({
        to: targetPhoneNumber,
        message: this.templates.warehouseAgentSms({
          inviteUrl,
          type: body.type,
          expiresAt
        })
      });
      delivery = smsDelivery;
    }

    const createInvitationArgs: Parameters<ConvexPlatformProvider["createInvitation"]>[0] = {
      actorUserId: principal.userId,
      type: body.type,
      channel: body.channel,
      tokenHash: token.tokenHash,
      expiresAt
    };
    if (body.targetEmail !== undefined) {
      createInvitationArgs.targetEmail = body.targetEmail;
    }
    if (body.targetPhoneNumber !== undefined) {
      createInvitationArgs.targetPhoneNumber = body.targetPhoneNumber;
    }
    if (body.linkedProfileId !== undefined) {
      createInvitationArgs.linkedProfileId = body.linkedProfileId;
    }
    if (body.pendingAdminRoleAssignment !== undefined) {
      createInvitationArgs.pendingAdminRoleAssignment = body.pendingAdminRoleAssignment;
    }
    if (body.mfaRequirement !== undefined) {
      createInvitationArgs.mfaRequirement = body.mfaRequirement;
    }
    if (delivery.messageId !== undefined) {
      createInvitationArgs.messageId = delivery.messageId;
    }

    const invitationId = await this.convex.createInvitation(createInvitationArgs);
    if (smsDelivery !== undefined) {
      await Promise.all(
        smsDelivery.recipients.map((recipient) => {
          const recordArgs: Parameters<ConvexPlatformProvider["recordSmsSend"]>[0] = {
            provider: smsDelivery.provider,
            providerMessageId: smsDelivery.providerMessageId,
            recipient,
            status: smsDelivery.status,
            messageKind: "invite",
            relatedEntityType: "platform_invitation",
            relatedEntityId: invitationId
          };
          if (smsDelivery.creditsUsed !== undefined) {
            recordArgs.creditsUsed = smsDelivery.creditsUsed;
          }
          if (smsDelivery.rawCode !== undefined) {
            recordArgs.rawCode = smsDelivery.rawCode;
          }
          if (smsDelivery.rawMessage !== undefined) {
            recordArgs.rawMessage = smsDelivery.rawMessage;
          }
          return this.convex.recordSmsSend(recordArgs);
        })
      );
    }

    const response: { invitationId: string; deliveryProvider: string; messageId?: string } = {
      invitationId,
      deliveryProvider: delivery.provider
    };
    if (delivery.messageId !== undefined) {
      response.messageId = delivery.messageId;
    }
    return response;
  }

  @Post("accept")
  async acceptInvite(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: AcceptInviteBody
  ): Promise<{
    invitationId: string;
    userId: string;
    profileType: string;
    profileId?: string;
    status: "accepted";
    mfaRequired: boolean;
  }> {
    const bearerToken = getBearerToken(authorization);
    if (bearerToken === undefined) {
      throw new UnauthorizedException("Missing Firebase bearer token.");
    }
    const verifiedToken = await this.firebase.verifyIdToken(bearerToken);
    const identity: Parameters<ConvexPlatformProvider["acceptInvitation"]>[0]["identity"] = {
      authProviderId: verifiedToken.authProviderId
    };
    if (verifiedToken.phoneNumber !== undefined) {
      identity.phoneNumber = verifiedToken.phoneNumber;
    }
    if (verifiedToken.email !== undefined) {
      identity.email = verifiedToken.email;
    }
    if (body.displayName !== undefined) {
      identity.displayName = body.displayName;
    }
    if (verifiedToken.phoneVerified !== undefined) {
      identity.phoneVerified = verifiedToken.phoneVerified;
    }
    if (verifiedToken.emailVerified !== undefined) {
      identity.emailVerified = verifiedToken.emailVerified;
    }
    if (verifiedToken.signInProvider !== undefined) {
      identity.signInProvider = verifiedToken.signInProvider;
    }
    if (verifiedToken.mfaSatisfied !== undefined) {
      identity.mfaSatisfied = verifiedToken.mfaSatisfied;
    }
    if (verifiedToken.mfaMethods !== undefined) {
      identity.mfaMethods = verifiedToken.mfaMethods;
    }

    return await this.convex.acceptInvitation({
      tokenHash: this.tokens.hashToken(body.token),
      identity
    });
  }
}

function requireValue(value: string | undefined, label: string): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function getBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token !== undefined && token.length > 0 ? token : undefined;
}
