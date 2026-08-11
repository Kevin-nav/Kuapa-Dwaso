import { Module } from "@nestjs/common";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ConvexUserProfilesProvider } from "../../providers/convex-user-profiles.provider.js";
import { FirebaseAdminTokenVerifier } from "../../providers/firebase-auth.provider.js";
import { WebPushProvider } from "../../providers/web-push.provider.js";
import { NotificationsController } from "./notifications.controller.js";

@Module({ controllers: [NotificationsController], providers: [ConvexPlatformProvider, ConvexUserProfilesProvider, FirebaseAdminTokenVerifier, FirebaseAuthGuard, WebPushProvider] })
export class NotificationsModule {}
