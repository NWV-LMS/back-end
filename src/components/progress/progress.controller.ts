import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CreateProgressDto } from '../../libs/dto/progress/create-progress.dto';
import { UpdateProgressDto } from '../../libs/dto/progress/update-progress.dto';
import { QueryProgressDto } from '../../libs/dto/progress/query-progress.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../libs/types/auth';
import { UserRole } from 'generated/prisma/enums';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createProgressDto: CreateProgressDto,
  ) {
    return this.progressService.create(createProgressDto, user.organization_id!);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryProgressDto) {
    return this.progressService.findAll(user.organization_id!, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT)
  @Get('student/:studentId')
  getStudentProgress(
    @CurrentUser() user: JwtPayload,
    @Param('studentId', new ParseUUIDPipe({ version: '4' })) studentId: string,
  ) {
    return this.progressService.getStudentProgress(studentId, user.organization_id!);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.progressService.findOne(id, user.organization_id!);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ) {
    return this.progressService.update(id, updateProgressDto, user.organization_id!);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.progressService.remove(id, user.organization_id!);
  }
}
