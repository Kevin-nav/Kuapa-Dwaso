import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthPrincipal, RequestWithPrincipal } from "./auth-principal.js";

export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal | undefined => {
  const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
  return request.user;
});
