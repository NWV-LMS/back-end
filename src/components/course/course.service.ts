import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourseStatus } from 'generated/prisma/enums';
import { CourseResponseDto } from 'src/libs/dto/course/course-response.dto';
import { CreateCourseDto } from 'src/libs/dto/course/create-course.dto';
import { UpdateCourseDto } from 'src/libs/dto/course/update-course.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CourseService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateCourseDto,
    organizationId: string,
  ): Promise<CourseResponseDto> {
    return this.database.course.create({
      data: {
        ...dto,
        organization_id: organizationId,
        status: dto.status || CourseStatus.ACTIVE,
      },
    });
  }

  async findAll(organizationId: string): Promise<CourseResponseDto[]> {
    return this.database.course.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<CourseResponseDto> {
    const course = await this.database.course.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  async update(
    id: string,
    dto: UpdateCourseDto,
    organizationId: string,
  ): Promise<CourseResponseDto> {
    await this.findOne(id, organizationId);

    return this.database.course.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);
    
    // Check if course has groups before deleting
    const groups = await this.database.group.findFirst({
      where: { course_id: id },
    });

    if (groups) {
      throw new BadRequestException('Cannot delete course with existing groups');
    }

    await this.database.course.delete({
      where: { id },
    });
  }
}
