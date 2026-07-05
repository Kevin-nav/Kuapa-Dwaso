import "reflect-metadata";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { RequirePermissions, RequireRoles, RoleGuard } from "./role.guard.js";
import type { RequestWithPrincipal } from "../lib/auth-principal.js";

describe("RoleGuard", () => {
  it("requires an authenticated principal", () => {
    const guard = new RoleGuard(new Reflector());

    expect(() => guard.canActivate(createContext({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it("rejects inactive principals", () => {
    const guard = new RoleGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext({
          headers: {},
          user: {
            authProviderId: "firebase-user-1",
            roles: ["admin"],
            status: "suspended"
          }
        })
      )
    ).toThrow(ForbiddenException);
  });

  it("allows matching required roles", () => {
    const handler = createDecoratedHandler(RequireRoles("admin"));
    const guard = new RoleGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(
          {
            headers: {},
            user: {
              authProviderId: "firebase-user-1",
              roles: ["admin"],
              status: "active"
            }
          },
          handler
        )
      )
    ).toBe(true);
  });

  it("allows matching required permissions", () => {
    const handler = createDecoratedHandler(RequirePermissions("inventory:create"));
    const guard = new RoleGuard(new Reflector());

    expect(
      guard.canActivate(
        createContext(
          {
            headers: {},
            user: {
              authProviderId: "firebase-user-1",
              roles: ["warehouse_agent"],
              status: "active"
            }
          },
          handler
        )
      )
    ).toBe(true);
  });
});

function createDecoratedHandler(decorator: MethodDecorator): () => void {
  class TestController {
    handler(): void {}
  }

  const descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, "handler");
  if (descriptor === undefined) {
    throw new Error("Missing test handler descriptor.");
  }

  decorator(TestController.prototype, "handler", descriptor);
  return TestController.prototype.handler;
}

function createContext(request: RequestWithPrincipal, handler: () => void = () => undefined): ExecutionContext {
  return {
    getArgByIndex: () => undefined,
    getArgs: () => [],
    switchToHttp: () => ({
      getRequest: () => request
    }),
    getHandler: () => handler,
    getClass: () => class TestController {},
    getType: () => "http",
    switchToRpc: () => ({
      getContext: () => undefined,
      getData: () => undefined
    }),
    switchToWs: () => ({
      getClient: () => undefined,
      getData: () => undefined,
      getPattern: () => undefined
    })
  } as unknown as ExecutionContext;
}
