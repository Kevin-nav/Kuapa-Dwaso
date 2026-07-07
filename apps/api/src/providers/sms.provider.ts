import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getApiEnvironment } from "../config/env.js";

export type SmsInput = {
  to: string;
  message: string;
  kind?: "invite" | "notification" | "otp";
};

export type SmsDeliveryResult = {
  provider: "mock";
  messageId: string;
};

@Injectable()
export class SmsInviteProvider {
  async sendSms(input: SmsInput): Promise<SmsDeliveryResult> {
    const env = getApiEnvironment();
    if (!env.sms.mock) {
      throw new ServiceUnavailableException("A real SMS provider is not configured yet.");
    }

    return {
      provider: "mock",
      messageId: `mock-sms-${Buffer.from(`${input.to}:${input.message}`).toString("base64url").slice(0, 16)}`
    };
  }

  async sendInviteSms(input: Omit<SmsInput, "kind">): Promise<SmsDeliveryResult> {
    return await this.sendSms({ ...input, kind: "invite" });
  }
}
