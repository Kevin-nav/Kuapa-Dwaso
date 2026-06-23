import "reflect-metadata";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirebaseAuthGuard } from "./firebase-auth.guard.js";
import type { RequestWithPrincipal } from "../lib/auth-principal.js";
import type { ConvexUserProfilesProvider } from "../providers/convex-user-profiles.provider.js";
import type { FirebaseAdminTokenVerifier } from "../providers/firebase-auth.provider.js";

describe("FirebaseAuthGuard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.API_AUTH_DISABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects requests without a bearer token", async () => {
    const guard = createGuard();

    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("allows explicit non-production auth-disabled mode", async () => {
    process.env.NODE_ENV = "development";
    process.env.API_AUTH_DISABLED = "true";
    const request: RequestWithPrincipal = { headers: {} };
    const guard = createGuard();

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      authProviderId: "dev-auth-disabled",
      roles: ["admin"],
      status: "active"
    });
  });

  it("rejects verified Firebase identities without a Convex user profile", async () => {
    const guard = createGuard({
      tokenVerifier: {
        verifyIdToken: vi.fn().mockResolvedValue({ authProvider: "firebase", authProviderId: "firebase-user-1" })
      },
      userProfiles: {
        getByAuthProviderId: vi.fn().mockResolvedValue(null)
      }
    });

    await expect(
      guard.canActivate(createContext({ headers: { authorization: "Bearer valid-token" } }))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("hydrates the request principal from the Convex profile", async () => {
    const request: RequestWithPrincipal = { headers: { authorization: "Bearer valid-token" } };
    const guard = createGuard({
      tokenVerifier: {
        verifyIdToken: vi.fn().mockResolvedValue({
          authProvider: "firebase",
          authProviderId: "firebase-user-1",
          email: "token@example.com"
        })
      },
      userProfiles: {
        getByAuthProviderId: vi.fn().mockResolvedValue({
          userId: "convex-user-1",
          authProviderId: "firebase-user-1",
          role: "agent",
          status: "active",
          phoneNumber: "+233500000000"
        })
      }
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      authProviderId: "firebase-user-1",
      userId: "convex-user-1",
      roles: ["agent"],
      status: "active",
      email: "token@example.com",
      phoneNumber: "+233500000000"
    });
  });
});

function createGuard(overrides?: {
  tokenVerifier?: Pick<FirebaseAdminTokenVerifier, "verifyIdToken">;
  userProfiles?: Pick<ConvexUserProfilesProvider, "getByAuthProviderId">;
}): FirebaseAuthGuard {
  const tokenVerifier = overrides?.tokenVerifier ?? {
    verifyIdToken: vi.fn()
  };
  const userProfiles = overrides?.userProfiles ?? {
    getByAuthProviderId: vi.fn()
  };

  return new FirebaseAuthGuard(
    tokenVerifier as unknown as FirebaseAdminTokenVerifier,
    userProfiles as unknown as ConvexUserProfilesProvider
  );
}

function createContext(request: RequestWithPrincipal): ExecutionContext {
  return {
    getArgByIndex: vi.fn(),
    getArgs: vi.fn(),
    getClass: vi.fn(),
    getHandler: vi.fn(),
    getType: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request
    }),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn()
  } as unknown as ExecutionContext;
}
