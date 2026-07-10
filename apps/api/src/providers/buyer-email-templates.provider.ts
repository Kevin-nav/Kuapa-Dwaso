import { Injectable } from "@nestjs/common";
import { getApiEnvironment } from "../config/env.js";

type InstitutionWelcomeInput = {
  contactName: string;
  organizationName: string;
  destinationMarket?: string;
};

@Injectable()
export class BuyerEmailTemplatesProvider {
  institutionWelcome(input: InstitutionWelcomeInput): { subject: string; text: string; html: string } {
    const environment = getApiEnvironment();
    const appUrl = (environment.productAppUrl ?? environment.publicAppUrl ?? "http://localhost:3001").replace(/\/$/, "");
    const organization = escapeHtml(input.organizationName);
    const contact = escapeHtml(input.contactName);
    const market = escapeHtml(input.destinationMarket ?? "your selected destination");
    const subject = `Welcome, ${input.organizationName} — institutional sourcing is ready`;
    const text = `Welcome to Kuapa Dwaso, ${input.contactName}. Your institutional account for ${input.organizationName} has been created. Complete enhanced verification to unlock payments and dispatch: ${appUrl}/buyer/verification`;
    return {
      subject,
      text,
      html: `<!doctype html><html><body style="margin:0;background:#f3efe3;font-family:Arial,sans-serif;color:#17351f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe3;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf6;border:1px solid #d8d0b9;border-radius:18px;overflow:hidden"><tr><td style="background:#17351f;padding:28px 34px;color:#fff"><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#d7b85b">Kuapa Dwaso</div><h1 style="margin:10px 0 0;font-family:Georgia,serif;font-size:30px;line-height:1.15">Verified produce.<br>Dependable fulfillment.</h1></td></tr><tr><td style="padding:34px"><p style="margin:0 0 16px;font-size:17px">Hello ${contact},</p><p style="margin:0 0 18px;line-height:1.65">Your institutional buyer account for <strong>${organization}</strong> has been created. You can now explore verified warehouse stock serving ${market}.</p><div style="background:#f3efe3;border-left:4px solid #d7b85b;padding:16px 18px;margin:24px 0"><strong>One final trust step</strong><br><span style="font-size:14px;line-height:1.5">Upload your registration evidence and submit enhanced verification before payments and dispatch are enabled.</span></div><a href="${appUrl}/buyer/verification" style="display:inline-block;background:#2d6a3e;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">Complete verification</a><p style="margin:28px 0 0;color:#647067;font-size:13px;line-height:1.55">This account connects your organization to traceable produce held at Kuapa Dwaso aggregation warehouses.</p></td></tr></table></td></tr></table></body></html>`,
    };
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
