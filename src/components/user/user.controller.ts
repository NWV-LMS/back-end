import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { UserRole } from 'generated/prisma/enums';
import { ChangePasswordDto } from 'src/libs/dto/auth/change-password.dto';
import { LoginDto, LoginResponseDto } from 'src/libs/dto/auth/login.dto';
import { JwtPayload } from 'src/libs/types/auth';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.SUPER_ADMIN)
  //* @UseGuards(JwtAuthGuard)
  // @Post('register')
  // public async register(@Body() input: CreateOrganizationDto): Promise<Organ> {
  //   return this.userService.register(input);
  // }
  @Post('login')
  login(@Body() input: LoginDto): Promise<LoginResponseDto> {
    console.log('User login');
    return this.userService.login(input);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.userService.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload) {
    console.log('Logout', user);
    return this.userService.logout(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(user.sub, dto);
  }
}
