import { Module } from "@nestjs/common";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { RoleGuard } from "../../guards/role.guard.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ConvexUserProfilesProvider } from "../../providers/convex-user-profiles.provider.js";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { PaymentProviderRegistry } from "../../providers/payment.provider.js";
import { PaymentsController } from "./payments.controller.js";

@Module({
  controllers: [PaymentsController],
  providers: [
    ConvexPlatformProvider,
    ConvexUserProfilesProvider,
    FirebaseAdminTokenVerifier,
    FirebaseAuthGuard,
    PaymentProviderRegistry,
    RoleGuard,
  ],
})
export class PaymentsModule {}
