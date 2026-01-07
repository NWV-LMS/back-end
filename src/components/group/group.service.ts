import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto } from 'src/libs/dto/group/create-group.dto';
import { GroupResponseDto } from 'src/libs/dto/group/group-response.dto';
import { UpdateGroupDto } from 'src/libs/dto/group/update-group.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class GroupService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateGroupDto,
    organizationId: string,
  ): Promise<GroupResponseDto> {
    // 1. Validate Course exists and belongs to Org
    const course = await this.database.course.findFirst({
      where: { id: dto.course_id, organization_id: organizationId },
    });
    if (!course) {
      throw new NotFoundException('Course not found or invalid');
    }

    // 2. Validate Teacher exists and belongs to Org
    const teacher = await this.database.user.findFirst({
      where: { id: dto.teacher_id, organization_id: organizationId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found or invalid');
    }

    // 3. Create Group
    const group = await this.database.group.create({
      data: {
        organization_id: organizationId,
        course_id: dto.course_id,
        teacher_id: dto.teacher_id,
        name: dto.name,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
      },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });

    return group as unknown as GroupResponseDto;
  }

  async findAll(organizationId: string): Promise<GroupResponseDto[]> {
    const groups = await this.database.group.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });
    return groups as unknown as GroupResponseDto[];
  }

  async findOne(id: string, organizationId: string): Promise<GroupResponseDto> {
    const group = await this.database.group.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group as unknown as GroupResponseDto;
  }

  async update(
    id: string,
    dto: UpdateGroupDto,
    organizationId: string,
  ): Promise<GroupResponseDto> {
    await this.findOne(id, organizationId);

    // Optional: Validate course/teacher if they are being updated
    if (dto.course_id) {
        const course = await this.database.course.findFirst({
            where: { id: dto.course_id, organization_id: organizationId },
        });
        if (!course) throw new NotFoundException('Course not found');
    }

    if (dto.teacher_id) {
        const teacher = await this.database.user.findFirst({
            where: { id: dto.teacher_id, organization_id: organizationId },
        });
        if (!teacher) throw new NotFoundException('Teacher not found');
    }

    const updated = await this.database.group.update({
      where: { id },
      data: {
        ...dto,
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
      },
      include: {
        course: { select: { id: true, title: true } },
        teacher: { select: { id: true, full_name: true } },
      },
    });

    return updated as unknown as GroupResponseDto;
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);

    // Check for enrollments before deleting
    const enrollments = await this.database.enrollment.findFirst({
        where: { group_id: id },
    });

    if (enrollments) {
        throw new BadRequestException('Cannot delete group with existing enrollments');
    }

    await this.database.group.delete({
      where: { id },
    });
  }
}
