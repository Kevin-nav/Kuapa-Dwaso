import { Injectable } from "@nestjs/common";
import type { PlatformInvitationType } from "@kuapa-dwaso/types";
import { getApiEnvironment } from "../config/env.js";

export type InviteTemplateInput = {
  inviteUrl: string;
  type: PlatformInvitationType;
  expiresAt: number;
};

export type InviteEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class InviteTemplatesProvider {
  buildInviteUrl(rawToken: string): string {
    const baseUrl = getApiEnvironment().publicAppUrl ?? "http://localhost:3000";
    return `${baseUrl.replace(/\/$/, "")}/invites/accept?token=${encodeURIComponent(rawToken)}`;
  }

  inviteEmail(input: InviteTemplateInput): InviteEmailTemplate {
    const expiry = new Date(input.expiresAt).toUTCString();
    const roleLabel = roleLabelForInviteType(input.type);
    const subject = `Kuapa Dwaso ${roleLabel} invitation`;
    const safeRoleLabel = escapeHtml(roleLabel);
    const safeInviteUrl = escapeHtml(input.inviteUrl);
    const text = `You have been invited as ${roleLabel}. Accept before ${expiry}: ${input.inviteUrl}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kuapa Dwaso Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f5f7f0;
      color: #0f1f14;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f5f7f0;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid #dde3d5;
      box-shadow: 0 4px 12px rgba(15, 31, 20, 0.04);
      overflow: hidden;
    }
    .header {
      background-color: #0f1f14;
      padding: 24px;
      text-align: center;
      border-bottom: 3px solid #2d8a4e;
    }
    .logo-text {
      color: #ffffff;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0;
      vertical-align: middle;
      display: inline-block;
    }
    .body {
      padding: 40px 32px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f1f14;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #2b3037;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .role-badge {
      display: inline-block;
      background-color: #e7f4ec;
      color: #15803d;
      font-size: 13px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 24px;
      border: 1px solid #bfe3ca;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2d8a4e;
      color: #ffffff !important;
      text-decoration: none !important;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(45, 138, 78, 0.2);
    }
    .btn:hover {
      background-color: #38a85c;
    }
    .expiry {
      font-size: 13px;
      color: #6b7280;
      margin-top: 16px;
      background-color: #f6f7f9;
      padding: 10px 14px;
      border-radius: 6px;
      display: inline-block;
      border: 1px solid #e2e6ea;
    }
    .divider {
      height: 1px;
      background-color: #e2e6ea;
      margin: 32px 0;
    }
    .fallback {
      font-size: 12px;
      color: #8b95a1;
      word-break: break-all;
      line-height: 1.5;
    }
    .fallback a {
      color: #2d8a4e;
      text-decoration: none;
    }
    .footer {
      padding: 24px;
      background-color: #f6f7f9;
      text-align: center;
      font-size: 12px;
      color: #8b95a1;
      border-top: 1px solid #e2e6ea;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36" style="vertical-align: middle; margin-right: 10px; display: inline-block;">
          <circle cx="22" cy="30" r="6" fill="#2d8a4e" opacity="0.5" />
          <circle cx="18" cy="60" r="6" fill="#2d8a4e" opacity="0.65" />
          <circle cx="22" cy="90" r="6" fill="#2d8a4e" opacity="0.8" />
          <circle cx="48" cy="45" r="8" fill="#2d8a4e" opacity="0.85" />
          <circle cx="48" cy="75" r="8" fill="#2d8a4e" opacity="0.9" />
          <circle cx="88" cy="60" r="22" fill="#2d8a4e" />
        </svg>
        <span class="logo-text">KUAPA DWASO</span>
      </div>
      <div class="body">
        <h1>Platform Invitation</h1>
        <p>You have been invited to join the Kuapa Dwaso platform. Your assigned access role is:</p>
        <span class="role-badge">${safeRoleLabel}</span>
        
        <p>Please accept this invitation to set up your account and access your dashboard.</p>
        
        <div class="cta-container">
          <a href="${safeInviteUrl}" class="btn">Accept Invitation</a>
        </div>
        
        <p>This invitation will expire on the date below. Please make sure to accept it before this time.</p>
        
        <div class="expiry">
          <strong>Expiration:</strong> ${expiry}
        </div>
        
        <div class="divider"></div>
        
        <div class="fallback">
          If the button above does not work, copy and paste the link below into your web browser:
          <br><br>
          <a href="${safeInviteUrl}">${safeInviteUrl}</a>
        </div>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} Kuapa Dwaso. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>`;

    return {
      subject,
      text,
      html
    };
  }

  adminInviteEmail(input: InviteTemplateInput): InviteEmailTemplate {
    return this.inviteEmail(input);
  }

}

export function roleLabelForInviteType(type: PlatformInvitationType): string {
  switch (type) {
    case "admin_invite":
      return "admin";
    case "warehouse_manager_invite":
      return "warehouse manager";
    case "warehouse_agent_invite":
      return "warehouse agent";
    case "pilot_operations_invite":
      return "pilot operator";
    case "transporter_invite":
      return "transporter";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
