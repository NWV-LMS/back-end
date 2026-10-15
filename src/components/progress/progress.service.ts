import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { CreateProgressDto } from '../../libs/dto/progress/create-progress.dto';
import { UpdateProgressDto } from '../../libs/dto/progress/update-progress.dto';
import { QueryProgressDto } from '../../libs/dto/progress/query-progress.dto';
import { ProgressResponseDto } from '../../libs/dto/progress/progress-response.dto';
import { toProgressResponse } from '../../libs/mappers/progress.mapper';
import {
  EnrollmentActor,
  enrollmentAccessWhere,
} from '../enrollment/enrollment-access';
import { lessonTenantWhere } from '../lesson/lesson-access';

@Injectable()
export class ProgressService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateProgressDto,
    organizationId: string,
    actor: EnrollmentActor,
  ): Promise<ProgressResponseDto> {
    await this.validateReferences(
      organizationId,
      actor,
      dto.enrollment_id,
      dto.lesson_id,
    );

    const progress = await this.database.progress.create({
      data: {
        organization_id: organizationId,
        enrollment_id: dto.enrollment_id,
        lesson_id: dto.lesson_id,
        completed: dto.completed,
        title: dto.title,
      },
      include: {
        enrollment: { select: { id: true, student_id: true, group_id: true } },
        lesson: { select: { id: true, title: true, course_id: true } },
      },
    });

    return toProgressResponse(progress);
  }

  async findAll(
    organizationId: string,
    query: QueryProgressDto,
    actor: EnrollmentActor,
  ) {
    const { page = 1, limit = 20, enrollment_id, lesson_id, completed } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProgressWhereInput = this.accessWhere(
      organizationId,
      actor,
    );

    if (enrollment_id) {
      where.enrollment_id = enrollment_id;
    }
    if (lesson_id) {
      where.lesson_id = lesson_id;
    }
    if (completed !== undefined) {
      where.completed = completed;
    }

    const [data, total] = await Promise.all([
      this.database.progress.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          enrollment: {
            select: { id: true, student_id: true, group_id: true },
          },
          lesson: { select: { id: true, title: true, course_id: true } },
        },
      }),
      this.database.progress.count({ where }),
    ]);

    return {
      data: data.map(toProgressResponse),
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
    actor: EnrollmentActor,
  ): Promise<ProgressResponseDto> {
    const progress = await this.database.progress.findFirst({
      where: { id, ...this.accessWhere(organizationId, actor) },
      include: {
        enrollment: { select: { id: true, student_id: true, group_id: true } },
        lesson: { select: { id: true, title: true, course_id: true } },
      },
    });

    if (!progress) {
      throw new NotFoundException('Progress not found');
    }

    return toProgressResponse(progress);
  }

  async update(
    id: string,
    dto: UpdateProgressDto,
    organizationId: string,
    actor: EnrollmentActor,
  ): Promise<ProgressResponseDto> {
    const current = await this.findOne(id, organizationId, actor);
    await this.validateReferences(
      organizationId,
      actor,
      dto.enrollment_id ?? current.enrollment_id,
      dto.lesson_id ?? current.lesson_id,
    );

    const progress = await this.database.progress.update({
      where: { id },
      data: {
        enrollment_id: dto.enrollment_id,
        lesson_id: dto.lesson_id,
        completed: dto.completed,
        title: dto.title,
      },
      include: {
        enrollment: { select: { id: true, student_id: true, group_id: true } },
        lesson: { select: { id: true, title: true, course_id: true } },
      },
    });

    return toProgressResponse(progress);
  }

  async remove(
    id: string,
    organizationId: string,
    actor: EnrollmentActor,
  ): Promise<void> {
    await this.findOne(id, organizationId, actor);

    await this.database.progress.delete({
      where: { id },
    });
  }

  async getStudentProgress(
    studentId: string,
    organizationId: string,
    actor: EnrollmentActor,
  ) {
    if (actor.role === UserRole.STUDENT) {
      const student = await this.database.student.findFirst({
        where: {
          id: studentId,
          organization_id: organizationId,
          user_id: actor.sub,
        },
      });
      if (!student) throw new NotFoundException('Student not found');
    }
    // Get all enrollments for the student
    const enrollments = await this.database.enrollment.findMany({
      where: {
        student_id: studentId,
        ...enrollmentAccessWhere(organizationId, actor),
      },
      select: { id: true },
    });

    if (enrollments.length === 0) {
      return { data: [], summary: { total: 0, completed: 0, percentage: 0 } };
    }

    const enrollmentIds = enrollments.map((e) => e.id);

    const progress = await this.database.progress.findMany({
      where: {
        ...this.accessWhere(organizationId, actor),
        enrollment_id: { in: enrollmentIds },
      },
      include: {
        enrollment: {
          select: {
            id: true,
            student_id: true,
            group_id: true,
            group: { select: { name: true } },
          },
        },
        lesson: { select: { id: true, title: true, course_id: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const total = progress.length;
    const completed = progress.filter((p) => p.completed).length;

    return {
      data: progress.map(toProgressResponse),
      summary: {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    };
  }

  private accessWhere(
    organizationId: string,
    actor: EnrollmentActor,
  ): Prisma.ProgressWhereInput {
    return {
      organization_id: organizationId,
      enrollment: enrollmentAccessWhere(organizationId, actor),
      lesson: lessonTenantWhere(organizationId),
    };
  }

  private async validateReferences(
    organizationId: string,
    actor: EnrollmentActor,
    enrollmentId: string,
    lessonId: string,
  ) {
    const enrollment = await this.database.enrollment.findFirst({
      where: {
        id: enrollmentId,
        ...enrollmentAccessWhere(organizationId, actor),
      },
      include: { group: { select: { course_id: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const lesson = await this.database.lesson.findFirst({
      where: { id: lessonId, ...lessonTenantWhere(organizationId) },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.course_id !== enrollment.group.course_id) {
      throw new BadRequestException(
        'Lesson must belong to the enrollment course',
      );
    }
  }
}
