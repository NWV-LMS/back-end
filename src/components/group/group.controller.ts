import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';
import { CreateGroupDto } from '../../libs/dto/group/create-group.dto';
import { GroupResponseDto } from '../../libs/dto/group/group-response.dto';
import { UpdateGroupDto } from '../../libs/dto/group/update-group.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { GroupService } from './group.service';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateGroupDto,
    @OrganizationId() organizationId: string,
  ): Promise<GroupResponseDto> {
    return this.groupService.create(dto, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  findAll(
    @OrganizationId() organizationId: string,
  ): Promise<GroupResponseDto[]> {
    return this.groupService.findAll(organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ): Promise<GroupResponseDto> {
    return this.groupService.findOne(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateGroupDto,
    @OrganizationId() organizationId: string,
  ): Promise<GroupResponseDto> {
    return this.groupService.update(id, dto, organizationId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ): Promise<void> {
    return this.groupService.remove(id, organizationId);
  }
}
