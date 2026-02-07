import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OrganizationStatus } from 'generated/prisma/enums';
import { CreateOrganizationDto } from '../../libs/dto/organization/create-organization.dto';
import { UpdateOrganizationDto } from '../../libs/dto/organization/update-organization.dto';
import { Organ } from '../../libs/dto/organization/organization-response.dto';
import { QueryOrganizationDto } from '../../libs/dto/organization/query-organization.dto';
import {
  PaginatedOrganizationResponseDto,
  PlatformOrganizationDto,
} from '../../libs/dto/organization/platform-organization.dto';
import { UpdateOrganizationStatusDto } from '../../libs/dto/organization/update-organization-status.dto';
import { Message } from '../../libs/enums/common.enums';
import { toPlatformOrganization } from '../../libs/mappers/organization.mapper';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly database: DatabaseService) {}

  public async register(input: CreateOrganizationDto): Promise<Organ> {
    const existingOrg = await this.database.organization.findUnique({
      where: { name: input.Org_name },
    });

    if (existingOrg) {
      throw new BadRequestException('Organization already exists');
    }

    const existingAdmin = await this.database.user.findFirst({
      where: { email: input.adminEmail },
    });

    if (existingAdmin) {
      throw new BadRequestException('Admin email already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    try {
      const result = await this.database.$transaction(async (tx) => {
        console.log('*** Transaction started ***');
        const organization = await tx.organization.create({
          data: {
            name: input.Org_name,
            email: input.Org_email,
            phone: input.phone,
            status: OrganizationStatus.ACTIVE,
          },
        });
        console.log('result', organization);

        const admin = await tx.user.create({
          data: {
            organization_id: organization.id,
            full_name: input.adminName,
            email: input.adminEmail,
            phone: input.phone,
            password: hashedPassword,
            role: input.adminRole,
          },
        });

        return { organization, admin };
      });
      console.log('*** Transaction committed ***');
      return {
        organization_id: result.organization.id,
        Org_name: result.organization.name,
        Org_status: result.organization.status,
        Org_email: result.organization.email,
        id: result.admin.id,
        adminEmail: result.admin.email,
        adminName: result.admin.full_name,
        phone: result.admin.phone,
        adminRole: result.admin.role,
        created_at: result.organization.created_at,
      };
    } catch (error) {
      console.error('Registration error:', error.message);
      throw new InternalServerErrorException(Message.CREATE_FAILED);
    }
  }

  async updateOrganization(
    orgId: string,
    input: UpdateOrganizationDto,
  ): Promise<Organ> {
    const existing = await this.database.organization.findUnique({
      where: { id: orgId },
    });

    if (!existing) {
      throw new BadRequestException('Organization not found');
    }

    const updated = await this.database.organization.update({
      where: { id: orgId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        status: input.status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        created_at: true,
      },
    });

    return {
      organization_id: updated.id,
      Org_name: updated.name,
      Org_email: updated.email,
      Org_status: updated.status,
      created_at: updated.created_at,
    } as Organ;
  }

  async listOrganizations(
    query: QueryOrganizationDto,
  ): Promise<PaginatedOrganizationResponseDto> {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.database.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { users: true } },
        },
      }),
      this.database.organization.count({ where }),
    ]);

    return {
      items: items.map(toPlatformOrganization),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrganizationStatus(
    orgId: string,
    input: UpdateOrganizationStatusDto,
  ): Promise<PlatformOrganizationDto> {
    const updated = await this.database.organization.update({
      where: { id: orgId },
      data: { status: input.status },
      include: { _count: { select: { users: true } } },
    });

    return toPlatformOrganization(updated);
  }
}
