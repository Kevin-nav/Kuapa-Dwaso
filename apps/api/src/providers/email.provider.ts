import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { getApiEnvironment } from "../config/env.js";

export type InviteEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  provider: "resend" | "mock";
  messageId?: string;
};

@Injectable()
export class ResendEmailProvider {
  async sendInviteEmail(input: InviteEmailInput): Promise<EmailDeliveryResult> {
    const env = getApiEnvironment();
    if (env.email.resendApiKey === undefined || env.email.fromEmail === undefined) {
      if (env.nodeEnv === "production") {
        throw new ServiceUnavailableException("Resend email delivery is not configured.");
      }
      return { provider: "mock", messageId: `mock-email-${Date.now()}` };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.email.fromEmail,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html
      })
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("Resend email delivery failed.");
    }

    const body = (await response.json()) as { id?: string };
    const result: EmailDeliveryResult = { provider: "resend" };
    if (body.id !== undefined) {
      result.messageId = body.id;
    }
    return result;
  }
}
