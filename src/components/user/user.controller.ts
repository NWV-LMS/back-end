import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserDto } from '../../libs/dto/user/create-user.dto';

import { UserService } from './user.service';
import { User } from 'src/libs/dto/user/user-response.dto'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('signup')
  public async signup(@Body() input: CreateUserDto): Promise<User> {
    console.log('signup');
    return this.userService.signup(input);
  }
}
