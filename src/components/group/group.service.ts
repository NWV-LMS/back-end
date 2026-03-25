import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from '../../libs/dto/group/create-group.dto';
import { GroupResponseDto } from '../../libs/dto/group/group-response.dto';
import { UpdateGroupDto } from '../../libs/dto/group/update-group.dto';
import { toGroupResponse } from '../../libs/mappers/group.mapper';
import { SetGroupScheduleDto } from '../../libs/dto/schedule/set-group-schedule.dto';
import { GroupScheduleResponseDto } from '../../libs/dto/schedule/group-schedule-response.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class GroupService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateGroupDto,
    organizationId: string,
  ): Promise<GroupResponseDto> {
    // 1. Validate Course exists and belongs to Org
    const course = await this.database.course.findFirst({
      where: { id: dto.course_id, organization_id: organizationId },
    });
    if (!course) {
      throw new NotFoundException('Course not found or invalid');
    }

    // 2. Validate Teacher exists and belongs to Org
    const teacher = await this.database.user.findFirst({
      where: { id: dto.teacher_id, organization_id: organizationId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found or invalid');
    }

    // 3. Create Group
    const group = await this.database.group.create({
      data: {
        organization_id: organizationId,
        course_id: dto.course_id,
        teacher_id: dto.teacher_id,
        name: dto.name,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
      },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });

    // Always return API-safe DTO, not raw DB entity.
    return toGroupResponse(group);
  }

  async findAll(organizationId: string): Promise<GroupResponseDto[]> {
    const groups = await this.database.group.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });
    // Map DB entities to DTOs to keep API contract stable.
    return groups.map(toGroupResponse);
  }

  async findOne(id: string, organizationId: string): Promise<GroupResponseDto> {
    const group = await this.database.group.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Convert DB entity to response DTO.
    return toGroupResponse(group);
  }

  async update(
    id: string,
    dto: UpdateGroupDto,
    organizationId: string,
  ): Promise<GroupResponseDto> {
    await this.findOne(id, organizationId);

    // Optional: Validate course/teacher if they are being updated
    if (dto.course_id) {
      const course = await this.database.course.findFirst({
        where: { id: dto.course_id, organization_id: organizationId },
      });
      if (!course) throw new NotFoundException('Course not found');
    }

    if (dto.teacher_id) {
      const teacher = await this.database.user.findFirst({
        where: { id: dto.teacher_id, organization_id: organizationId },
      });
      if (!teacher) throw new NotFoundException('Teacher not found');
    }

    const updated = await this.database.group.update({
      where: { id },
      data: {
        ...dto,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });

    // Convert DB entity to response DTO.
    return toGroupResponse(updated);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);

    // Check for enrollments before deleting
    const enrollments = await this.database.enrollment.findFirst({
      where: { group_id: id },
    });

    if (enrollments) {
      throw new BadRequestException(
        'Cannot delete group with existing enrollments',
      );
    }

    await this.database.group.delete({
      where: { id },
    });
  }

  async getSchedule(
    groupId: string,
    organizationId: string,
  ): Promise<GroupScheduleResponseDto[]> {
    await this.findOne(groupId, organizationId);
    const rows = await this.database.groupSchedule.findMany({
      where: { group_id: groupId, organization_id: organizationId },
      orderBy: [{ day_of_week: 'asc' }, { start_minute: 'asc' }],
    });
    return rows.map((r) => this.toScheduleResponse(r));
  }

  async setSchedule(
    groupId: string,
    organizationId: string,
    dto: SetGroupScheduleDto,
  ): Promise<GroupScheduleResponseDto[]> {
    const group = await this.database.group.findFirst({
      where: { id: groupId, organization_id: organizationId },
      select: {
        id: true,
        teacher_id: true,
        start_date: true,
        end_date: true,
      },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const items = dto.items.map((i) => {
      const start_minute = this.hhmmToMinute(i.start_time);
      const duration_minutes = i.duration_minutes ?? 120;
      return {
        day_of_week: i.day_of_week,
        start_minute,
        duration_minutes,
        end_minute: start_minute + duration_minutes,
      };
    });

    const days = [...new Set(items.map((i) => i.day_of_week))];
    const existing = await this.database.groupSchedule.findMany({
      where: {
        organization_id: organizationId,
        day_of_week: { in: days },
        group_id: { not: groupId },
        group: { teacher_id: group.teacher_id },
      },
      include: {
        group: {
          select: { id: true, name: true, start_date: true, end_date: true },
        },
      },
      orderBy: [{ day_of_week: 'asc' }, { start_minute: 'asc' }],
    });

    for (const it of items) {
      for (const ex of existing) {
        if (ex.day_of_week !== it.day_of_week) continue;
        if (
          !this.dateRangesOverlap(
            group.start_date,
            group.end_date,
            ex.group.start_date,
            ex.group.end_date,
          )
        ) {
          continue;
        }
        const exEnd = ex.start_minute + ex.duration_minutes;
        const overlaps =
          it.start_minute < exEnd && ex.start_minute < it.end_minute;
        if (overlaps) {
          throw new BadRequestException(
            `Teacher schedule conflict with group \"${ex.group.name}\" on day ${it.day_of_week} at ${this.minuteToHHMM(ex.start_minute)}`,
          );
        }
      }
    }

    await this.database.$transaction(async (tx) => {
      await tx.groupSchedule.deleteMany({
        where: { group_id: groupId, organization_id: organizationId },
      });
      await tx.groupSchedule.createMany({
        data: items.map((i) => ({
          organization_id: organizationId,
          group_id: groupId,
          day_of_week: i.day_of_week,
          start_minute: i.start_minute,
          duration_minutes: i.duration_minutes,
        })),
      });
    });

    return this.getSchedule(groupId, organizationId);
  }

  private toScheduleResponse(row: any): GroupScheduleResponseDto {
    return {
      id: row.id,
      day_of_week: row.day_of_week,
      start_time: this.minuteToHHMM(row.start_minute),
      duration_minutes: row.duration_minutes,
    };
  }

  private hhmmToMinute(hhmm: string): number {
    const [hh, mm] = hhmm.split(':').map((x) => Number(x));
    return hh * 60 + mm;
  }

  private minuteToHHMM(min: number): string {
    const hh = Math.floor(min / 60);
    const mm = min % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  private dateRangesOverlap(
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date,
  ): boolean {
    return (
      aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime()
    );
  }
}
