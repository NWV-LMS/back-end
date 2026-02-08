import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { UserRole } from '@prisma/client';
import { CreateStudentDto } from '../../libs/dto/student/create-student.dto';
import { UpdateStudentDto } from '../../libs/dto/student/update-student.dto';
import { QueryStudentDto } from '../../libs/dto/student/query-student.dto';
import { EnrollStudentDto } from '../../libs/dto/student/enroll-student.dto';
import { StudentResponseDto } from '../../libs/dto/student/student-response.dto';
import { CreateStudentResponseDto } from '../../libs/dto/student/create-student-response.dto';
import { PaginatedStudentResponseDto } from '../../libs/dto/student/paginated-student-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @OrganizationId() organizationId: string,
  ): Promise<CreateStudentResponseDto> {
    return this.studentService.create(organizationId, dto);
  }
  // bu erda nega body emas query da kelyabti ?  biz pagelar berganimiz uchun
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get()
  findAll(
    @Query() query: QueryStudentDto,
    @OrganizationId() organizationId: string,
  ): Promise<PaginatedStudentResponseDto> {
    return this.studentService.findAll(organizationId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ): Promise<StudentResponseDto> {
    return this.studentService.findOne(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateStudentDto,
    @OrganizationId() organizationId: string,
  ): Promise<StudentResponseDto> {
    return this.studentService.update(id, organizationId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @OrganizationId() organizationId: string,
  ): Promise<{ message: string }> {
    return this.studentService.remove(id, organizationId);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/enroll')
  enroll(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: EnrollStudentDto,
    @OrganizationId() organizationId: string,
  ): Promise<any> {
    return this.studentService.enroll(id, dto, organizationId);
  }
}
