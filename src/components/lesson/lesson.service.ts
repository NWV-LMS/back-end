import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateLessonDto } from '../../libs/dto/lesson/create-lesson.dto';
import { UpdateLessonDto } from '../../libs/dto/lesson/update-lesson.dto';
import { QueryLessonDto } from '../../libs/dto/lesson/query-lesson.dto';
import { LessonResponseDto } from '../../libs/dto/lesson/lesson-response.dto';
import { RescheduleLessonDto } from '../../libs/dto/lesson/reschedule-lesson.dto';
import {
  EnrollmentActor,
  enrollmentAccessWhere,
} from '../enrollment/enrollment-access';
import { courseAccessWhere, lessonAccessWhere } from './lesson-access';
import { Prisma } from '@prisma/client';

@Injectable()
export class LessonService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    organizationId: string,
    dto: CreateLessonDto,
    actor: EnrollmentActor,
  ): Promise<LessonResponseDto> {
    const course = await this.database.course.findFirst({
      where: {
        id: dto.course_id,
        ...courseAccessWhere(organizationId, actor),
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const lesson = await this.database.lesson.create({
      data: {
        organization_id: organizationId,
        course_id: dto.course_id,
        title: dto.title,
        desc: dto.desc,
        start_date: dto.start_date,
        end_date: dto.end_date,
      },
    });

    return this.toResponse(lesson);
  }

  async findAll(
    organizationId: string,
    query: QueryLessonDto,
    actor: EnrollmentActor,
  ) {
    const { page = 1, limit = 10, course_id, from_date, to_date } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LessonWhereInput = lessonAccessWhere(
      organizationId,
      actor,
    );

    if (course_id) {
      where.course_id = course_id;
    }

    if (from_date || to_date) {
      where.start_date = {};
      if (from_date) where.start_date.gte = from_date;
      if (to_date) where.start_date.lte = to_date;
    }

    const [items, total] = await Promise.all([
      this.database.lesson.findMany({
        where,
        skip,
        take: limit,
        orderBy: { start_date: 'asc' },
      }),
      this.database.lesson.count({ where }),
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

  async findOne(
    id: string,
    organizationId: string,
    actor: EnrollmentActor,
  ): Promise<LessonResponseDto> {
    const lesson = await this.database.lesson.findFirst({
      where: {
        id,
        ...lessonAccessWhere(organizationId, actor),
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return this.toResponse(lesson);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateLessonDto,
    actor: EnrollmentActor,
  ): Promise<LessonResponseDto> {
    const current = await this.findOne(id, organizationId, actor);
    if (dto.course_id) {
      const course = await this.database.course.findFirst({
        where: {
          id: dto.course_id,
          ...courseAccessWhere(organizationId, actor),
        },
      });
      if (!course) throw new NotFoundException('Course not found');

      if (dto.course_id !== current.course_id) {
        const [attendance, progress] = await Promise.all([
          this.database.attendance.count({
            where: {
              lesson_id: id,
              enrollment: { group: { course_id: { not: dto.course_id } } },
            },
          }),
          this.database.progress.count({
            where: {
              lesson_id: id,
              enrollment: { group: { course_id: { not: dto.course_id } } },
            },
          }),
        ]);
        if (attendance || progress) {
          throw new BadRequestException(
            'Cannot move lesson to a different course with existing attendance or progress',
          );
        }
      }
    }

    const updated = await this.database.lesson.update({
      where: { id },
      data: {
        course_id: dto.course_id,
        title: dto.title,
        desc: dto.desc,
        start_date: dto.start_date,
        end_date: dto.end_date,
      },
    });

    return this.toResponse(updated);
  }

  async remove(
    id: string,
    organizationId: string,
    actor: EnrollmentActor,
  ): Promise<{ message: string }> {
    await this.findOne(id, organizationId, actor);

    await this.database.lesson.delete({
      where: { id },
    });

    return { message: 'Lesson deleted successfully' };
  }

  async reschedule(
    id: string,
    organizationId: string,
    dto: RescheduleLessonDto,
    actor: EnrollmentActor,
  ): Promise<LessonResponseDto> {
    await this.findOne(id, organizationId, actor);

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('start_date must be <= end_date');
    }

    await this.database.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id },
        data: {
          start_date: start,
          end_date: end,
        },
      });

      if (dto.resetAttendance) {
        await tx.attendance.deleteMany({
          where: {
            organization_id: organizationId,
            lesson_id: id,
            enrollment: enrollmentAccessWhere(organizationId, actor),
          },
        });
      }
    });

    return this.findOne(id, organizationId, actor);
  }

  private toResponse(lesson: any): LessonResponseDto {
    return {
      id: lesson.id,
      course_id: lesson.course_id,
      title: lesson.title,
      desc: lesson.desc,
      start_date: lesson.start_date,
      end_date: lesson.end_date,
    };
  }
}
