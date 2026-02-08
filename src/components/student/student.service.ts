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
import { StudentStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { toStudentResponse } from '../../libs/mappers/student.mapper';
import { toUserInfo } from '../../libs/mappers/user.mapper';
import { toEnrollmentResponse } from '../../libs/mappers/enrollment.mapper';

@Injectable()
export class StudentService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    organizationId: string,
    dto: CreateStudentDto,
  ): Promise<CreateStudentResponseDto> {
    // 1. Check if user exists globally by phone
    let user = await this.database.user.findFirst({
      where: { phone: dto.phone },
    });

    // 2. Check if student exists in this organization
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

    let temporaryPassword = null;

    // 3. Create everything in transaction
    const [newStudent, updatedUser] = await this.database.$transaction(
      async (tx) => {
        // Create user if not exists
        if (!user) {
          temporaryPassword =
            dto.password || Math.random().toString(36).slice(-8);
          const uniqueEmail = `${dto.phone.replace('+', '')}@system.local`;

          user = await tx.user.create({
            data: {
              organization_id: organizationId,
              full_name: dto.name,
              phone: dto.phone,
              email: uniqueEmail, // Pseudo email
              password: await bcrypt.hash(temporaryPassword, 10),
              role: UserRole.STUDENT,
            },
          });
        }

        // Create student
        const student = await tx.student.create({
          data: {
            organization_id: organizationId,
            name: dto.name,
            phone: dto.phone,
            address: dto.address,
            parent: dto.parent,
            status: dto.status || StudentStatus.ACTIVE,
          },
        });

        return [student, user];
      },
    );

    return {
      message: 'Student created successfully',
      // Always return API-safe DTOs, not raw DB entities.
      student: toStudentResponse(newStudent),
      user: toUserInfo(updatedUser),
      temporaryPassword,
    };
  }

  async findAll(
    organizationId: string,
    query: QueryStudentDto,
  ): Promise<PaginatedStudentResponseDto> {
    const { page, limit, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      organization_id: organizationId,
    };

    if (status) {
      where.status = status;
    }

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

    await this.database.student.delete({
      where: { id },
    });

    return { message: 'Student deleted successfully' };
  }

  async enroll(
    studentId: string,
    dto: EnrollStudentDto,
    organizationId: string,
  ): Promise<any> {
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
            name: true,
          },
        },
      },
    });
    // Convert DB entity to response DTO.
    return toEnrollmentResponse(enrollment as any);
  }
}
