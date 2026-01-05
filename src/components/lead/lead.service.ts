import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateLeadDto } from 'src/libs/dto/lead/create-lead.dto';
import { UpdateLeadDto } from 'src/libs/dto/lead/update-lead.dto';
import { LeadResponseDto } from 'src/libs/dto/lead/lead-response.dto';
import { LeadStatus } from 'generated/prisma/enums';

@Injectable()
export class LeadService {
  constructor(private readonly database: DatabaseService) {}

  async create(createLeadDto: CreateLeadDto, organizationId: string): Promise<LeadResponseDto> {
    // 1. Check if phone exists in Users (Global uniqueness for login)
    const existingUser = await this.database.user.findUnique({
      where: { phone: createLeadDto.phone },
    });
    if (existingUser) {
      throw new BadRequestException('User with this phone already exists');
    }

    // 2. Check if phone exists in Leads within this organization
    const existingLead = await this.database.lead.findFirst({
      where: { 
        phone: createLeadDto.phone,
        organization_id: organizationId 
      },
    });
    if (existingLead) {
      throw new BadRequestException('Lead with this phone already exists in your organization');
    }

    return this.database.lead.create({
      data: {
        ...createLeadDto,
        status: createLeadDto.status || LeadStatus.NEW,
        organization_id: organizationId,
      },
    });
  }

  async findAll(organizationId: string): Promise<LeadResponseDto[]> {
    return this.database.lead.findMany({
      where: { organization_id: organizationId },
      orderBy: { status: 'asc' }, // Prioritize NEW leads
    });
  }

  async findOne(id: string, organizationId: string): Promise<LeadResponseDto> {
    const lead = await this.database.lead.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async update(
    id: string,
    updateLeadDto: UpdateLeadDto,
    organizationId: string,
  ): Promise<LeadResponseDto> {
    // Check existence and ownership
    await this.findOne(id, organizationId);

    return this.database.lead.update({
      where: { id },
      data: updateLeadDto,
    });
  }

  async remove(id: string, organizationId: string): Promise<LeadResponseDto> {
    await this.findOne(id, organizationId);

    return this.database.lead.delete({
      where: { id },
    });
  }
}
