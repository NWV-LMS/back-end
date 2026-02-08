import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from '../../libs/dto/attendance/mark-attendance.dto';
import { QueryAttendanceDto } from '../../libs/dto/attendance/query-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { JwtPayload } from '../../libs/types/auth';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  mark(@CurrentUser() user: JwtPayload, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(user.organization_id!, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query() dto: QueryAttendanceDto,
  ) {
    dto.page = page;
    dto.limit = limit;
    return this.attendanceService.findAll(user.organization_id!, dto);
  }
}
