import { Body, Controller, Headers, HttpException, HttpStatus, Post, Get, Param, UseGuards, UnauthorizedException, BadRequestException, NotFoundException } from "@nestjs/common";
import type { AdminRoleKey, AdminScopeType, InvitationChannel, MfaRequirement, PlatformInvitationType } from "@kuapa-dwaso/types";
import { assertInvitationDeliveryAllowed } from "@kuapa-dwaso/utils";
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

type CreateInviteBody = {
  type: PlatformInvitationType;
  channel: InvitationChannel;
  targetEmail?: string;
  targetPhoneNumber?: string;
  linkedProfileId?: string;
  pilotProgrammeId?: string;
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
    private readonly templates: InviteTemplatesProvider,
    private readonly tokens: InviteTokenProvider
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard, RoleGuard)
  @RequirePermissions("users:updateStatus")
  async createInvite(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: CreateInviteBody
  ): Promise<{ invitationId: string; deliveryProvider: string; messageId?: string; manualInviteUrl?: string }> {
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

    try {
      assertInvitationDeliveryAllowed(body.type, body.channel);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid invitation delivery mode.");
    }
    const phonePrimary = body.type === "warehouse_agent_invite" || body.type === "pilot_operations_invite" || body.type === "transporter_invite";
    if (phonePrimary && (body.targetPhoneNumber === undefined || body.targetPhoneNumber.trim().length === 0)) {
      throw new BadRequestException("Warehouse-agent and transporter invitations require the phone number that will be verified at acceptance.");
    }
    if (body.channel === "manual_link" && (body.targetPhoneNumber === undefined || body.targetPhoneNumber.trim().length === 0)) {
      throw new BadRequestException("Manual-link invitations require a target phone number.");
    }
    if (body.type === "warehouse_manager_invite" && (
      body.pendingAdminRoleAssignment?.roleKey !== "warehouse_manager" ||
      body.pendingAdminRoleAssignment.scopeType !== "warehouse" ||
      body.pendingAdminRoleAssignment.scopeId === undefined
    )) {
      throw new BadRequestException("Warehouse-manager invitations require a warehouse-scoped warehouse_manager assignment.");
    }
    if (body.type === "admin_invite" && body.pendingAdminRoleAssignment === undefined) {
      throw new BadRequestException("Admin invitations require an initial role assignment.");
    }
    if (body.type === "admin_invite" && body.pendingAdminRoleAssignment?.roleKey === "warehouse_manager") {
      throw new BadRequestException("Use a warehouse-manager invitation for that role.");
    }
    if ((body.type === "admin_invite" || body.type === "warehouse_manager_invite") && body.mfaRequirement !== undefined && body.mfaRequirement !== "totp_required" && body.mfaRequirement !== "required") {
      throw new BadRequestException("Privileged invitations require MFA.");
    }
    if (body.type === "pilot_operations_invite" &&
      (body.pilotProgrammeId === undefined || body.pilotProgrammeId.trim().length === 0 ||
        body.linkedProfileId === undefined || body.linkedProfileId.trim().length === 0)) {
      throw new BadRequestException("Pilot operations invitations require a programme and an approved operations profile.");
    }

    const token = this.tokens.createToken();
    const expiresAt = body.expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
    const inviteUrl = this.templates.buildInviteUrl(token.rawToken);
    let delivery: { provider: string; messageId?: string };

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
      delivery = { provider: "manual_secure_link" };
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
    if (body.pilotProgrammeId !== undefined) {
      createInvitationArgs.pilotProgrammeId = body.pilotProgrammeId;
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

    const invitationId = await this.convex.createInvitation(createInvitationArgs, principal.firebaseIdToken);
    const response: { invitationId: string; deliveryProvider: string; messageId?: string; manualInviteUrl?: string } = {
      invitationId,
      deliveryProvider: delivery.provider
    };
    if (delivery.messageId !== undefined) {
      response.messageId = delivery.messageId;
    }
    if (body.channel === "manual_link") {
      response.manualInviteUrl = inviteUrl;
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
    }, bearerToken);
  }

  @Get("pending/:token")
  async getPendingInvite(@Param("token") token: string) {
    if (token.trim().length === 0) {
      throw new BadRequestException("Token is required.");
    }
    const tokenHash = this.tokens.hashToken(token.trim());
    const invite = await this.convex.getPendingInvitationByTokenHash(tokenHash);
    if (invite === null) {
      throw new NotFoundException("Invitation not found.");
    }
    return invite;
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
