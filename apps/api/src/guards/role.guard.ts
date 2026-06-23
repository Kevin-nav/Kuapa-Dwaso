import {
  CanActivate,
  type CustomDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { principalHasAnyPermission, principalHasAnyRole, type PermissionKey } from "@kuapa-dwaso/permissions";
import type { MarketplaceRole } from "@kuapa-dwaso/types";
import type { RequestWithPrincipal } from "../lib/auth-principal.js";

const requiredRolesMetadataKey = "kuapa:requiredRoles";
const requiredPermissionsMetadataKey = "kuapa:requiredPermissions";

export const RequireRoles = (...roles: MarketplaceRole[]): CustomDecorator<string> =>
  SetMetadata(requiredRolesMetadataKey, roles);
export const RequirePermissions = (...permissions: PermissionKey[]): CustomDecorator<string> =>
  SetMetadata(requiredPermissionsMetadataKey, permissions);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (request.user === undefined) {
      throw new UnauthorizedException("Authenticated principal required.");
    }

    if (request.user.status !== "active") {
      throw new ForbiddenException("Active user status required.");
    }

    const requiredRoles = this.reflector.getAllAndOverride<MarketplaceRole[]>(requiredRolesMetadataKey, [
      context.getHandler(),
      context.getClass()
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<PermissionKey[]>(requiredPermissionsMetadataKey, [
      context.getHandler(),
      context.getClass()
    ]);

    if (requiredRoles !== undefined && !principalHasAnyRole(request.user.roles, requiredRoles)) {
      throw new ForbiddenException("Required role not granted.");
    }

    if (requiredPermissions !== undefined && !principalHasAnyPermission(request.user.roles, requiredPermissions)) {
      throw new ForbiddenException("Required permission not granted.");
    }

    return request.user.roles.length > 0 || (requiredRoles === undefined && requiredPermissions === undefined);
  }
}

export function principalHasRole(roles: MarketplaceRole[], requiredRole: MarketplaceRole): boolean {
  return principalHasAnyRole(roles, [requiredRole]);
}
