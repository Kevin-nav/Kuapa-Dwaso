import { describe, expect, it } from "vitest";
import { InviteTemplatesProvider, roleLabelForInviteType } from "./invite-templates.provider.js";

describe("InviteTemplatesProvider", () => {
  it("builds invite links from the public app base URL", () => {
    const originalPublicAppUrl = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = "https://app.example.test/";
    const provider = new InviteTemplatesProvider();

    expect(provider.buildInviteUrl("raw token")).toBe("https://app.example.test/invite/accept?token=raw%20token");

    if (originalPublicAppUrl === undefined) {
      delete process.env.PUBLIC_APP_URL;
    } else {
      process.env.PUBLIC_APP_URL = originalPublicAppUrl;
    }
  });

  it("centralizes admin and warehouse-manager email invite copy", () => {
    const provider = new InviteTemplatesProvider();
    const expiresAt = Date.UTC(2026, 6, 7, 12, 0, 0);

    expect(
      provider.inviteEmail({
        type: "admin_invite",
        inviteUrl: "https://app.example.test/invite/accept?token=admin",
        expiresAt
      })
    ).toMatchObject({
      subject: "Kuapa Dwaso admin invitation",
      text: expect.stringContaining("invited as admin")
    });
    expect(
      provider.inviteEmail({
        type: "warehouse_manager_invite",
        inviteUrl: "https://app.example.test/invite/accept?token=manager",
        expiresAt
      })
    ).toMatchObject({
      subject: "Kuapa Dwaso warehouse manager invitation",
      text: expect.stringContaining("invited as warehouse manager")
    });
  });

  it("centralizes warehouse-agent SMS invite copy", () => {
    const provider = new InviteTemplatesProvider();

    expect(
      provider.warehouseAgentSms({
        type: "warehouse_agent_invite",
        inviteUrl: "https://app.example.test/invite/accept?token=sms",
        expiresAt: Date.UTC(2026, 6, 7, 12, 0, 0)
      })
    ).toContain("warehouse agent invite");
  });

  it("exposes role labels for every invitation type", () => {
    expect(roleLabelForInviteType("admin_invite")).toBe("admin");
    expect(roleLabelForInviteType("warehouse_manager_invite")).toBe("warehouse manager");
    expect(roleLabelForInviteType("warehouse_agent_invite")).toBe("warehouse agent");
    expect(roleLabelForInviteType("transporter_invite")).toBe("transporter");
  });
});
