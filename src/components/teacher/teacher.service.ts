import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import { CreateTeacherDto, UpdateTeacherDto } from '../../libs/dto/teacher';
import { Prisma, User, TeacherProfile, TeacherStatus } from '@prisma/client';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Create a new teacher
   * Creates both User (role=TEACHER) and TeacherProfile
   */
  async create(dto: CreateTeacherDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        organization_id: dto.organization_id,
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists in this organization');
    }

    // Check if phone already exists
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existingPhone) {
      throw new BadRequestException('Phone number already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user and teacher profile in transaction
    const teacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          full_name: dto.full_name,
          phone: dto.phone,
          role: 'TEACHER',
          organization_id: dto.organization_id,
        },
      });

      const teacherProfile = await tx.teacherProfile.create({
        data: {
          user_id: user.id,
          subjects: dto.subjects,
          hourly_rate: dto.hourly_rate,
          qualifications: dto.qualifications,
          bio: dto.bio,
        },
      });

      return { user, teacherProfile };
    });

    return this.formatTeacherResponse(teacher.user, teacher.teacherProfile);
  }

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

    // Filter by status
    if (status && Object.values(TeacherStatus).includes(status as TeacherStatus)) {
      const teacherStatus = status as TeacherStatus;
      if (where.teacherProfile && typeof where.teacherProfile === 'object') {
        (where.teacherProfile as Prisma.TeacherProfileNullableRelationFilter['is'])!.status = teacherStatus;
      } else {
        where.teacherProfile = { status: teacherStatus };
      }
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
      teachers: teachers.map((t) =>
        this.formatTeacherResponse(t, t.teacherProfile),
      ),
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

    return this.formatTeacherResponse(teacher, teacher.teacherProfile);
  }

  /**
   * Update teacher profile
   */
  async update(id: string, organizationId: string, dto: UpdateTeacherDto) {
    // Find teacher
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
      },
      include: { teacherProfile: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Update user fields if provided
    const userData: Prisma.UserUpdateInput = {};
    if (dto.full_name) userData.full_name = dto.full_name;
    if (dto.phone) userData.phone = dto.phone;

    // Update teacher profile fields if provided
    const profileData: Prisma.TeacherProfileUpdateInput = {};
    if (dto.subjects) profileData.subjects = dto.subjects;
    if (dto.hourly_rate !== undefined) profileData.hourly_rate = dto.hourly_rate;
    if (dto.qualifications !== undefined) profileData.qualifications = dto.qualifications;
    if (dto.bio !== undefined) profileData.bio = dto.bio;
    if (dto.status) profileData.status = dto.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userData,
        });
      }

      if (Object.keys(profileData).length > 0) {
        await tx.teacherProfile.update({
          where: { user_id: id },
          data: profileData,
        });
      }

      return tx.user.findUnique({
        where: { id },
        include: { teacherProfile: true },
      });
    });

    return this.formatTeacherResponse(updated!, updated!.teacherProfile);
  }

  /**
   * Delete teacher (soft delete - just change status)
   */
  async remove(id: string, organizationId: string) {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Soft delete - just change status to INACTIVE
    await this.prisma.teacherProfile.update({
      where: { user_id: id },
      data: { status: 'INACTIVE' },
    });

    return { message: 'Teacher deactivated successfully' };
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
   * Bulk create teachers
   */
  async bulkCreate(organizationId: string, teachers: CreateTeacherDto[]) {
    let createdCount = 0;

    // Optimization: Pre-hash passwords in parallel
    const hashedTeachers = await Promise.all(
      teachers.map(async (t) => {
        const password = t.password ?? Math.random().toString(36).slice(-10);
        const hashed = await bcrypt.hash(password, 10);
        return { ...t, password, hashed };
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const t of hashedTeachers) {
        // Check if email already exists
        const existingUser = await tx.user.findFirst({
          where: {
            organization_id: organizationId,
            email: t.email,
          },
        });

        if (existingUser) continue;

        // Check if phone already exists
        const existingPhone = await tx.user.findUnique({
          where: { phone: t.phone },
        });

        if (existingPhone) continue;

        // Create user
        const user = await tx.user.create({
          data: {
            email: t.email,
            password: t.hashed,
            full_name: t.full_name,
            phone: t.phone,
            role: 'TEACHER',
            organization_id: organizationId,
          },
        });

        // Create profile
        await tx.teacherProfile.create({
          data: {
            user_id: user.id,
            subjects: t.subjects,
            hourly_rate: t.hourly_rate,
            qualifications: t.qualifications,
            bio: t.bio,
            status: 'ACTIVE',
          },
        });

        createdCount++;
      }
    });

    return { count: createdCount };
  }

  /**
   * Get teachers statistics
   */
  async getStatistics(organizationId: string) {
    const [total, active, inactive, bySubject] = await Promise.all([
      // Total teachers
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
        },
      }),
      // Active teachers
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
          teacherProfile: { status: 'ACTIVE' },
        },
      }),
      // Inactive teachers
      this.prisma.user.count({
        where: {
          organization_id: organizationId,
          role: 'TEACHER',
          teacherProfile: { status: 'INACTIVE' },
        },
      }),
      // Teachers by subject
      this.prisma.teacherProfile.findMany({
        where: {
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
      by_subject: Object.entries(subjectCounts).map(([subject, count]) => ({
        subject,
        count,
      })),
    };
  }

  /**
   * Update teacher status
   */
  async updateStatus(id: string, organizationId: string, status: 'ACTIVE' | 'INACTIVE') {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id,
        organization_id: organizationId,
        role: 'TEACHER',
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    await this.prisma.teacherProfile.update({
      where: { user_id: id },
      data: { status },
    });

    return { message: `Teacher status updated to ${status}` };
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

  /**
   * Format teacher response
   */
  private formatTeacherResponse(
    user: User,
    profile: TeacherProfile | null | undefined,
  ) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      organization_id: user.organization_id,
      subjects: profile?.subjects || [],
      hourly_rate: profile?.hourly_rate ? Number(profile.hourly_rate) : null,
      qualifications: profile?.qualifications || null,
      bio: profile?.bio || null,
      status: profile?.status || 'INACTIVE',
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}