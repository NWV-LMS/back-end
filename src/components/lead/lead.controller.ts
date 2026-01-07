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

import { QueryLeadDto } from 'src/libs/dto/lead/query-lead.dto';
import { Query } from '@nestjs/common';

import { ConvertLeadDto } from 'src/libs/dto/lead/convert-lead.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('lead')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  //   @Post(':id/notes')
  //   addNote(
  //     @Param('id') id: string,
  //     @Body() dto: CreateNoteDto,
  //     @CurrentUser() user: JwtPayload,
  //   ) {
  //     console.log('notes')
  //     if (!user.organization_id) throw new Error('Org ID required');
  //     return this.leadService.addNote(id, dto, user.id, user.organization_id);
  //   }

  //   @Get(':id/notes')
  //   getNotes(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
  //     if (!user.organization_id) throw new Error('Org ID required');
  //     return this.leadService.getNotes(id, user.organization_id);
  //   }

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    console.log(user);
    if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.convert(id, dto, user.organization_id);
  }

  @Post()
  create(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeadResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.create(createLeadDto, user.organization_id);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryLeadDto,
  ): Promise<any> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.findAll(user.organization_id, query);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeadResponseDto> {
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
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<LeadResponseDto> {
    if (!user.organization_id) throw new Error('Org ID required');
    return this.leadService.remove(id, user.organization_id);
  }
}
