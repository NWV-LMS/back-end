import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';
import { CreatePlatformOrganizationDto } from '../../libs/dto/auth/create-platform-organization.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator'
import { UserService } from '../user/user.service'
import { CreateOrganizationDto } from 'src/libs/dto/organization/create-organization.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly userService: UserService
  ) {}

  @Roles(UserRole.SUPER_ADMIN)
  @Post('organizations')
  createOrganization(@Body() input: CreateOrganizationDto) {
    return this.userService.register(input);
  }
}
