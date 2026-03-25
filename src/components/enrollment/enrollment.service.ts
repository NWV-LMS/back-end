import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateEnrollmentDto } from '../../libs/dto/enrollment/create-enrollment.dto';
import { UpdateEnrollmentDto } from '../../libs/dto/enrollment/update-enrollment.dto';
import { QueryEnrollmentDto } from '../../libs/dto/enrollment/query-enrollment.dto';
import {
  EnrollmentResponseDto,
  CreateEnrollmentResponseDto,
  DeleteEnrollmentResponseDto,
} from '../../libs/dto/enrollment/enrollment-response.dto';
import { PaginatedEnrollmentResponseDto } from '../../libs/dto/enrollment/paginated-enrollment-response.dto';
import { toEnrollmentResponse } from '../../libs/mappers/enrollment.mapper';

const ENROLLMENT_INCLUDE = {
  student: {
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
    },
  },
  group: {
    select: {
      id: true,
      name: true,
      course: {
        select: {
          id: true,
          title: true,
        },
      },
      teacher: {
        select: {
          id: true,
          full_name: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class EnrollmentService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    organizationId: string,
    dto: CreateEnrollmentDto,
  ): Promise<CreateEnrollmentResponseDto> {
    const student = await this.database.student.findFirst({
      where: {
        id: dto.student_id,
        organization_id: organizationId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const group = await this.database.group.findFirst({
      where: {
        id: dto.group_id,
        organization_id: organizationId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const existingEnrollment = await this.database.enrollment.findFirst({
      where: {
        student_id: dto.student_id,
        group_id: dto.group_id,
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException(
        'This student is already enrolled in this group',
      );
    }

    const enrollment = await this.database.enrollment.create({
      data: {
        organization_id: organizationId,
        student_id: dto.student_id,
        group_id: dto.group_id,
      },
      include: ENROLLMENT_INCLUDE,
    });

    return {
      message: 'Enrollment created successfully',
      // Always return API-safe DTO, not raw DB entity.
      enrollment: toEnrollmentResponse(enrollment),
    };
  }

  async findAll(
    organizationId: string,
    query: QueryEnrollmentDto,
  ): Promise<PaginatedEnrollmentResponseDto> {
    const { page, limit, student_id, group_id } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    const groupWhere: any = {
      organization_id: organizationId,
    };

    if (group_id) {
      groupWhere.id = group_id;
    }

    where.group = groupWhere;

    if (student_id) {
      where.student_id = student_id;
    }

    const [items, total] = await Promise.all([
      this.database.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { enrolled_at: 'desc' },
        include: ENROLLMENT_INCLUDE,
      }),
      this.database.enrollment.count({ where }),
    ]);

    return {
      // Map DB entities to DTOs to keep API contract stable.
      items: items.map(toEnrollmentResponse),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<EnrollmentResponseDto> {
    const enrollment = await this.database.enrollment.findFirst({
      where: {
        id,
        group: {
          organization_id: organizationId,
        },
      },
      include: ENROLLMENT_INCLUDE,
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Convert DB entity to response DTO.
    return toEnrollmentResponse(enrollment);
  }

  async findByGroup(
    groupId: string,
    organizationId: string,
  ): Promise<EnrollmentResponseDto[]> {
    const group = await this.database.group.findFirst({
      where: {
        id: groupId,
        organization_id: organizationId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const enrollments = await this.database.enrollment.findMany({
      where: {
        group_id: groupId,
      },
      orderBy: { enrolled_at: 'desc' },
      include: ENROLLMENT_INCLUDE,
    });

    // Map DB entities to DTOs to keep API contract stable.
    return enrollments.map(toEnrollmentResponse);
  }

  async findByStudent(
    studentId: string,
    organizationId: string,
  ): Promise<EnrollmentResponseDto[]> {
    const student = await this.database.student.findFirst({
      where: {
        id: studentId,
        organization_id: organizationId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const enrollments = await this.database.enrollment.findMany({
      where: {
        student_id: studentId,
        group: {
          organization_id: organizationId,
        },
      },
      orderBy: { enrolled_at: 'desc' },
      include: ENROLLMENT_INCLUDE,
    });

    // Map DB entities to DTOs to keep API contract stable.
    return enrollments.map(toEnrollmentResponse);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateEnrollmentDto,
  ): Promise<EnrollmentResponseDto> {
    await this.findOne(id, organizationId);

    if (dto.group_id) {
      const group = await this.database.group.findFirst({
        where: {
          id: dto.group_id,
          organization_id: organizationId,
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      const existingEnrollment = await this.database.enrollment.findFirst({
        where: {
          id: { not: id },
          student_id: (
            await this.database.enrollment.findUnique({ where: { id } })
          )?.student_id,
          group_id: dto.group_id,
        },
      });

      if (existingEnrollment) {
        throw new BadRequestException(
          'This student is already enrolled in this group',
        );
      }
    }

    const updated = await this.database.enrollment.update({
      where: { id },
      data: dto,
      include: ENROLLMENT_INCLUDE,
    });

    // Convert DB entity to response DTO.
    return toEnrollmentResponse(updated);
  }

  async remove(
    id: string,
    organizationId: string,
  ): Promise<DeleteEnrollmentResponseDto> {
    const enrollment = await this.findOne(id, organizationId);

    const relatedAttendance = await this.database.attendance.count({
      where: { enrollment_id: id },
    });

    const relatedProgress = await this.database.progress.count({
      where: { enrollment_id: id },
    });

    await this.database.$transaction(async (tx) => {
      if (relatedAttendance > 0) {
        await tx.attendance.deleteMany({
          where: { enrollment_id: id },
        });
      }

      if (relatedProgress > 0) {
        await tx.progress.deleteMany({
          where: { enrollment_id: id },
        });
      }

      await tx.enrollment.delete({
        where: { id },
      });
    });

    return {
      message: `Enrollment deleted. ${relatedAttendance} attendance and ${relatedProgress} progress entries were also deleted.`,
      deletedId: enrollment.id,
    };
  }
}
