import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { MarketplaceRole } from "@kuapa-dwaso/types";
import type { RequestWithPrincipal } from "../lib/auth-principal.js";

@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (request.user === undefined) {
      throw new UnauthorizedException("Authenticated principal required.");
    }

    return request.user.roles.length > 0;
  }
}

export function principalHasRole(roles: MarketplaceRole[], requiredRole: MarketplaceRole): boolean {
  return roles.includes(requiredRole);
}
