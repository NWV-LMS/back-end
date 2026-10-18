import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Attendance, Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { MarkAttendanceDto } from '../../libs/dto/attendance/mark-attendance.dto';
import { QueryAttendanceDto } from '../../libs/dto/attendance/query-attendance.dto';
import { AttendanceResponseDto } from '../../libs/dto/attendance/attendance-response.dto';
import {
  EnrollmentActor,
  enrollmentAccessWhere,
} from '../enrollment/enrollment-access';
import { lessonTenantWhere } from '../lesson/lesson-access';

@Injectable()
export class AttendanceService {
  constructor(private readonly database: DatabaseService) {}

  async mark(
    organizationId: string,
    dto: MarkAttendanceDto,
    actor: EnrollmentActor,
  ): Promise<AttendanceResponseDto> {
    // Validate enrollment belongs to organization
    const enrollment = await this.database.enrollment.findFirst({
      where: {
        id: dto.enrollment_id,
        ...enrollmentAccessWhere(organizationId, actor),
      },
      include: { group: { select: { course_id: true } } },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Validate lesson belongs to organization
    const lesson = await this.database.lesson.findFirst({
      where: {
        id: dto.lesson_id,
        ...lessonTenantWhere(organizationId),
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.course_id !== enrollment.group.course_id) {
      throw new BadRequestException(
        'Lesson must belong to the enrollment course',
      );
    }

    // Check if attendance already marked (defensive org filter)
    const existing = await this.database.attendance.findFirst({
      where: {
        organization_id: organizationId,
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

  async findAll(
    organizationId: string,
    query: QueryAttendanceDto,
    actor: EnrollmentActor,
  ) {
    const {
      page = 1,
      limit = 20,
      enrollment_id,
      lesson_id,
      group_id,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {
      organization_id: organizationId,
      enrollment: {
        ...enrollmentAccessWhere(organizationId, actor),
        ...(group_id ? { group_id } : {}),
      },
      lesson: lessonTenantWhere(organizationId),
    };

    if (enrollment_id) where.enrollment_id = enrollment_id;
    if (lesson_id) where.lesson_id = lesson_id;
    if (status) where.status = status;

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

  private toResponse(attendance: Attendance): AttendanceResponseDto {
    return {
      id: attendance.id,
      enrollment_id: attendance.enrollment_id,
      lesson_id: attendance.lesson_id,
      status: attendance.status,
      marked_at: attendance.marked_at,
    };
  }
}
