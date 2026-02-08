import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Prefer value set by OrganizationIdGuard, but fall back to JWT payload if needed.
    return request.organizationId ?? request.user?.organization_id;
  },
);
