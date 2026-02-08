import { Body, Controller, Post } from '@nestjs/common';
import { RefreshTokenDto } from '../../libs/dto/auth/refresh-token.dto';
import { AuthService } from './auth.service';
import { RateLimit } from './decorators/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('refresh')
  @RateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'auth:refresh' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }
}
