import { Body, Controller, Post } from '@nestjs/common';
import { RefreshTokenDto } from '../../libs/dto/auth/refresh-token.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }
}
