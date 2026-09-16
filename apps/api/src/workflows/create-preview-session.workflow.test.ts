import { HttpStatus, type HttpException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviewAccessRole } from "../config/env.js";
import type { FirebaseAdminTokenVerifier } from "../providers/firebase-auth.provider.js";
import type { ConvexUserProfilesProvider } from "../providers/convex-user-profiles.provider.js";
import { InMemoryRateLimitProvider } from "../providers/rate-limit.provider.js";
import { CreatePreviewSessionWorkflow } from "./create-preview-session.workflow.js";

describe("CreatePreviewSessionWorkflow", () => {
  const originalEnv = { ...process.env };
  const firebase = {
    createCustomToken: vi.fn<(uid: string) => Promise<string>>(),
  };
  const userProfiles = {
    getByAuthProviderId: vi.fn(),
  };
  let rateLimits: InMemoryRateLimitProvider;
  let workflow: CreatePreviewSessionWorkflow;

  beforeEach(() => {
    const activeCutoff = new Date(Date.now() + 60_000).toISOString();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      PREVIEW_ACCESS_ENABLED: "true",
      PREVIEW_ACCESS_CUTOFF_UTC: activeCutoff,
      PREVIEW_ACCESS_FARMER_FIREBASE_UID: "preview-farmer-uid",
      PREVIEW_ACCESS_BUYER_FIREBASE_UID: "preview-buyer-uid",
      PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID: "preview-transporter-uid",
      PREVIEW_ACCESS_WAREHOUSE_AGENT_FIREBASE_UID: "preview-operations-uid",
      API_RATE_LIMIT_WINDOW_MS: "60000",
      API_RATE_LIMIT_PREVIEW_SESSION_MAX: "30",
    };
    firebase.createCustomToken
      .mockReset()
      .mockResolvedValue("firebase-custom-token");
    userProfiles.getByAuthProviderId.mockReset().mockImplementation((uid) =>
      Promise.resolve({
        userId: `user-for-${uid}`,
        authProviderId: uid,
        role: uid.includes("operations")
          ? "warehouse_agent"
          : uid.split("-")[1],
        status: "active",
      }),
    );
    rateLimits = new InMemoryRateLimitProvider();
    workflow = new CreatePreviewSessionWorkflow(
      firebase as unknown as FirebaseAdminTokenVerifier,
      rateLimits,
      userProfiles as unknown as ConvexUserProfilesProvider,
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
  });

  it("rejects requests when preview access is disabled", async () => {
    process.env.PREVIEW_ACCESS_ENABLED = "false";

    await expect(runFor("farmer")).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(firebase.createCustomToken).not.toHaveBeenCalled();
  });

  it("rejects requests at or after the UTC cutoff", async () => {
    process.env.PREVIEW_ACCESS_CUTOFF_UTC = new Date(
      Date.now() - 1,
    ).toISOString();

    await expect(runFor("buyer")).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(firebase.createCustomToken).not.toHaveBeenCalled();
  });

  it("rejects roles outside the public preview role list", async () => {
    await expect(runFor("admin")).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(firebase.createCustomToken).not.toHaveBeenCalled();
  });

  it("rejects a role without a configured Firebase UID", async () => {
    delete process.env.PREVIEW_ACCESS_TRANSPORTER_FIREBASE_UID;

    await expect(runFor("transporter")).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(firebase.createCustomToken).not.toHaveBeenCalled();
  });

  it("returns a Firebase custom token for the configured role UID", async () => {
    await expect(runFor("warehouse_agent")).resolves.toEqual({
      customToken: "firebase-custom-token",
      role: "warehouse_agent",
    });
    expect(firebase.createCustomToken).toHaveBeenCalledWith(
      "preview-operations-uid",
    );
  });

  it("fails closed when the configured UID belongs to another role", async () => {
    userProfiles.getByAuthProviderId.mockResolvedValue({
      userId: "admin-user-id",
      authProviderId: "preview-farmer-uid",
      role: "admin",
      status: "active",
    });

    await expect(runFor("farmer")).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(firebase.createCustomToken).not.toHaveBeenCalled();
  });

  it("fails closed when the configured profile is inactive or missing", async () => {
    userProfiles.getByAuthProviderId.mockResolvedValueOnce({
      userId: "farmer-user-id",
      authProviderId: "preview-farmer-uid",
      role: "farmer",
      status: "suspended",
    });
    await expect(runFor("farmer")).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });

    userProfiles.getByAuthProviderId.mockResolvedValueOnce(null);
    await expect(runFor("farmer")).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(firebase.createCustomToken).not.toHaveBeenCalled();
  });

  it("rate limits repeated session requests by client IP", async () => {
    process.env.API_RATE_LIMIT_PREVIEW_SESSION_MAX = "1";

    await expect(runFor("farmer")).resolves.toMatchObject({ role: "farmer" });
    await expect(runFor("buyer")).rejects.toSatisfy((error: HttpException) => {
      return error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
    });
    expect(firebase.createCustomToken).toHaveBeenCalledTimes(1);
  });

  function runFor(
    role: unknown,
  ): Promise<{ customToken: string; role: PreviewAccessRole }> {
    return workflow.run({ clientIp: "203.0.113.10", role });
  }
});
