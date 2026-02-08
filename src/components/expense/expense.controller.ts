import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from '../../libs/dto/expense/create-expense.dto';
import { UpdateExpenseDto } from '../../libs/dto/expense/update-expense.dto';
import { QueryExpenseDto } from '../../libs/dto/expense/query-expense.dto';
import {
  ExpenseResponseDto,
  PaginatedExpenseResponseDto,
} from '../../libs/dto/expense/expense-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from 'generated/prisma/enums';
import { OrganizationId } from '../auth/decorators/organization-id.decorator';
import { OrganizationIdGuard } from '../auth/guards/organization-id.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, OrganizationIdGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser('id') userId: string,
    @Body() input: CreateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.create(organizationId, userId, input);
  }

  @Get()
  findAll(
    @OrganizationId() organizationId: string,
    @Query() query: QueryExpenseDto,
  ): Promise<PaginatedExpenseResponseDto> {
    return this.expenseService.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    return this.expenseService.update(organizationId, id, input);
  }

  @Delete(':id')
  remove(
    @OrganizationId() organizationId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.expenseService.remove(organizationId, id);
  }
}
