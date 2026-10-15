import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../libs/types/auth';
import { UserRole } from '@prisma/client';

import { CreateEnrollmentDto } from '../../libs/dto/enrollment/create-enrollment.dto';
import { UpdateEnrollmentDto } from '../../libs/dto/enrollment/update-enrollment.dto';
import { QueryEnrollmentDto } from '../../libs/dto/enrollment/query-enrollment.dto';
import {
  EnrollmentResponseDto,
  CreateEnrollmentResponseDto,
  DeleteEnrollmentResponseDto,
} from '../../libs/dto/enrollment/enrollment-response.dto';
import { PaginatedEnrollmentResponseDto } from '../../libs/dto/enrollment/paginated-enrollment-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateEnrollmentDto,
    @OrganizationId() organizationId: string,
  ): Promise<CreateEnrollmentResponseDto> {
    return this.enrollmentService.create(organizationId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get()
  findAll(
    @Query() query: QueryEnrollmentDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedEnrollmentResponseDto> {
    return this.enrollmentService.findAll(organizationId, query, user);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get('group/:groupId')
  findByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EnrollmentResponseDto[]> {
    return this.enrollmentService.findByGroup(groupId, organizationId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get('student/:studentId')
  findByStudent(
    @Param('studentId', new ParseUUIDPipe({ version: '4' })) studentId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EnrollmentResponseDto[]> {
    return this.enrollmentService.findByStudent(
      studentId,
      organizationId,
      user,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollmentService.findOne(id, organizationId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEnrollmentDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollmentService.update(id, organizationId, dto, user);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DeleteEnrollmentResponseDto> {
    return this.enrollmentService.remove(id, organizationId, user);
  }
}
