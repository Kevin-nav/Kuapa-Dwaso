import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "./email.provider.js";

describe("ResendEmailProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses mock delivery outside production when Resend is not configured", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const provider = new ResendEmailProvider();

    await expect(
      provider.sendInviteEmail({
        to: "admin@example.test",
        subject: "Invite",
        text: "Accept"
      })
    ).resolves.toMatchObject({
      provider: "mock",
      messageId: expect.stringMatching(/^mock-email-/)
    });
  });

  it("fails closed in production when Resend is not configured", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    const provider = new ResendEmailProvider();

    await expect(
      provider.sendInviteEmail({
        to: "admin@example.test",
        subject: "Invite",
        text: "Accept"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("returns the Resend message id on successful delivery", async () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Kuapa Dwaso <invites@example.test>";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email_123" })
      })
    );
    const provider = new ResendEmailProvider();

    await expect(
      provider.sendInviteEmail({
        to: "admin@example.test",
        subject: "Invite",
        text: "Accept",
        html: "<p>Accept</p>"
      })
    ).resolves.toEqual({
      provider: "resend",
      messageId: "email_123"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test"
        })
      })
    );
  });

  it("surfaces Resend failures as service unavailable", async () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Kuapa Dwaso <invites@example.test>";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false
      })
    );
    const provider = new ResendEmailProvider();

    await expect(
      provider.sendInviteEmail({
        to: "admin@example.test",
        subject: "Invite",
        text: "Accept"
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
