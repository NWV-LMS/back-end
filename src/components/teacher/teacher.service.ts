import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import { CreateTeacherDto, UpdateTeacherDto } from '../../libs/dto/teacher';

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
   * Get all teachers with optional filtering by subject
   */
  async findAll(organizationId: string, subject?: string) {
    const where: any = {
      organization_id: organizationId,
      role: 'TEACHER',
    };

    if (subject) {
      where.teacherProfile = {
        subjects: {
          has: subject,
        },
      };
    }

    const teachers = await this.prisma.user.findMany({
      where,
      include: {
        teacherProfile: true,
      },
      orderBy: { full_name: 'asc' },
    });

    return {
      teachers: teachers.map((t) =>
        this.formatTeacherResponse(t, t.teacherProfile),
      ),
      total: teachers.length,
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
    const userData: any = {};
    if (dto.full_name) userData.full_name = dto.full_name;
    if (dto.phone) userData.phone = dto.phone;

    // Update teacher profile fields if provided
    const profileData: any = {};
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
   * Format teacher response
   */
  private formatTeacherResponse(user: any, profile: any) {
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