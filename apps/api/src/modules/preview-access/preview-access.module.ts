import { Module } from "@nestjs/common";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { InMemoryRateLimitProvider } from "../../providers/rate-limit.provider.js";
import { ConvexUserProfilesProvider } from "../../providers/convex-user-profiles.provider.js";
import { CreatePreviewSessionWorkflow } from "../../workflows/create-preview-session.workflow.js";
import { PreviewAccessController } from "./preview-access.controller.js";

@Module({
  controllers: [PreviewAccessController],
  providers: [
    CreatePreviewSessionWorkflow,
    FirebaseAdminTokenVerifier,
    InMemoryRateLimitProvider,
    ConvexUserProfilesProvider,
  ],
})
export class PreviewAccessModule {}
