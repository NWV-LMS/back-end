import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QueryCalendarDto } from '../../libs/dto/calendar/query-calendar.dto';
import { CalendarService } from './calendar.service';
import { TeacherSessionDto } from '../../libs/dto/calendar/teacher-session.dto';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get('teacher/:teacherId')
  teacherCalendar(
    @OrganizationId() organizationId: string,
    @Param('teacherId', new ParseUUIDPipe({ version: '4' })) teacherId: string,
    @Query() query: QueryCalendarDto,
  ): Promise<TeacherSessionDto[]> {
    return this.calendarService.teacherCalendar(organizationId, teacherId, query);
  }
}

