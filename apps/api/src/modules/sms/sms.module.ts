import { Module } from "@nestjs/common";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { SmsWebhooksController } from "./sms-webhooks.controller.js";

@Module({
  controllers: [SmsWebhooksController],
  providers: [ConvexPlatformProvider],
})
export class SmsModule {}
