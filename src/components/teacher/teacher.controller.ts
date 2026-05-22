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
  Request,
} from '@nestjs/common';
import { TeacherQueryService } from './teacher-query.service';
import { TeacherMutationService } from './teacher-mutation.service';
import { TeacherBulkService } from './teacher-bulk.service';
import { TeacherSalaryService } from './teacher-salary.service';
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
  @IsIn(['ACTIVE', 'INACTIVE', 'ON_LEAVE'])
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}

@ApiTags('Teachers')
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('teachers')
export class TeacherController {
  constructor(
    private readonly query: TeacherQueryService,
    private readonly mutation: TeacherMutationService,
    private readonly bulk: TeacherBulkService,
    private readonly teacherSalaryService: TeacherSalaryService,
  ) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new teacher' })
  create(
    @Body() dto: CreateTeacherDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.mutation.create({ ...dto, organization_id: organizationId });
  }

  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.TEACHER,
  )
  @Get()
  @ApiOperation({
    summary:
      'Get all teachers with pagination, search and optional subject filter',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name or email',
  })
  @ApiQuery({
    name: 'subject',
    required: false,
    description: 'Filter by subject (e.g., ENGLISH, IT)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (ACTIVE, INACTIVE)',
  })
  findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string,
    @Query('subject') subject: string,
    @Query('status') status: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.query.findAll({
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
    return this.query.getStatistics(organizationId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get('deleted')
  @ApiOperation({ summary: 'Get soft-deleted teachers (SUPER_ADMIN only)' })
  findDeleted(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.query.findDeleted(
      organizationId,
      parseInt(page),
      parseInt(limit),
      search,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create teachers' })
  bulkCreate(
    @Body() dto: { teachers: CreateTeacherDto[] },
    @OrganizationId() organizationId: string,
  ) {
    return this.bulk.bulkCreate(organizationId, dto.teachers);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  @ApiOperation({ summary: 'Get teacher by ID' })
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.query.findOne(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Update teacher profile' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.mutation.update(id, organizationId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate teacher (soft delete)' })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.mutation.remove(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/groups')
  @ApiOperation({ summary: "Get teacher's groups" })
  getGroups(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.query.getGroups(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/schedule')
  @ApiOperation({ summary: "Get teacher's schedule" })
  getSchedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.query.getSchedule(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update teacher status' })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.mutation.updateStatus(id, organizationId, dto.status);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/performance')
  @ApiOperation({ summary: 'Get teacher performance metrics' })
  getPerformance(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.query.getPerformance(id, organizationId);
  }

  // ── Salary endpoints ────────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/salary')
  @ApiOperation({ summary: 'Preview salary for a teacher for a given month' })
  getSalary(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @Query('month') month?: string,
  ) {
    const period = month ?? new Date().toISOString().slice(0, 7);
    return this.teacherSalaryService.calculate(id, organizationId, period);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id/salary/history')
  @ApiOperation({ summary: 'Get salary payment history for a teacher' })
  getSalaryHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.teacherSalaryService.getHistory(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/salary/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark salary as paid for a given month' })
  paySalary(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @Body() body: { month?: string },
    @Request() req: { user: { id: string } },
  ) {
    const period = body.month ?? new Date().toISOString().slice(0, 7);
    return this.teacherSalaryService.markPaid(
      id,
      organizationId,
      period,
      req.user.id,
    );
  }
}
