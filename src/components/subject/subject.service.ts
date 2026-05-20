import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSubjectDto } from '../../libs/dto/subject/create-subject.dto';
import { UpdateSubjectDto } from '../../libs/dto/subject/update-subject.dto';
import { SubjectResponseDto } from '../../libs/dto/subject/subject-response.dto';

@Injectable()
export class SubjectService {
  constructor(private readonly database: DatabaseService) {}

  async create(dto: CreateSubjectDto, organizationId: string): Promise<SubjectResponseDto> {
    const existing = await this.database.subject.findFirst({
      where: { organization_id: organizationId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Subject with this name already exists');

    return this.database.subject.create({
      data: { name: dto.name, organization_id: organizationId },
    });
  }

  async findAll(organizationId: string): Promise<SubjectResponseDto[]> {
    return this.database.subject.findMany({
      where: { organization_id: organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string): Promise<SubjectResponseDto> {
    const subject = await this.database.subject.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto, organizationId: string): Promise<SubjectResponseDto> {
    await this.findOne(id, organizationId);
    return this.database.subject.update({ where: { id }, data: dto });
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.findOne(id, organizationId);
    await this.database.subject.delete({ where: { id } });
  }
}
