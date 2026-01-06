import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from 'src/libs/types/auth';

//stringni jwtpayload qaytarish  qilish
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as string | null;
  },
);
