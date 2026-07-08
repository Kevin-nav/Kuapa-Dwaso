import { Module } from "@nestjs/common";
import { FoundationModule } from "./modules/foundation/foundation.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { InvitationsModule } from "./modules/invitations/invitations.module.js";
import { PaymentsModule } from "./modules/payments/payments.module.js";
import { SmsModule } from "./modules/sms/sms.module.js";
import { UploadsModule } from "./modules/uploads/uploads.module.js";
import { ConvexUserProfilesProvider } from "./providers/convex-user-profiles.provider.js";
import { FirebaseAdminTokenVerifier } from "./providers/firebase-auth.provider.js";

@Module({
  imports: [HealthModule, FoundationModule, InvitationsModule, PaymentsModule, SmsModule, UploadsModule],
  providers: [FirebaseAdminTokenVerifier, ConvexUserProfilesProvider]
})
export class AppModule {}
