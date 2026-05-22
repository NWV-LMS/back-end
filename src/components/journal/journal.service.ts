import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { CreateJournalEntryDto } from '../../libs/dto/journal/create-journal-entry.dto';
import { QueryJournalDto } from '../../libs/dto/journal/query-journal.dto';
import {
  JournalEntryResponseDto,
  JournalListResponseDto,
} from '../../libs/dto/journal/journal-entry-response.dto';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: DatabaseService) {}

  async upsertEntries(
    organizationId: string,
    userId: string,
    userRole: UserRole,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntryResponseDto[]> {
    const group = await this.prisma.group.findFirst({
      where: { id: dto.group_id, organization_id: organizationId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (userRole === UserRole.TEACHER && group.teacher_id !== userId) {
      throw new ForbiddenException(
        'You can only add journal entries for your own groups',
      );
    }

    const teacherId = userRole === UserRole.TEACHER ? userId : group.teacher_id;
    const date = new Date(dto.date);

    const results = await this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.journalEntry.upsert({
          where: {
            group_id_student_id_date: {
              group_id: dto.group_id,
              student_id: entry.student_id,
              date,
            },
          },
          create: {
            organization_id: organizationId,
            group_id: dto.group_id,
            student_id: entry.student_id,
            teacher_id: teacherId,
            date,
            status: entry.status,
            score: entry.score ?? null,
            notes: entry.notes ?? null,
          },
          update: {
            status: entry.status,
            score: entry.score ?? null,
            notes: entry.notes ?? null,
          },
          include: { student: { select: { name: true } } },
        }),
      ),
    );

    return results.map(this.toResponse);
  }

  async findAll(
    organizationId: string,
    userId: string,
    userRole: UserRole,
    query: QueryJournalDto,
  ): Promise<JournalListResponseDto> {
    const {
      page = 1,
      limit = 50,
      group_id,
      teacher_id,
      student_id,
      date,
      date_from,
      date_to,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organization_id: organizationId };

    if (userRole === UserRole.TEACHER) {
      where['teacher_id'] = userId;
    } else if (teacher_id) {
      where['teacher_id'] = teacher_id;
    }

    if (group_id) where['group_id'] = group_id;
    if (student_id) where['student_id'] = student_id;
    if (status) where['status'] = status;

    if (date) {
      where['date'] = new Date(date);
    } else if (date_from || date_to) {
      const dateFilter: Record<string, Date> = {};
      if (date_from) dateFilter['gte'] = new Date(date_from);
      if (date_to) dateFilter['lte'] = new Date(date_to);
      where['date'] = dateFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        include: { student: { select: { name: true } } },
      }),
      this.prisma.journalEntry.count({ where }),
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

  async findByGroup(
    organizationId: string,
    userId: string,
    userRole: UserRole,
    groupId: string,
    query: QueryJournalDto,
  ): Promise<JournalListResponseDto> {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, organization_id: organizationId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (userRole === UserRole.TEACHER && group.teacher_id !== userId) {
      throw new ForbiddenException(
        'You can only view journal for your own groups',
      );
    }

    return this.findAll(organizationId, userId, userRole, {
      ...query,
      group_id: groupId,
    });
  }

  async findByTeacher(
    organizationId: string,
    teacherId: string,
    query: QueryJournalDto,
  ): Promise<JournalListResponseDto> {
    const teacher = await this.prisma.user.findFirst({
      where: {
        id: teacherId,
        organization_id: organizationId,
        role: UserRole.TEACHER,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return this.findAll(organizationId, teacherId, UserRole.MANAGER, {
      ...query,
      teacher_id: teacherId,
    });
  }

  private toResponse(entry: {
    id: string;
    organization_id: string;
    group_id: string;
    student_id: string;
    teacher_id: string;
    date: Date;
    status: import('@prisma/client').JournalStatus;
    score: number | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
    student?: { name: string } | null;
  }): JournalEntryResponseDto {
    return {
      id: entry.id,
      organization_id: entry.organization_id,
      group_id: entry.group_id,
      student_id: entry.student_id,
      teacher_id: entry.teacher_id,
      date: entry.date,
      status: entry.status,
      score: entry.score,
      notes: entry.notes,
      student_name: entry.student?.name,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }
}
