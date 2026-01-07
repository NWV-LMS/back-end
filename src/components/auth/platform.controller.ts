import { Body, Controller, Get, Patch, Param, Post } from '@nestjs/common';
import { CreateOrganizationDto } from 'src/libs/dto/organization/create-organization.dto';
import { UpdateOrganizationDto } from 'src/libs/dto/organization/update-organization.dto';
import { Organ } from 'src/libs/dto/organization/organization-response.dto';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { User } from 'src/libs/dto/user/user-response.dto';

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

  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.SUPER_ADMIN)
  @Get('all')
  getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }
  // @UseGuards(JwtAuthGuard)
  // @Roles(UserRole.SUPER_ADMIN)
  @Patch(':id')
  public async updateOrganization(
    @Param('id') id: string,
    @Body() input: UpdateOrganizationDto,
  ): Promise<Organ> {
    console.log('Update organization', id, input);
    return await this.authService.updateOrganization(id, input);
  }
}
