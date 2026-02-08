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
import { UserRole } from '@prisma/client';
import { CourseResponseDto } from '../../libs/dto/course/course-response.dto';
import { CreateCourseDto } from '../../libs/dto/course/create-course.dto';
import { UpdateCourseDto } from '../../libs/dto/course/update-course.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { CourseService } from './course.service';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateCourseDto,
    @OrganizationId() organizationId: string,
  ): Promise<CourseResponseDto> {
    return this.courseService.create(dto, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  findAll(
    @OrganizationId() organizationId: string,
  ): Promise<CourseResponseDto[]> {
    return this.courseService.findAll(organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ): Promise<CourseResponseDto> {
    return this.courseService.findOne(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCourseDto,
    @OrganizationId() organizationId: string,
  ): Promise<CourseResponseDto> {
    return this.courseService.update(id, dto, organizationId);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ): Promise<void> {
    return this.courseService.remove(id, organizationId);
  }
}
