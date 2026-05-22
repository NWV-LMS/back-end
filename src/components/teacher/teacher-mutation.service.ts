import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import { CreateTeacherDto, UpdateTeacherDto } from '../../libs/dto/teacher';
import { Prisma, TeacherStatus } from '@prisma/client';
import { formatTeacherResponse } from './teacher.formatter';

@Injectable()
export class TeacherMutationService {
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
      throw new BadRequestException(
        'Email already exists in this organization',
      );
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
          fixed_salary: dto.fixed_salary,
          percent_rate: dto.percent_rate,
          salary_type: dto.salary_type ?? 'FIXED',
          qualifications: dto.qualifications,
          bio: dto.bio,
        },
      });

      return { user, teacherProfile };
    });

    return formatTeacherResponse(teacher.user, teacher.teacherProfile);
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
    if (dto.hourly_rate !== undefined)
      profileData.hourly_rate = dto.hourly_rate;
    if (dto.fixed_salary !== undefined)
      profileData.fixed_salary = dto.fixed_salary;
    if (dto.percent_rate !== undefined)
      profileData.percent_rate = dto.percent_rate;
    if (dto.salary_type !== undefined)
      profileData.salary_type = dto.salary_type;
    if (dto.qualifications !== undefined)
      profileData.qualifications = dto.qualifications;
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

    return formatTeacherResponse(updated!, updated!.teacherProfile);
  }

  /**
   * Delete teacher (soft delete)
   */
  async remove(id: string, organizationId: string) {
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

    await this.prisma.teacherProfile.update({
      where: { user_id: id },
      data: { status: TeacherStatus.DELETED, deleted_at: new Date() },
    });

    return { message: 'Teacher deleted successfully' };
  }

  /**
   * Update teacher status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE',
  ) {
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
}
