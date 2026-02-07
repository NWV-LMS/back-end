import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { LeadService } from './lead.service';
import { CreateLeadDto } from '../../libs/dto/lead/create-lead.dto';
import { UpdateLeadDto } from '../../libs/dto/lead/update-lead.dto';
import { LeadResponseDto } from '../../libs/dto/lead/lead-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { UserRole } from 'generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';

import { QueryLeadDto } from '../../libs/dto/lead/query-lead.dto';
import { Query } from '@nestjs/common';

import { ConvertLeadDto } from '../../libs/dto/lead/convert-lead.dto';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('lead')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
    @OrganizationId() organizationId: string,
  ): Promise<any> {
    return this.leadService.convert(id, dto, organizationId);
  }

  @Post()
  create(
    @Body() createLeadDto: CreateLeadDto,
    @OrganizationId() organizationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadService.create(createLeadDto, organizationId);
  }

  @Get()
  findAll(
    @Query() query: QueryLeadDto,
    @OrganizationId() organizationId: string,
  ): Promise<any> {
    return this.leadService.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadService.findOne(id, organizationId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @OrganizationId() organizationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadService.update(id, updateLeadDto, organizationId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ): Promise<LeadResponseDto> {
    return this.leadService.remove(id, organizationId);
  }
}
