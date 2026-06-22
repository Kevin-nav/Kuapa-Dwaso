import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { getApiEnvironment } from "../config/env.js";
import type { RequestWithPrincipal } from "../lib/auth-principal.js";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const env = getApiEnvironment();
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (env.firebaseAuthDisabled) {
      request.user = {
        authProviderId: "dev-auth-disabled",
        roles: ["admin"]
      };
      return true;
    }

    const token = getBearerToken(request.headers.authorization);
    if (token === undefined) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    throw new UnauthorizedException("Firebase token verification is not configured yet.");
  }
}

function getBearerToken(authorization: string | string[] | undefined): string | undefined {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (header === undefined) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || token === undefined || token.length === 0) {
    return undefined;
  }

  return token;
}
