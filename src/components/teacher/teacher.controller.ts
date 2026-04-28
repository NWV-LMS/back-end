import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto, UpdateTeacherDto } from '../../libs/dto/teacher';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Teachers')
@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new teacher' })
  create(@Body() dto: CreateTeacherDto) {
    return this.teacherService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teachers with optional subject filter' })
  @ApiQuery({ name: 'subject', required: false, description: 'Filter by subject (e.g., ENGLISH, IT)' })
  findAll(
    @Query('subject') subject: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.teacherService.findAll(organizationId, subject);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher by ID' })
  findOne(
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.teacherService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update teacher profile' })
  update(
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teacherService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate teacher (soft delete)' })
  remove(
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.teacherService.remove(id, organizationId);
  }

  @Get(':id/groups')
  @ApiOperation({ summary: 'Get teacher\'s groups' })
  getGroups(
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.teacherService.getGroups(id, organizationId);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get teacher\'s schedule' })
  getSchedule(
    @Param('id') id: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    return this.teacherService.getSchedule(id, organizationId);
  }
}