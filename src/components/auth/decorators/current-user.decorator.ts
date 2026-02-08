import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../../libs/types/auth';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!data) return user;
    return user ? (user as any)[data] : undefined;
  },
);
