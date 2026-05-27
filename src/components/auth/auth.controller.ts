import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { RefreshTokenDto } from '../../libs/dto/auth/refresh-token.dto';
import { LoginDto, LoginResponseDto } from '../../libs/dto/auth/login.dto';
import { JwtPayload } from '../../libs/types/auth';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.userService.login(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.userService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload) {
    return this.userService.logout(user.sub);
  }
}
