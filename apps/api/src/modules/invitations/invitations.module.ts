import { Module } from "@nestjs/common";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { RoleGuard } from "../../guards/role.guard.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ResendEmailProvider } from "../../providers/email.provider.js";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { InviteTemplatesProvider } from "../../providers/invite-templates.provider.js";
import { InviteTokenProvider } from "../../providers/invite-token.provider.js";
import { InMemoryRateLimitProvider } from "../../providers/rate-limit.provider.js";
import { ConvexUserProfilesProvider } from "../../providers/convex-user-profiles.provider.js";
import { InvitationsController } from "./invitations.controller.js";

@Module({
  controllers: [InvitationsController],
  providers: [
    ConvexPlatformProvider,
    ConvexUserProfilesProvider,
    FirebaseAdminTokenVerifier,
    FirebaseAuthGuard,
    InMemoryRateLimitProvider,
    InviteTemplatesProvider,
    InviteTokenProvider,
    ResendEmailProvider,
    RoleGuard
  ]
})
export class InvitationsModule {}
