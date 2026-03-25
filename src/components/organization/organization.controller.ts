import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateOrganizationDto } from '../../libs/dto/organization/create-organization.dto';
import { UpdateOrganizationDto } from '../../libs/dto/organization/update-organization.dto';
import { Organ } from '../../libs/dto/organization/organization-response.dto';
import { QueryOrganizationDto } from '../../libs/dto/organization/query-organization.dto';
import { UpdateOrganizationStatusDto } from '../../libs/dto/organization/update-organization-status.dto';
import {
  PaginatedOrganizationResponseDto,
  PlatformOrganizationDto,
} from '../../libs/dto/organization/platform-organization.dto';
import { UserService } from '../user/user.service';
import { OrganizationService } from './organization.service';
import { User } from '../../libs/dto/user/user-response.dto';
import { QueryPlatformUserDto } from '../../libs/dto/user/query-platform-user.dto';
import { PaginatedUserResponseDto } from '../../libs/dto/user/paginated-user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly userService: UserService,
    private readonly organizationService: OrganizationService,
  ) {}

  @Post('register')
  public async register(@Body() input: CreateOrganizationDto): Promise<Organ> {
    return await this.organizationService.register(input);
  }

  @Get('all')
  getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  @Get('users')
  listUsers(
    @Query() query: QueryPlatformUserDto,
  ): Promise<PaginatedUserResponseDto> {
    return this.userService.listUsersForPlatform(query);
  }

  @Patch(':id')
  public async updateOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateOrganizationDto,
  ): Promise<Organ> {
    return await this.organizationService.updateOrganization(id, input);
  }

  @Get('organizations')
  listOrganizations(
    @Query() query: QueryOrganizationDto,
  ): Promise<PaginatedOrganizationResponseDto> {
    return this.organizationService.listOrganizations(query);
  }

  @Patch('organizations/:id/status')
  updateOrganizationStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateOrganizationStatusDto,
  ): Promise<PlatformOrganizationDto> {
    return this.organizationService.updateOrganizationStatus(id, input);
  }
}
