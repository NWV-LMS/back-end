import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Prisma, TeacherStatus } from '@prisma/client';
import { formatTeacherResponse } from './teacher.formatter';

@Injectable()
export class TeacherQueryService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Get all teachers with pagination, search and filtering
   */
  async findAll(params: {
    organizationId: string;
    page: number;
    limit: number;
    search?: string;
    subject?: string;
    status?: string;
  }) {
    const { organizationId, page, limit, search, subject, status } = params;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      organization_id: organizationId,
      role: 'TEACHER',
    };

    // Search by name or email
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by subject
    if (subject) {
      where.teacherProfile = {
        subjects: {
          has: subject,
        },
      };
    }

    // Filter by status — DELETED is always excluded from normal listing
    const teacherStatus =
      status && Object.values(TeacherStatus).includes(status as TeacherStatus)
        ? (status as TeacherStatus)
        : undefined;

    if (teacherStatus === TeacherStatus.DELETED) {
      throw new BadRequestException(
        'Use /teachers/deleted endpoint to view deleted teachers',
      );
    }

    const statusFilter = teacherStatus ?? { not: TeacherStatus.DELETED };

    if (where.teacherProfile && typeof where.teacherProfile === 'object') {
      (where.teacherProfile as Prisma.TeacherProfileNullableRelationFilter['is'])!.status =
        statusFilter;
    } else {
      where.teacherProfile = { status: statusFilter };
    }

    const [teachers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          teacherProfile: true,
        },
        orderBy: { full_name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      teachers: teachers.map((t) => formatTeacherResponse(t, t.teacherProfile)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get teacher by ID
   */
  async findOne(id: string, organizationId: string) {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
        teacherProfile: { status: { not: TeacherStatus.DELETED } },
      },
      include: {
        teacherProfile: true,
        teachingGroups: {
          include: {
            course: true,
            enrollments: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return formatTeacherResponse(teacher, teacher.teacherProfile);
  }

  /**
   * Get soft-deleted teachers
   */
  async findDeleted(
    organizationId: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      organization_id: organizationId,
      role: 'TEACHER',
      teacherProfile: { status: TeacherStatus.DELETED },
    };

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [teachers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { teacherProfile: true },
        orderBy: { teacherProfile: { deleted_at: 'desc' } },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      teachers: teachers.map((t) => formatTeacherResponse(t, t.teacherProfile)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get teacher's groups
   */
  async getGroups(id: string, organizationId: string) {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
        teacherProfile: { status: { not: TeacherStatus.DELETED } },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const groups = await this.prisma.group.findMany({
      where: {
        teacher_id: id,
        organization_id: organizationId,
      },
      include: {
        course: { select: { title: true } },
        enrollments: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        course_title: g.course.title,
        start_date: g.start_date,
        end_date: g.end_date,
        student_count: g.enrollments.length,
      })),
    };
  }

  /**
   * Get teacher's schedule
   */
  async getSchedule(id: string, organizationId: string) {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
        teacherProfile: { status: { not: TeacherStatus.DELETED } },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const schedules = await this.prisma.groupSchedule.findMany({
      where: {
        group: {
          teacher_id: id,
          organization_id: organizationId,
        },
      },
      include: {
        group: {
          select: { name: true },
          include: { course: { select: { title: true } } },
        },
      },
      orderBy: [{ day_of_week: 'asc' }, { start_minute: 'asc' }],
    });

    return {
      schedule: schedules.map((s) => ({
        day_of_week: s.day_of_week,
        start_minute: s.start_minute,
        duration_minutes: s.duration_minutes,
        group_name: s.group.name,
        course_title: s.group.course.title,
      })),
    };
  }

  /**
   * Get teachers statistics
   */
  async getStatistics(organizationId: string) {
    const [total, active, inactive, deleted, bySubject] = await Promise.all([
      // Total teachers (excluding deleted)
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
          teacherProfile: { status: { not: TeacherStatus.DELETED } },
        },
      }),
      // Active teachers
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
          teacherProfile: { status: TeacherStatus.ACTIVE },
        },
      }),
      // Inactive teachers
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
          teacherProfile: { status: TeacherStatus.INACTIVE },
        },
      }),
      // Deleted teachers
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
          teacherProfile: { status: TeacherStatus.DELETED },
        },
      }),
      // Teachers by subject (excluding deleted)
      this.prisma.teacherProfile.findMany({
        where: {
          status: { not: TeacherStatus.DELETED },
          user: {
            organization_id: organizationId,
            role: 'TEACHER',
          },
        },
        select: { subjects: true },
      }),
    ]);

    // Count by subject
    const subjectCounts: Record<string, number> = {};
    bySubject.forEach((profile) => {
      profile.subjects.forEach((subject) => {
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      });
    });

    return {
      total,
      active,
      inactive,
      deleted,
      by_subject: Object.entries(subjectCounts).map(([subject, count]) => ({
        subject,
        count,
      })),
    };
  }

  /**
   * Get teacher performance metrics
   */
  async getPerformance(id: string, organizationId: string) {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
        teacherProfile: { status: { not: TeacherStatus.DELETED } },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const [groups, totalStudents, avgAttendance] = await Promise.all([
      // Teacher's groups
      this.prisma.group.count({
        where: {
          teacher_id: id,
          organization_id: organizationId,
        },
      }),
      // Total students
      this.prisma.enrollment.count({
        where: {
          group: {
            teacher_id: id,
            organization_id: organizationId,
          },
        },
      }),
      // Average attendance (mock data for now)
      Promise.resolve(85), // TODO: Implement actual attendance calculation
    ]);

    return {
      teacher_id: id,
      total_groups: groups,
      total_students: totalStudents,
      average_attendance: avgAttendance,
      performance_score: Math.min(100, (avgAttendance + groups * 5) / 2),
    };
  }
}
