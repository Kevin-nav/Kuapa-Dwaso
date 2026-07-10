import { Module } from "@nestjs/common";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { BuyerEmailTemplatesProvider } from "../../providers/buyer-email-templates.provider.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ResendEmailProvider } from "../../providers/email.provider.js";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { ConvexUserProfilesProvider } from "../../providers/convex-user-profiles.provider.js";
import { BuyersController } from "./buyers.controller.js";

@Module({
  controllers: [BuyersController],
  providers: [BuyerEmailTemplatesProvider, ConvexPlatformProvider, ConvexUserProfilesProvider, FirebaseAdminTokenVerifier, FirebaseAuthGuard, ResendEmailProvider],
})
export class BuyersModule {}
