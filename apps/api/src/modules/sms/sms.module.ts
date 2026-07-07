import { Module } from "@nestjs/common";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { SmsInviteProvider } from "../../providers/sms.provider.js";
import { SmsWebhooksController } from "./sms-webhooks.controller.js";

@Module({
  controllers: [SmsWebhooksController],
  providers: [ConvexPlatformProvider, SmsInviteProvider],
})
export class SmsModule {}
