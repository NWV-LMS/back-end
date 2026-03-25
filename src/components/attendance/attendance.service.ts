import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MarkAttendanceDto } from '../../libs/dto/attendance/mark-attendance.dto';
import { QueryAttendanceDto } from '../../libs/dto/attendance/query-attendance.dto';
import { AttendanceResponseDto } from '../../libs/dto/attendance/attendance-response.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly database: DatabaseService) {}

  async mark(
    organizationId: string,
    dto: MarkAttendanceDto,
  ): Promise<AttendanceResponseDto> {
    // Validate enrollment belongs to organization
    const enrollment = await this.database.enrollment.findFirst({
      where: {
        id: dto.enrollment_id,
        organization_id: organizationId,
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Validate lesson belongs to organization
    const lesson = await this.database.lesson.findFirst({
      where: {
        id: dto.lesson_id,
        course: { organization_id: organizationId },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check if attendance already marked
    const existing = await this.database.attendance.findFirst({
      where: {
        enrollment_id: dto.enrollment_id,
        lesson_id: dto.lesson_id,
      },
    });

    if (existing) {
      // Update existing
      const updated = await this.database.attendance.update({
        where: { id: existing.id },
        data: {
          status: dto.status,
          marked_at: new Date(),
        },
      });
      return this.toResponse(updated);
    }

    const attendance = await this.database.attendance.create({
      data: {
        organization_id: organizationId,
        enrollment_id: dto.enrollment_id,
        lesson_id: dto.lesson_id,
        status: dto.status,
      },
    });

    return this.toResponse(attendance);
  }

  async findAll(organizationId: string, query: QueryAttendanceDto) {
    const { page = 1, limit = 20, enrollment_id, lesson_id, group_id, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      organization_id: organizationId,
    };

    if (enrollment_id) where.enrollment_id = enrollment_id;
    if (lesson_id) where.lesson_id = lesson_id;
    if (status) where.status = status;
    if (group_id) {
      where.enrollment = {
        group_id: group_id,
      };
    }

    const [items, total] = await Promise.all([
      this.database.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { marked_at: 'desc' },
      }),
      this.database.attendance.count({ where }),
    ]);

    return {
      items: items.map(this.toResponse),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private toResponse(attendance: any): AttendanceResponseDto {
    return {
      id: attendance.id,
      enrollment_id: attendance.enrollment_id,
      lesson_id: attendance.lesson_id,
      status: attendance.status,
      marked_at: attendance.marked_at,
    };
  }
}
