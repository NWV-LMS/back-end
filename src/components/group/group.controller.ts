import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';
import { CreateGroupDto } from 'src/libs/dto/group/create-group.dto';
import { GroupResponseDto } from 'src/libs/dto/group/group-response.dto';
import { UpdateGroupDto } from 'src/libs/dto/group/update-group.dto';
import { JwtPayload } from 'src/libs/types/auth';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GroupService } from './group.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GroupResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.groupService.create(dto, user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<GroupResponseDto[]> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.groupService.findAll(user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<GroupResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.groupService.findOne(id, user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<GroupResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.groupService.update(id, dto, user.organization_id);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.groupService.remove(id, user.organization_id);
  }
}
