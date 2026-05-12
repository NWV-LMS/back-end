import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateStudentDto } from '../../libs/dto/student/create-student.dto';
import { EnrollStudentDto } from '../../libs/dto/student/enroll-student.dto';
import { UpdateStudentDto } from '../../libs/dto/student/update-student.dto';
import { QueryStudentDto } from '../../libs/dto/student/query-student.dto';
import { StudentResponseDto } from '../../libs/dto/student/student-response.dto';
import { CreateStudentResponseDto } from '../../libs/dto/student/create-student-response.dto';
import { PaginatedStudentResponseDto } from '../../libs/dto/student/paginated-student-response.dto';
import { Prisma, StudentStatus } from '@prisma/client';
import { EnrollmentResponseDto } from '../../libs/dto/enrollment/enrollment-response.dto';
import { toStudentResponse } from '../../libs/mappers/student.mapper';
import { toEnrollmentResponse } from '../../libs/mappers/enrollment.mapper';

@Injectable()
export class StudentService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    organizationId: string,
    dto: CreateStudentDto,
  ): Promise<CreateStudentResponseDto> {
    const existingStudent = await this.database.student.findFirst({
      where: {
        phone: dto.phone,
        organization_id: organizationId,
      },
    });

    if (existingStudent) {
      throw new BadRequestException(
        'Student with this phone already exists in this organization',
      );
    }

    const studentData: Prisma.StudentUncheckedCreateInput = {
      organization_id: organizationId,
      name: dto.name,
      phone: dto.phone,
      address: dto.address ?? null,
      parent: dto.parent,
      status: dto.status || StudentStatus.ACTIVE,
    };

    const student = await this.database.student.create({ data: studentData });

    return {
      message: 'Student created successfully',
      student: toStudentResponse(student),
    };
  }

  async findAll(
    organizationId: string,
    query: QueryStudentDto,
  ): Promise<PaginatedStudentResponseDto> {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    if (status === StudentStatus.DELETED) {
      throw new BadRequestException(
        'Use /student/deleted endpoint to view deleted students',
      );
    }

    const where: Prisma.StudentWhereInput = {
      organization_id: organizationId,
      status: status ?? { not: StudentStatus.DELETED },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.database.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.database.student.count({ where }),
    ]);

    return {
      // Map DB entities to DTOs to keep API contract stable.
      items: items.map(toStudentResponse),
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
  ): Promise<StudentResponseDto> {
    const student = await this.database.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
        status: { not: StudentStatus.DELETED },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Convert DB entity to response DTO.
    return toStudentResponse(student);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateStudentDto,
  ): Promise<StudentResponseDto> {
    await this.findOne(id, organizationId);

    const updated = await this.database.student.update({
      where: { id },
      data: dto,
    });

    // Convert DB entity to response DTO.
    return toStudentResponse(updated);
  }

  async remove(
    id: string,
    organizationId: string,
  ): Promise<{ message: string }> {
    await this.findOne(id, organizationId);

    await this.database.student.update({
      where: { id },
      data: {
        status: StudentStatus.DELETED,
        deleted_at: new Date(),
      },
    });

    return { message: 'Student deleted successfully' };
  }

  async enroll(
    studentId: string,
    dto: EnrollStudentDto,
    organizationId: string,
  ): Promise<EnrollmentResponseDto> {
    await this.findOne(studentId, organizationId);

    const group = await this.database.group.findFirst({
      where: {
        id: dto.group_id,
        organization_id: organizationId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found in this organization');
    }

    const existingEnrollment = await this.database.enrollment.findFirst({
      where: {
        student_id: studentId,
        group_id: dto.group_id,
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException(
        'Student is already enrolled in this group',
      );
    }

    const enrollment = await this.database.enrollment.create({
      data: {
        organization_id: organizationId,
        student_id: studentId,
        group_id: dto.group_id,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    // Convert DB entity to response DTO.
    return toEnrollmentResponse(enrollment);
  }

  async bulkCreate(
    organizationId: string,
    students: CreateStudentDto[],
  ): Promise<{ created: number; skipped: number; failed: RowError[] }> {
    const CHUNK_SIZE = 100;
    let created = 0;
    let skipped = 0;
    const failed: RowError[] = [];

    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);

      await this.database.$transaction(async (tx) => {
        for (const dto of chunk) {
          try {
            const existingStudent = await tx.student.findFirst({
              where: { phone: dto.phone, organization_id: organizationId },
            });

            if (existingStudent) {
              skipped++;
              continue;
            }

            await tx.student.create({
              data: {
                organization_id: organizationId,
                name: dto.name,
                phone: dto.phone,
                address: dto.address ?? null,
                parent: dto.parent,
                status: dto.status || StudentStatus.ACTIVE,
              },
            });

            created++;
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : 'Unknown error';
            failed.push({ row: dto.phone, reason: message });
          }
        }
      });
    }

    return { created, skipped, failed };
  }

  async getStatistics(organizationId: string) {
    const [total, active, inactive, deleted, enrollmentCount] =
      await Promise.all([
        this.database.student.count({
          where: {
            organization_id: organizationId,
            status: { not: StudentStatus.DELETED },
          },
        }),
        this.database.student.count({
          where: {
            organization_id: organizationId,
            status: StudentStatus.ACTIVE,
          },
        }),
        this.database.student.count({
          where: {
            organization_id: organizationId,
            status: StudentStatus.INACTIVE,
          },
        }),
        this.database.student.count({
          where: {
            organization_id: organizationId,
            status: StudentStatus.DELETED,
          },
        }),
        this.database.enrollment.count({
          where: { organization_id: organizationId },
        }),
      ]);

    return {
      total,
      active,
      inactive,
      deleted,
      enrollmentCount,
    };
  }

  async findDeleted(
    organizationId: string,
    query: QueryStudentDto,
  ): Promise<PaginatedStudentResponseDto> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      organization_id: organizationId,
      status: StudentStatus.DELETED,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.database.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deleted_at: 'desc' },
      }),
      this.database.student.count({ where }),
    ]);

    return {
      items: items.map(toStudentResponse),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentDetail(id: string, organizationId: string) {
    const student = await this.database.student.findFirst({
      where: {
        id,
        organization_id: organizationId,
        status: { not: StudentStatus.DELETED },
      },
      include: {
        enrollments: {
          include: {
            group: {
              include: {
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
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return {
      ...toStudentResponse(student),
      enrollments: student.enrollments.map((enrollment) => ({
        id: enrollment.id,
        group_id: enrollment.group_id,
        enrolled_at: enrollment.enrolled_at,
        group: {
          id: enrollment.group.id,
          name: enrollment.group.name,
          course: enrollment.group.course
            ? {
                id: enrollment.group.course.id,
                title: enrollment.group.course.title,
              }
            : null,
          teacher: enrollment.group.teacher
            ? {
                id: enrollment.group.teacher.id,
                full_name: enrollment.group.teacher.full_name,
              }
            : null,
        },
      })),
    };
  }
}

interface RowError {
  row: string;
  reason: string;
}
