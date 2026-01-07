import { createParamDecorator, ExecutionContext } from '@nestjs/common';

//stringni jwtpayload qaytarish  qilish
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
