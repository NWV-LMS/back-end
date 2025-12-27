import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from 'src/libs/types/auth'


export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload | null;
  },
);
