import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateLeadDto } from '../../libs/dto/lead/create-lead.dto';
import { UpdateLeadDto } from '../../libs/dto/lead/update-lead.dto';
import { LeadResponseDto } from '../../libs/dto/lead/lead-response.dto';
import { LeadStatus } from '@prisma/client';
import { UserRole, StudentStatus } from '@prisma/client';
import { QueryLeadDto } from '../../libs/dto/lead/query-lead.dto';
import { ConvertLeadDto } from '../../libs/dto/lead/convert-lead.dto';
import { toLeadResponse } from '../../libs/mappers/lead.mapper';

import * as bcrypt from 'bcrypt';

@Injectable()
export class LeadService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    createLeadDto: CreateLeadDto,
    organizationId: string,
  ): Promise<LeadResponseDto> {
    const existingUser = await this.database.user.findUnique({
      where: { phone: createLeadDto.phone },
    });
    if (existingUser) {
      throw new BadRequestException('User with this phone already exists');
    }

    const existingLead = await this.database.lead.findFirst({
      where: {
        phone: createLeadDto.phone,
        organization_id: organizationId,
      },
    });
    if (existingLead) {
      throw new BadRequestException(
        'Lead with this phone already exists in your organization',
      );
    }

    const lead = await this.database.lead.create({
      data: {
        ...createLeadDto,
        status: createLeadDto.status || LeadStatus.NEW,
        organization_id: organizationId,
      },
    });
    // Always return API-safe DTO, not raw DB entity.
    return toLeadResponse(lead);
  }

  async findAll(organizationId: string, query: QueryLeadDto) {
    const { page = 1, limit = 20, search, status, source } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      organization_id: organizationId,
    };

    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = { contains: source, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.database.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { status: 'asc' },
      }),
      this.database.lead.count({ where }),
    ]);

    return {
      // Map DB entities to DTOs to keep API contract stable.
      data: data.map(toLeadResponse),
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string): Promise<LeadResponseDto> {
    const lead = await this.database.lead.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Convert DB entity to response DTO.
    return toLeadResponse(lead);
  }

  async update(
    id: string,
    updateLeadDto: UpdateLeadDto,
    organizationId: string,
  ): Promise<LeadResponseDto> {
    await this.findOne(id, organizationId);

    const lead = await this.database.lead.update({
      where: { id },
      data: updateLeadDto, // TODO: Contacted ishlatish mumkin 
    });
    // Convert DB entity to response DTO.
    return toLeadResponse(lead);
  }

  async remove(id: string, organizationId: string): Promise<LeadResponseDto> {
    await this.findOne(id, organizationId);

    const lead = await this.database.lead.delete({
      where: { id },
    });
    // Convert DB entity to response DTO.
    return toLeadResponse(lead);
  }

  async convert(id: string, dto: ConvertLeadDto, organizationId: string) {
    const lead = await this.findOne(id, organizationId);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Lead is already converted');
    }

    let user = await this.database.user.findUnique({
      where: { phone: lead.phone },
    });

    let temporaryPassword;

    if (!user) {
      const password = dto.password ?? '123456';
      const hashedPassword = await bcrypt.hash(password, 10);

      user = await this.database.user.create({
        data: {
          organization_id: organizationId,
          full_name: lead.full_name,
          email: `${lead.phone}@system.local`,
          phone: lead.phone,
          password: hashedPassword,
          role: UserRole.STUDENT,
        },
      });
      temporaryPassword = password;
    }

    const existingStudent = await this.database.student.findFirst({
      where: {
        phone: lead.phone,
        organization_id: organizationId,
      },
    });

    if (existingStudent) {
      throw new BadRequestException(
        'Student with this phone already exists in this organization',
      );
    }

    const [, newStudent] = await this.database.$transaction([
      this.database.lead.update({
        where: { id },
        data: { status: LeadStatus.CONVERTED },
      }),
      this.database.student.create({
        data: {
          organization_id: organizationId,
          name: lead.full_name,
          address: dto.address,
          phone: lead.phone,
          parent: dto.parent,
          status: StudentStatus.ACTIVE,
        },
      }),
    ]);

    return {
      message: 'Lead converted successfully',
      student: newStudent,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      temporaryPassword,
    };
  }

}
