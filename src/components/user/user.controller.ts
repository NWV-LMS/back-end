import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { UserUpdateDto } from '../../libs/dto/auth/userUpdate.dto';
import { JwtPayload } from '../../libs/types/auth';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { User } from '../../libs/dto/user/user-response.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Post('update')
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Body() input: UserUpdateDto,
  ): Promise<User> {
    return this.userService.updateUser(user.sub, input);
  }
}
