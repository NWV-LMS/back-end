import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus } from '@prisma/client';
import { CourseResponseDto } from '../../libs/dto/course/course-response.dto';
import { CreateCourseDto } from '../../libs/dto/course/create-course.dto';
import { UpdateCourseDto } from '../../libs/dto/course/update-course.dto';
import { toCourseResponse } from '../../libs/mappers/course.mapper';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CourseService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateCourseDto,
    organizationId: string,
  ): Promise<CourseResponseDto> {
    const course = await this.database.course.create({
      data: {
        ...dto,
        organization_id: organizationId,
        status: dto.status || CourseStatus.ACTIVE,
      },
    });
    // Always return API-safe DTO, not raw DB entity.
    return toCourseResponse(course);
  }

  async findAll(organizationId: string): Promise<CourseResponseDto[]> {
    const courses = await this.database.course.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
    // Map DB entities to DTOs to keep API contract stable.
    return courses.map(toCourseResponse);
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<CourseResponseDto> {
    const course = await this.database.course.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Convert DB entity to response DTO.
    return toCourseResponse(course);
  }

  async update(
    id: string,
    dto: UpdateCourseDto,
    organizationId: string,
  ): Promise<CourseResponseDto> {
    await this.findOne(id, organizationId);

    const course = await this.database.course.update({
      where: { id },
      data: dto,
    });
    // Convert DB entity to response DTO.
    return toCourseResponse(course);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);

    // Check if course has groups before deleting
    const groups = await this.database.group.findFirst({
      where: { course_id: id },
    });

    if (groups) {
      throw new BadRequestException(
        'Cannot delete course with existing groups',
      );
    }

    await this.database.course.delete({
      where: { id },
    });
  }
}
