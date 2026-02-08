import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from '../../libs/dto/lesson/create-lesson.dto';
import { UpdateLessonDto } from '../../libs/dto/lesson/update-lesson.dto';
import { QueryLessonDto } from '../../libs/dto/lesson/query-lesson.dto';
import { RescheduleLessonDto } from '../../libs/dto/lesson/reschedule-lesson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { JwtPayload } from '../../libs/types/auth';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@CurrentUser() user: JwtPayload, @Body() createLessonDto: CreateLessonDto) {
    return this.lessonService.create(user.organization_id!, createLessonDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query() dto: QueryLessonDto,
  ) {
    dto.page = page;
    dto.limit = limit;
    return this.lessonService.findAll(user.organization_id!, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonService.findOne(id, user.organization_id!);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonService.update(id, user.organization_id!, updateLessonDto);
  }

  @Patch(':id/reschedule')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  reschedule(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleLessonDto,
  ) {
    return this.lessonService.reschedule(id, user.organization_id!, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonService.remove(id, user.organization_id!);
  }
}
