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
import { CreateLeadDto } from 'src/libs/dto/lead/create-lead.dto';
import { UpdateLeadDto } from 'src/libs/dto/lead/update-lead.dto';
import { LeadResponseDto } from 'src/libs/dto/lead/lead-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from 'src/libs/types/auth';
import { UserRole } from 'generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('lead')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Post()
  create(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeadResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.create(createLeadDto, user.organization_id);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<LeadResponseDto[]> {
      if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.findAll(user.organization_id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<LeadResponseDto> {
      if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.findOne(id, user.organization_id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeadResponseDto> {
      if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.update(id, updateLeadDto, user.organization_id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<LeadResponseDto> {
      if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.remove(id, user.organization_id);
  }
}
