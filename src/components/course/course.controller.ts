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
import { CourseResponseDto } from 'src/libs/dto/course/course-response.dto';
import { CreateCourseDto } from 'src/libs/dto/course/create-course.dto';
import { UpdateCourseDto } from 'src/libs/dto/course/update-course.dto';
import { JwtPayload } from 'src/libs/types/auth';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CourseService } from './course.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    if (!user.organization_id) {
       throw new Error('Organization ID is required');
    }
    return this.courseService.create(dto, user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<CourseResponseDto[]> {
    if (!user.organization_id) {
        throw new Error('Organization ID is required');
     }
    return this.courseService.findAll(user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    if (!user.organization_id) {
        throw new Error('Organization ID is required');
     }
    return this.courseService.findOne(id, user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CourseResponseDto> {
    if (!user.organization_id) {
        throw new Error('Organization ID is required');
     }
    return this.courseService.update(id, dto, user.organization_id);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    if (!user.organization_id) {
        throw new Error('Organization ID is required');
     }
    return this.courseService.remove(id, user.organization_id);
  }
}
