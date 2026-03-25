import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateProgressDto } from '../../libs/dto/progress/create-progress.dto';
import { UpdateProgressDto } from '../../libs/dto/progress/update-progress.dto';
import { QueryProgressDto } from '../../libs/dto/progress/query-progress.dto';
import { ProgressResponseDto } from '../../libs/dto/progress/progress-response.dto';
import { toProgressResponse } from '../../libs/mappers/progress.mapper';

@Injectable()
export class ProgressService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateProgressDto,
    organizationId: string,
  ): Promise<ProgressResponseDto> {
    // Validate enrollment exists and belongs to organization
    const enrollment = await this.database.enrollment.findFirst({
      where: { id: dto.enrollment_id, organization_id: organizationId },
    });
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Validate lesson exists
    const lesson = await this.database.lesson.findUnique({
      where: { id: dto.lesson_id },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

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

  async findAll(organizationId: string, query: QueryProgressDto) {
    const { page = 1, limit = 20, enrollment_id, lesson_id, completed } = query;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };

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
  ): Promise<ProgressResponseDto> {
    const progress = await this.database.progress.findFirst({
      where: { id, organization_id: organizationId },
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
  ): Promise<ProgressResponseDto> {
    await this.findOne(id, organizationId);

    const progress = await this.database.progress.update({
      where: { id },
      data: dto,
      include: {
        enrollment: { select: { id: true, student_id: true, group_id: true } },
        lesson: { select: { id: true, title: true, course_id: true } },
      },
    });

    return toProgressResponse(progress);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);

    await this.database.progress.delete({
      where: { id },
    });
  }

  async getStudentProgress(studentId: string, organizationId: string) {
    // Get all enrollments for the student
    const enrollments = await this.database.enrollment.findMany({
      where: { student_id: studentId, organization_id: organizationId },
      select: { id: true },
    });

    if (enrollments.length === 0) {
      return { data: [], summary: { total: 0, completed: 0, percentage: 0 } };
    }

    const enrollmentIds = enrollments.map((e) => e.id);

    const progress = await this.database.progress.findMany({
      where: {
        organization_id: organizationId,
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
}
