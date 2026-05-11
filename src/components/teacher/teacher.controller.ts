import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto, UpdateTeacherDto } from '../../libs/dto/teacher';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { UserRole } from '@prisma/client';
import { IsIn, IsNotEmpty } from 'class-validator';

class UpdateStatusDto {
  @IsNotEmpty()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}

@ApiTags('Teachers')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new teacher' })
  create(
    @Body() dto: CreateTeacherDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.create({ ...dto, organization_id: organizationId });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get()
  @ApiOperation({ summary: 'Get all teachers with pagination, search and optional subject filter' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or email' })
  @ApiQuery({ name: 'subject', required: false, description: 'Filter by subject (e.g., ENGLISH, IT)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (ACTIVE, INACTIVE)' })
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string,
    @Query('subject') subject: string,
    @Query('status') status: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.findAll({
      organizationId,
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      subject,
      status,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @Get('statistics')
  @ApiOperation({ summary: 'Get teachers statistics' })
  getStatistics(@OrganizationId() organizationId: string) {
    return this.teacherService.getStatistics(organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create teachers' })
  bulkCreate(
    @Body() dto: { teachers: CreateTeacherDto[] },
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.bulkCreate(organizationId, dto.teachers);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  @ApiOperation({ summary: 'Get teacher by ID' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.findOne(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update teacher profile' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teacherService.update(id, organizationId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate teacher (soft delete)' })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.remove(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/groups')
  @ApiOperation({ summary: 'Get teacher\'s groups' })
  getGroups(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.getGroups(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get teacher\'s schedule' })
  getSchedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.getSchedule(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update teacher status' })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.teacherService.updateStatus(id, organizationId, dto.status);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/performance')
  @ApiOperation({ summary: 'Get teacher performance metrics' })
  getPerformance(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherService.getPerformance(id, organizationId);
  }
}