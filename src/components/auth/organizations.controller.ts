import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '@prisma/client';
import { InviteUserDto } from '../../libs/dto/auth/invite-user.dto';
import { UserService } from '../user/user.service';
import { Roles } from './decorators/roles.decorator';
import { OrganizationId } from './decorators/organization-id.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OrganizationIdGuard } from './guards/organization-id.guard';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.ADMIN)
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  inviteUser(
    @Body() input: InviteUserDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.userService.inviteUser(input, organizationId);
  }
}
