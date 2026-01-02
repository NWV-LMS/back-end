import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateOrganizationDto } from 'src/libs/dto/organization/create-organization.dto';
import { Organ } from 'src/libs/dto/organization/organization-response.dto';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

//! @UseGuards(JwtAuthGuard, RolesGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  // @Roles(UserRole.SUPER_ADMIN)
  // @UseGuards(JwtAuthGuard)
  @Post('register')
  public async register(@Body() input: CreateOrganizationDto): Promise<Organ> {
    console.log('Register organization');
    return await this.authService.register(input);
  }
}
