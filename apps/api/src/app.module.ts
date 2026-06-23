import { Module } from "@nestjs/common";
import { FoundationModule } from "./modules/foundation/foundation.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ConvexUserProfilesProvider } from "./providers/convex-user-profiles.provider.js";
import { FirebaseAdminTokenVerifier } from "./providers/firebase-auth.provider.js";

@Module({
  imports: [HealthModule, FoundationModule],
  providers: [FirebaseAdminTokenVerifier, ConvexUserProfilesProvider]
})
export class AppModule {}
