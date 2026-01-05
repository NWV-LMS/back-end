import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';

import { InviteUserDto } from '../../libs/dto/auth/invite-user.dto';
import { JwtPayload } from '../../libs/types/auth';
import { UserService } from '../user/user.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { User } from 'src/libs/dto/user/user-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.ADMIN)
  @Post('users')
  inviteUser(@Body() input: InviteUserDto, @CurrentUser() user: JwtPayload):Promise<User> {
    console.log('input',input );
    if (!user.organization_id) {
      throw new Error('organization_id is required for this action');
    }
    return this.userService.inviteUser(input, user.organization_id);
  }
}
