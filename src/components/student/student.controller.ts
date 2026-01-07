import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from 'generated/prisma/enums';
import { JwtPayload } from '../../libs/types/auth';
import { CreateStudentDto } from '../../libs/dto/student/create-student.dto';
import { UpdateStudentDto } from '../../libs/dto/student/update-student.dto';
import { QueryStudentDto } from '../../libs/dto/student/query-student.dto';
import { EnrollStudentDto } from '../../libs/dto/student/enroll-student.dto';
import { StudentResponseDto } from '../../libs/dto/student/student-response.dto';
import { CreateStudentResponseDto } from '../../libs/dto/student/create-student-response.dto';
import { PaginatedStudentResponseDto } from '../../libs/dto/student/paginated-student-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreateStudentResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.studentService.create(user.organization_id, dto);
  }
  // bu erda nega body emas query da kelyabti ?  biz pagelar berganimiz uchun
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get()
  findAll(
    @Query() query: QueryStudentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedStudentResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.studentService.findAll(user.organization_id, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.studentService.findOne(id, user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<StudentResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.studentService.update(id, user.organization_id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.studentService.remove(id, user.organization_id);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post(':id/enroll')
  enroll(
    @Param('id') id: string,
    @Body() dto: EnrollStudentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.studentService.enroll(id, dto, user.organization_id);
  }
}
