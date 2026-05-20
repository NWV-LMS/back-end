import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { SubjectService } from './subject.service';
import { CreateSubjectDto } from '../../libs/dto/subject/create-subject.dto';
import { UpdateSubjectDto } from '../../libs/dto/subject/update-subject.dto';
import { SubjectResponseDto } from '../../libs/dto/subject/subject-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('subject')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateSubjectDto,
    @OrganizationId() orgId: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectService.create(dto, orgId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT)
  @Get()
  findAll(@OrganizationId() orgId: string): Promise<SubjectResponseDto[]> {
    return this.subjectService.findAll(orgId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() orgId: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectService.findOne(id, orgId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSubjectDto,
    @OrganizationId() orgId: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectService.update(id, dto, orgId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() orgId: string,
  ): Promise<void> {
    return this.subjectService.remove(id, orgId);
  }
}
