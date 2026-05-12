import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../libs/types/auth';
import { JournalService } from './journal.service';
import { CreateJournalEntryDto } from '../../libs/dto/journal/create-journal-entry.dto';
import { QueryJournalDto } from '../../libs/dto/journal/query-journal.dto';
import {
  JournalEntryResponseDto,
  JournalListResponseDto,
} from '../../libs/dto/journal/journal-entry-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard, OrganizationIdGuard)
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Post()
  upsertEntries(
    @Body() dto: CreateJournalEntryDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JournalEntryResponseDto[]> {
    return this.journalService.upsertEntries(organizationId, user.sub, user.role, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get()
  findAll(
    @Query() query: QueryJournalDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JournalListResponseDto> {
    return this.journalService.findAll(organizationId, user.sub, user.role, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER)
  @Get('groups/:groupId')
  findByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query() query: QueryJournalDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JournalListResponseDto> {
    return this.journalService.findByGroup(organizationId, user.sub, user.role, groupId, query);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('teachers/:teacherId')
  findByTeacher(
    @Param('teacherId', new ParseUUIDPipe({ version: '4' })) teacherId: string,
    @Query() query: QueryJournalDto,
    @OrganizationId() organizationId: string,
  ): Promise<JournalListResponseDto> {
    return this.journalService.findByTeacher(organizationId, teacherId, query);
  }
}
