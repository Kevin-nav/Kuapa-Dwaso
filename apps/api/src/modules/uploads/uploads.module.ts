import { Module } from "@nestjs/common";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { RoleGuard } from "../../guards/role.guard.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ConvexUserProfilesProvider } from "../../providers/convex-user-profiles.provider.js";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { InMemoryRateLimitProvider } from "../../providers/rate-limit.provider.js";
import { R2UploadProvider } from "../../providers/r2-upload.provider.js";
import { UploadsController } from "./uploads.controller.js";

@Module({
  controllers: [UploadsController],
  providers: [
    ConvexPlatformProvider,
    ConvexUserProfilesProvider,
    FirebaseAdminTokenVerifier,
    FirebaseAuthGuard,
    InMemoryRateLimitProvider,
    R2UploadProvider,
    RoleGuard
  ]
})
export class UploadsModule {}
