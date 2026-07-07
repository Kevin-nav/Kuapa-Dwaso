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
    return `${baseUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(rawToken)}`;
  }

  inviteEmail(input: InviteTemplateInput): InviteEmailTemplate {
    const expiry = new Date(input.expiresAt).toISOString();
    const roleLabel = roleLabelForInviteType(input.type);
    const subject = `Kuapa Dwaso ${roleLabel} invitation`;
    const safeRoleLabel = escapeHtml(roleLabel);
    const safeInviteUrl = escapeHtml(input.inviteUrl);
    const text = `You have been invited as ${roleLabel}. Accept before ${expiry}: ${input.inviteUrl}`;
    return {
      subject,
      text,
      html: `<p>You have been invited as <strong>${safeRoleLabel}</strong>.</p><p>Accept before ${expiry}: <a href="${safeInviteUrl}">Accept invitation</a></p>`
    };
  }

  adminInviteEmail(input: InviteTemplateInput): InviteEmailTemplate {
    return this.inviteEmail(input);
  }

  warehouseAgentSms(input: InviteTemplateInput): string {
    const expiry = new Date(input.expiresAt).toISOString();
    const roleLabel = roleLabelForInviteType(input.type);
    return `Kuapa Dwaso ${roleLabel} invite. Accept before ${expiry}: ${input.inviteUrl}`;
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
