import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateLessonDto } from '../../libs/dto/lesson/create-lesson.dto';
import { UpdateLessonDto } from '../../libs/dto/lesson/update-lesson.dto';
import { QueryLessonDto } from '../../libs/dto/lesson/query-lesson.dto';
import { LessonResponseDto } from '../../libs/dto/lesson/lesson-response.dto';
import { RescheduleLessonDto } from '../../libs/dto/lesson/reschedule-lesson.dto';

@Injectable()
export class LessonService {
  constructor(private readonly database: DatabaseService) {}

  async create(organizationId: string, dto: CreateLessonDto): Promise<LessonResponseDto> {
    const course = await this.database.course.findFirst({
      where: {
        id: dto.course_id,
        organization_id: organizationId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const lesson = await this.database.lesson.create({
      data: {
        course_id: dto.course_id,
        title: dto.title,
        desc: dto.desc,
        start_date: dto.start_date,
        end_date: dto.end_date,
      },
    });

    return this.toResponse(lesson);
  }

  async findAll(organizationId: string, query: QueryLessonDto) {
    const { page, limit, course_id, from_date, to_date } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      course: {
        organization_id: organizationId,
      },
    };

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

  async findOne(id: string, organizationId: string): Promise<LessonResponseDto> {
    const lesson = await this.database.lesson.findFirst({
      where: {
        id,
        course: {
          organization_id: organizationId,
        },
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
  ): Promise<LessonResponseDto> {
    await this.findOne(id, organizationId);

    const updated = await this.database.lesson.update({
      where: { id },
      data: dto,
    });

    return this.toResponse(updated);
  }

  async remove(id: string, organizationId: string): Promise<{ message: string }> {
    await this.findOne(id, organizationId);

    await this.database.lesson.delete({
      where: { id },
    });

    return { message: 'Lesson deleted successfully' };
  }

  async reschedule(
    id: string,
    organizationId: string,
    dto: RescheduleLessonDto,
  ): Promise<LessonResponseDto> {
    await this.findOne(id, organizationId);

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('start_date must be <= end_date');
    }

    await this.database.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id },
        data: {
          start_date: dto.start_date as any,
          end_date: dto.end_date as any,
        },
      });

      if (dto.resetAttendance) {
        await tx.attendance.deleteMany({
          where: { organization_id: organizationId, lesson_id: id },
        });
      }
    });

    return this.findOne(id, organizationId);
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
