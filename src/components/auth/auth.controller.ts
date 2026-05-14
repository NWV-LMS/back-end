import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RefreshTokenDto } from '../../libs/dto/auth/refresh-token.dto';
import { LoginDto, LoginResponseDto } from '../../libs/dto/auth/login.dto';
import { JwtPayload } from '../../libs/types/auth';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RateLimit } from './decorators/rate-limit.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('login')
  @RateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'auth:login' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.userService.login(dto);
  }

  @Post('refresh')
  @RateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'auth:refresh' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.userService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload) {
    return this.userService.logout(user.sub);
  }
}
