import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreateUserDto } from '../../libs/dto/user/create-user.dto';

import { CreateOrganizationDto } from 'src/libs/dto/organization/create-organization.dto';
import { Organ } from 'src/libs/dto/organization/organization-response.dto';
import { User } from 'src/libs/dto/user/user-response.dto';
import { UserService } from './user.service';
import { LoginDto } from 'src/libs/dto/auth/login.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { JwtPayload } from 'src/libs/types/auth'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { ChangePasswordDto } from 'src/libs/dto/auth/change-password.dto'

@Controller('user')
export class UserController { 
  constructor(private readonly userService: UserService) {}

  @Post('register')
  public async register(@Body() input: CreateOrganizationDto): Promise<Organ> {
    console.log('*** Post, register organization ***');
    return this.userService.register(input);
  }

  @Post('signup')
  public async signup(@Body() input: CreateUserDto): Promise<User> {
    console.log('signup');
    return this.userService.signup(input);
  }


  @Post('login')
  login(@Body() input: LoginDto) {
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
