import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { UserUpdateDto } from '../../libs/dto/auth/userUpdate.dto';
import { LoginDto, LoginResponseDto } from '../../libs/dto/auth/login.dto';
import { JwtPayload } from '../../libs/types/auth';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { User } from '../../libs/dto/user/user-response.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
  @Post('update')
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Body() input: UserUpdateDto,
  ): Promise<User> {
    console.log('User update', input);
    return this.userService.updateUser(user.sub, input); //user.sub bu userni idsi
  }
}
