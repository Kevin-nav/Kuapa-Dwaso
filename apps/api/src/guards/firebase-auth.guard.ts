import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { getApiEnvironment } from "../config/env.js";
import type { AuthPrincipal, RequestWithPrincipal } from "../lib/auth-principal.js";
import { ConvexUserProfilesProvider } from "../providers/convex-user-profiles.provider.js";
import { FirebaseAdminTokenVerifier } from "../providers/firebase-auth.provider.js";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly tokenVerifier: FirebaseAdminTokenVerifier,
    private readonly userProfiles: ConvexUserProfilesProvider
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const env = getApiEnvironment();
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (env.auth.disabled) {
      request.user = {
        authProviderId: "dev-auth-disabled",
        roles: ["admin"],
        status: "active"
      };
      return true;
    }

    const token = getBearerToken(request.headers.authorization);
    if (token === undefined) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const verifiedToken = await this.tokenVerifier.verifyIdToken(token);
    const userProfile = await this.userProfiles.getByAuthProviderId(verifiedToken.authProviderId);
    if (userProfile === null) {
      throw new ForbiddenException("Authenticated user profile is not registered.");
    }

    const principal: AuthPrincipal = {
      authProviderId: verifiedToken.authProviderId,
      userId: userProfile.userId,
      roles: [userProfile.role],
      status: userProfile.status
    };

    const email = userProfile.email ?? verifiedToken.email;
    if (email !== undefined) {
      principal.email = email;
    }

    const phoneNumber = userProfile.phoneNumber ?? verifiedToken.phoneNumber;
    if (phoneNumber !== undefined) {
      principal.phoneNumber = phoneNumber;
    }

    request.user = principal;

    return true;
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
